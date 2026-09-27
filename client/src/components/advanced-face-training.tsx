import { ReactNode, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Camera, CheckCircle, RotateCcw, RotateCw } from "lucide-react";
import * as faceapi from "face-api.js";

interface AdvancedFaceTrainingProps {
  /** Receives the JSON training payload for POST /api/register-face. */
  onComplete: (trainingData: string) => void;
  onCancel: () => void;
}

type PoseId = "center" | "left" | "right";

type TrainingStep = {
  id: PoseId;
  name: string;
  instruction: string;
  icon: ReactNode;
  completed: boolean;
  descriptor?: number[];
};

const MODEL_URL = "/models";
const DESCRIPTOR_LENGTH = 128;
/** Pause AFTER a detection finishes before starting the next one — detections never overlap. */
const DETECTION_PAUSE_MS = 150;
/** Reuse the loop's most recent descriptor at capture time if it is at least this fresh. */
const DESCRIPTOR_FRESHNESS_MS = 1500;
const COUNTDOWN_SECONDS = 2;
const COUNTDOWN_TICK_MS = 800;
const NO_FACE_HINT_AFTER_MS = 10_000;

const POSE_HINTS: Record<PoseId, string> = {
  center: "Look straight at the camera and keep your head level",
  left: "Turn your head a little further to your left",
  right: "Turn your head a little further to your right",
};

const INITIAL_STEPS: TrainingStep[] = [
  {
    id: "center",
    name: "Center Position",
    instruction: "Look directly at the camera with your face centered",
    icon: <Camera className="w-5 h-5" />,
    completed: false,
  },
  {
    id: "left",
    name: "Turn Left",
    instruction: "Slowly turn your head to the left (your left)",
    icon: <RotateCcw className="w-5 h-5" />,
    completed: false,
  },
  {
    id: "right",
    name: "Turn Right",
    instruction: "Slowly turn your head to the right (your right)",
    icon: <RotateCw className="w-5 h-5" />,
    completed: false,
  },
];

const detectorOptions = () => new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });

function detectFaces(input: HTMLVideoElement) {
  return faceapi.detectAllFaces(input, detectorOptions()).withFaceLandmarks().withFaceDescriptors();
}
type Detection = Awaited<ReturnType<typeof detectFaces>>[number];

const bestOf = (detections: Detection[]) =>
  detections.reduce((prev, cur) => (cur.detection.score > prev.detection.score ? cur : prev));

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Pose check on face-api landmarks.
 *
 * The camera frame itself is NOT mirrored — only the on-screen preview is
 * flipped with CSS. In an un-mirrored frame the user's left side is on the
 * RIGHT of the image, so when they turn to THEIR left the nose tip moves to a
 * larger x than the midpoint between the eyes.
 */
function isPoseCorrect(detection: Detection, pose: PoseId): boolean {
  const landmarks = detection.landmarks;
  const box = detection.detection.box;
  const nose = landmarks.getNose()[3]; // nose tip
  const leftEye = landmarks.getLeftEye()[0]; // outer corner of the frame-left eye
  const rightEye = landmarks.getRightEye()[3]; // outer corner of the frame-right eye
  const eyeCenterX = (leftEye.x + rightEye.x) / 2;
  const noseOffset = nose.x - eyeCenterX; // > 0 → user turned to their left

  switch (pose) {
    case "center":
      return Math.abs(noseOffset) < box.width * 0.1 && Math.abs(leftEye.y - rightEye.y) < box.height * 0.08;
    case "left":
      return noseOffset > box.width * 0.15;
    case "right":
      return -noseOffset > box.width * 0.15;
  }
}

export function AdvancedFaceTraining({ onComplete, onCancel }: AdvancedFaceTrainingProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [videoReady, setVideoReady] = useState(false);

  const [steps, setSteps] = useState<TrainingStep[]>(INITIAL_STEPS);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isCapturing, setIsCapturing] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [faceDetected, setFaceDetected] = useState(false);
  const [poseOk, setPoseOk] = useState(false);
  const [detectionScore, setDetectionScore] = useState(0);
  const [statusMessage, setStatusMessage] = useState("Position your face as instructed");
  const [showNoFaceHint, setShowNoFaceHint] = useState(false);

  // Refs mirror the state that the async detection loop and timers need, so
  // those callbacks never act on stale values captured by an old render.
  const stepsRef = useRef<TrainingStep[]>(INITIAL_STEPS);
  const stepIndexRef = useRef(0);
  const capturingRef = useRef(false);
  const completedRef = useRef(false);
  const lastDescriptorRef = useRef<{ descriptor: number[]; at: number } | null>(null);
  const lastFaceSeenAtRef = useRef(Date.now());
  const lastLogAtRef = useRef(0);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentStep = steps[Math.min(currentStepIndex, steps.length - 1)];
  const allDone = steps.every((s) => s.completed);
  const progress = (steps.filter((s) => s.completed).length / steps.length) * 100;
  const ready = modelsLoaded && videoReady && !fatalError;

  // 1. Load the face-api.js models once.
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ])
      .then(() => {
        if (!cancelled) setModelsLoaded(true);
      })
      .catch((error) => {
        console.error("Failed to load face-api models:", error);
        if (!cancelled) {
          setFatalError("Face detection couldn't start (models failed to load). Check your connection and refresh.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 2. Request the camera. Tracks are stopped from the local variable on unmount.
  useEffect(() => {
    let cancelled = false;
    let localStream: MediaStream | null = null;
    navigator.mediaDevices
      .getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" } })
      .then((mediaStream) => {
        if (cancelled) {
          mediaStream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStream = mediaStream;
        setStream(mediaStream);
      })
      .catch((error) => {
        console.error("Error accessing camera:", error);
        if (!cancelled) setFatalError("Camera access denied. Please allow camera permission and refresh.");
      });
    return () => {
      cancelled = true;
      localStream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // 3. Attach the stream. The <video> element is always mounted, so there is no
  //    race between the stream arriving and the element existing.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;
    if (video.srcObject !== stream) video.srcObject = stream;
    video.play().catch(() => {
      /* playsInline + muted normally allows autoplay; a user gesture retries */
    });
  }, [stream]);

  // 4. Detection loop: exactly one detection in flight at a time. Starts as soon as
  //    BOTH the models and the video are ready, in whichever order that happens.
  useEffect(() => {
    if (!ready) return;
    let active = true;

    const run = async () => {
      console.log("[face-training] detection loop started");
      while (active) {
        const video = videoRef.current;
        if (video && video.readyState >= 2 && video.videoWidth > 0 && !document.hidden) {
          try {
            const detections = await detectFaces(video);
            if (!active) return;
            handleDetections(detections);
          } catch (error) {
            console.error("[face-training] detection failed", error);
          }
        }
        await sleep(DETECTION_PAUSE_MS);
      }
    };

    void run();
    return () => {
      active = false;
    };
    // handleDetections only touches refs and state setters, so it is safe to omit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // 5. Clear timers on unmount.
  useEffect(() => {
    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    };
  }, []);

  const handleDetections = (detections: Detection[]) => {
    const now = Date.now();
    const step = stepsRef.current[stepIndexRef.current];

    if (detections.length === 0) {
      lastDescriptorRef.current = null;
      setFaceDetected(false);
      setPoseOk(false);
      setDetectionScore(0);
      setShowNoFaceHint(now - lastFaceSeenAtRef.current > NO_FACE_HINT_AFTER_MS);
      if (!capturingRef.current) setStatusMessage("No face detected — move into the light and centre your face");
      return;
    }

    const best = bestOf(detections);
    const descriptor = Array.from(best.descriptor);
    lastFaceSeenAtRef.current = now;
    if (descriptor.length === DESCRIPTOR_LENGTH) lastDescriptorRef.current = { descriptor, at: now };
    setFaceDetected(true);
    setShowNoFaceHint(false);
    setDetectionScore(best.detection.score);

    if (!step || step.completed || capturingRef.current) return;

    const ok = isPoseCorrect(best, step.id);
    if (now - lastLogAtRef.current > 1000) {
      lastLogAtRef.current = now;
      console.log("[face-training]", {
        step: step.id,
        detections: detections.length,
        score: best.detection.score.toFixed(2),
        positionOk: ok,
      });
    }
    setPoseOk(ok);
    if (ok) {
      setStatusMessage("Hold still…");
      startCountdown();
    } else {
      setStatusMessage(POSE_HINTS[step.id]);
    }
  };

  const finishCapture = () => {
    capturingRef.current = false;
    setIsCapturing(false);
    setCountdown(0);
  };

  const startCountdown = () => {
    if (capturingRef.current || completedRef.current) return;
    capturingRef.current = true;
    setIsCapturing(true);
    setCountdown(COUNTDOWN_SECONDS);

    let remaining = COUNTDOWN_SECONDS;
    countdownTimerRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining > 0) {
        setCountdown(remaining);
        return;
      }
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
      setCountdown(0);
      void captureStep();
    }, COUNTDOWN_TICK_MS);
  };

  const captureStep = async () => {
    const stepIndex = stepIndexRef.current;
    const step = stepsRef.current[stepIndex];
    if (!step || step.completed) {
      finishCapture();
      return;
    }

    try {
      // Prefer the descriptor the loop just computed; otherwise run one detection now.
      let descriptor: number[] | null = null;
      const recent = lastDescriptorRef.current;
      if (recent && Date.now() - recent.at <= DESCRIPTOR_FRESHNESS_MS) {
        descriptor = recent.descriptor;
      } else if (videoRef.current) {
        const detections = await detectFaces(videoRef.current);
        if (detections.length > 0) descriptor = Array.from(bestOf(detections).descriptor);
      }

      if (!descriptor || descriptor.length !== DESCRIPTOR_LENGTH) {
        setStatusMessage("Couldn't capture your face — keep it in view and try again");
        finishCapture();
        return;
      }

      const updated = stepsRef.current.map((s, i) => (i === stepIndex ? { ...s, completed: true, descriptor } : s));
      stepsRef.current = updated;
      setSteps(updated);

      if (stepIndex < updated.length - 1) {
        advanceTimerRef.current = setTimeout(() => {
          advanceTimerRef.current = null;
          stepIndexRef.current = stepIndex + 1;
          setCurrentStepIndex(stepIndex + 1);
          lastFaceSeenAtRef.current = Date.now();
          setPoseOk(false);
          setStatusMessage("Position your face as instructed");
          finishCapture();
        }, 500);
      } else {
        completeTraining(updated);
      }
    } catch (error) {
      console.error("[face-training] capture failed", error);
      setStatusMessage("Capture failed — please try again");
      finishCapture();
    }
  };

  const completeTraining = (finalSteps: TrainingStep[]) => {
    if (completedRef.current) return;
    const completed = finalSteps.filter((s) => s.completed && s.descriptor?.length === DESCRIPTOR_LENGTH);
    if (completed.length < 2) {
      setStatusMessage("Not enough good captures — please start again");
      finishCapture();
      return;
    }
    completedRef.current = true;

    const averaged = new Array<number>(DESCRIPTOR_LENGTH).fill(0);
    for (const s of completed) {
      s.descriptor!.forEach((value, i) => {
        averaged[i] += value / completed.length;
      });
    }

    const trainingData = {
      version: 2,
      type: "advanced-training",
      primaryDescriptor: averaged,
      poseDescriptors: completed.map((s) => ({ pose: s.id, descriptor: s.descriptor, timestamp: Date.now() })),
      trainingComplete: true,
      quality: completed.length / finalSteps.length,
    };

    setStatusMessage("All poses captured");
    onComplete(JSON.stringify(trainingData));
  };

  const cancelTimers = () => {
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    countdownTimerRef.current = null;
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    advanceTimerRef.current = null;
  };

  const resetStep = () => {
    cancelTimers();
    const idx = stepIndexRef.current;
    const updated = stepsRef.current.map((s, i) => (i === idx ? { ...s, completed: false, descriptor: undefined } : s));
    stepsRef.current = updated;
    setSteps(updated);
    setPoseOk(false);
    setStatusMessage("Position your face as instructed");
    finishCapture();
  };

  const startOver = () => {
    cancelTimers();
    completedRef.current = false;
    stepsRef.current = INITIAL_STEPS;
    stepIndexRef.current = 0;
    setSteps(INITIAL_STEPS);
    setCurrentStepIndex(0);
    setPoseOk(false);
    setStatusMessage("Position your face as instructed");
    lastFaceSeenAtRef.current = Date.now();
    finishCapture();
  };

  if (fatalError) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="pt-6">
          <div className="text-center text-destructive space-y-2">
            <Camera className="w-12 h-12 mx-auto opacity-60" />
            <p className="font-medium">{fatalError}</p>
            <div className="flex justify-center gap-2">
              <Button variant="outline" onClick={() => window.location.reload()}>
                Refresh Page
              </Button>
              <Button variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const loadingLabel = !stream
    ? "Waiting for camera permission…"
    : !modelsLoaded
      ? "Loading face models…"
      : "Starting camera…";

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Face Training Progress</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="w-full" />
      </div>

      {/* Current Step */}
      <Card>
        <CardContent className="pt-6">
          <div className="text-center mb-4">
            <div className="flex items-center justify-center mb-2">
              {currentStep.icon}
              <h3 className="text-lg font-semibold ml-2">{currentStep.name}</h3>
            </div>
            <p className="text-muted-foreground">{currentStep.instruction}</p>
          </div>

          {/* Camera feed — always mounted so the stream can attach as soon as it exists */}
          <div className="relative w-full max-w-md mx-auto mb-4">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              onLoadedMetadata={() => setVideoReady(true)}
              className="w-full min-h-[200px] rounded-lg border bg-black"
              style={{ transform: "scaleX(-1)" }}
            />

            {!ready && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-lg">
                <div className="text-white text-sm font-medium text-center space-y-2">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mx-auto" />
                  <span>{loadingLabel}</span>
                  <p className="text-xs opacity-80">This may take 10–30 seconds on mobile data.</p>
                </div>
              </div>
            )}

            {ready && faceDetected && !currentStep.completed && (
              <div className={`absolute inset-4 border-2 rounded-lg ${poseOk ? "border-green-500" : "border-amber-400"}`}>
                <div
                  className={`absolute -top-6 left-0 text-white text-xs px-2 py-1 rounded ${
                    poseOk ? "bg-green-500" : "bg-amber-500"
                  }`}
                >
                  {poseOk ? "Pose OK" : "Face Detected"}
                </div>
              </div>
            )}

            {countdown > 0 && (
              <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg">
                <div className="text-white text-6xl font-bold">{countdown}</div>
              </div>
            )}

            {currentStep.completed && (
              <div className="absolute inset-0 bg-green-500 bg-opacity-80 flex items-center justify-center rounded-lg">
                <CheckCircle className="w-16 h-16 text-white" />
              </div>
            )}
          </div>

          {/* Status */}
          <div className="text-center space-y-2">
            {allDone ? (
              <p className="text-green-600 font-semibold">✓ All poses captured — saving your face profile…</p>
            ) : currentStep.completed ? (
              <p className="text-green-600 font-semibold">✓ Step completed!</p>
            ) : (
              <div className="space-y-2">
                <div className={`text-sm font-medium ${poseOk ? "text-green-600" : "text-amber-600"}`}>
                  {ready ? statusMessage : "Getting ready…"}
                </div>
                {detectionScore > 0 && (
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${
                        detectionScore > 0.7 ? "bg-green-500" : "bg-amber-500"
                      }`}
                      style={{ width: `${Math.round(detectionScore * 100)}%` }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex flex-col items-center gap-2 mt-4">
            {!allDone && !currentStep.completed && (
              <Button onClick={startCountdown} disabled={!ready || !faceDetected || isCapturing} className="w-full max-w-xs">
                {isCapturing ? "Capturing…" : faceDetected ? "Capture" : "Waiting for face…"}
              </Button>
            )}

            {showNoFaceHint && !currentStep.completed && (
              <p className="text-xs text-muted-foreground text-center max-w-xs">
                Still no face found. Face a window or lamp, remove hats or masks, and make sure your whole face is inside the frame.
              </p>
            )}
          </div>

          <div className="flex justify-center space-x-3 mt-2">
            {allDone ? (
              <Button variant="outline" onClick={startOver}>
                Start Again
              </Button>
            ) : (
              <Button variant="outline" onClick={resetStep} disabled={!ready}>
                Reset Step
              </Button>
            )}
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Steps Overview */}
      <div className="grid grid-cols-3 gap-2">
        {steps.map((step, index) => (
          <div
            key={step.id}
            className={`p-3 rounded-lg border text-center ${
              step.completed
                ? "bg-emerald-500/10 border-emerald-500/30"
                : index === currentStepIndex
                  ? "bg-primary/10 border-primary/30"
                  : "bg-muted border-border"
            }`}
          >
            <div className="flex justify-center mb-1">
              {step.completed ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : step.icon}
            </div>
            <div className="text-xs font-medium">{step.name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
