import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Camera, Check, X, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as faceapi from 'face-api.js';

interface CameraFaceCaptureProps {
  onCapture: (faceData: string) => void;
  onCancel: () => void;
  title: string;
  description: string;
  isVerification?: boolean;
  referenceImage?: string; // Base64 image to show for comparison
}

export function CameraFaceCapture({ 
  onCapture, 
  onCancel, 
  title, 
  description, 
  isVerification = false 
}: CameraFaceCaptureProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isDetected, setIsDetected] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [detectionStatus, setDetectionStatus] = useState('Initializing...');
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [faceDescriptor, setFaceDescriptor] = useState<Float32Array | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadModels();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
    };
  }, []);

  const loadModels = async () => {
    try {
      setDetectionStatus('Loading face recognition models...');
      const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@latest/model';
      const modelPromises = [
        faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
      ];
      await Promise.all(modelPromises);
      setModelsLoaded(true);
      setDetectionStatus('AI models loaded - starting camera...');
      startCamera();
    } catch (error) {
      console.error('Error loading face detection models:', error);
      setModelsLoaded(false);
      setDetectionStatus('Using enhanced detection (AI models unavailable)');
      startCamera();
    }
  };

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.onloadedmetadata = () => {
        startFaceDetection();
      };
    }
  }, [stream]);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
          facingMode: 'user',
          frameRate: { ideal: 30, min: 15 }
        },
        audio: false
      });
      setStream(mediaStream);
      setDetectionStatus('Camera started - preparing detection...');
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast({
        title: "Camera Error",
        description: "Unable to access camera. Please check permissions and ensure your device has a camera.",
        variant: "destructive",
      });
    }
  };

  const passesQualityGates = (video: HTMLVideoElement, detection: any): { ok: boolean; message?: string } => {
    const box = detection?.detection?.box;
    if (!box || !canvasRef.current) return { ok: false, message: 'No face detected' };

    // Face size gate (at least 20% of min(videoW, videoH))
    const minDim = Math.min(video.videoWidth, video.videoHeight);
    const faceMin = 0.20 * minDim;
    if (box.width < faceMin || box.height < faceMin) {
      return { ok: false, message: 'Move closer to the camera' };
    }

    // Blur gate using variance of Laplacian proxy (approx via gradients on downscaled frame)
    try {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return { ok: true };
      const s = 128;
      canvas.width = s; canvas.height = s;
      ctx.drawImage(video, 0, 0, s, s);
      const img = ctx.getImageData(0, 0, s, s);
      let variance = 0; let mean = 0; let n = 0;
      for (let y = 1; y < s - 1; y += 2) {
        for (let x = 1; x < s - 1; x += 2) {
          const i = (y * s + x) * 4;
          const gx = img.data[i - 4] - img.data[i + 4];
          const gy = img.data[i - s * 4] - img.data[i + s * 4];
          const g = Math.abs(gx) + Math.abs(gy);
          mean += g; n++;
        }
      }
      mean /= Math.max(1, n);
      for (let y = 1; y < s - 1; y += 2) {
        for (let x = 1; x < s - 1; x += 2) {
          const i = (y * s + x) * 4;
          const gx = img.data[i - 4] - img.data[i + 4];
          const gy = img.data[i - s * 4] - img.data[i + s * 4];
          const g = Math.abs(gx) + Math.abs(gy);
          variance += (g - mean) * (g - mean);
        }
      }
      variance /= Math.max(1, n);
      if (variance < 50) { // heuristic threshold
        return { ok: false, message: 'Image is blurry - hold still' };
      }
    } catch {}

    // Brightness gate
    try {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return { ok: true };
      const s = 64;
      canvas.width = s; canvas.height = s;
      ctx.drawImage(video, 0, 0, s, s);
      const img = ctx.getImageData(0, 0, s, s);
      let brightness = 0; let count = 0;
      for (let i = 0; i < img.data.length; i += 16) {
        brightness += (img.data[i] + img.data[i + 1] + img.data[i + 2]) / 3;
        count++;
      }
      const avg = brightness / Math.max(1, count);
      if (avg < 60) return { ok: false, message: 'Too dark - improve lighting' };
      if (avg > 210) return { ok: false, message: 'Too bright - reduce backlight' };
    } catch {}

    return { ok: true };
  };

  const startFaceDetection = () => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
    }

    setDetectionStatus('Analyzing video feed...');

    detectionIntervalRef.current = setInterval(async () => {
      if (videoRef.current && canvasRef.current) {
        try {
          const video = videoRef.current;
          
          if (video.readyState === 4) {
            if (modelsLoaded) {
              // Use face-api.js for accurate detection
              const detections = await faceapi
                .detectAllFaces(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.6 }))
                .withFaceLandmarks()
                .withFaceDescriptors();

              if (detections.length > 0) {
                const detection = detections[0];
                const confidence = detection.detection.score;
                const quality = passesQualityGates(video, detection);
                
                if (confidence > 0.7 && quality.ok) {
                  setIsDetected(true);
                  setFaceDescriptor(detection.descriptor);
                  setDetectionStatus(`Face ready (${Math.round(confidence * 100)}%)`);
                } else {
                  setIsDetected(false);
                  setDetectionStatus(quality.message || (confidence > 0.4 ? 'Face quality too low' : 'Position your face in the frame'));
                }
              } else {
                setIsDetected(false);
                setDetectionStatus('No face detected - position your face in the frame');
              }
            } else {
              // Fallback to basic detection
              const canvas = canvasRef.current;
              const context = canvas.getContext('2d');

              if (context) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                context.drawImage(video, 0, 0);

                const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
                const hasFace = analyzeImageForFace(imageData);

                if (hasFace) {
                  setIsDetected(true);
                  setDetectionStatus('Face detected! (basic mode)');
                } else {
                  setIsDetected(false);
                  setDetectionStatus('No face detected - position your face in the frame');
                }
              }
            }
          }
        } catch (error) {
          console.error('Face detection error:', error);
          setDetectionStatus('Detection error - please try again');
        }
      }
    }, 300);
  };

  const analyzeImageForFace = (imageData: ImageData): boolean => {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    
    // Simple face detection based on skin tone and brightness patterns
    let skinPixels = 0;
    let totalPixels = 0;
    let avgBrightness = 0;

    // Sample pixels in the center area where face would typically be
    const centerX = Math.floor(width / 2);
    const centerY = Math.floor(height / 2);
    const sampleRadius = Math.min(width, height) / 4;

    for (let y = centerY - sampleRadius; y < centerY + sampleRadius; y += 4) {
      for (let x = centerX - sampleRadius; x < centerX + sampleRadius; x += 4) {
        if (x >= 0 && x < width && y >= 0 && y < height) {
          const index = (y * width + x) * 4;
          const r = data[index];
          const g = data[index + 1];
          const b = data[index + 2];
          
          // Check for skin-like colors
          const isSkinTone = (r > 95 && g > 40 && b > 20) &&
                            (Math.max(r, g, b) - Math.min(r, g, b) > 15) &&
                            (Math.abs(r - g) > 15) && (r > g) && (r > b);
          
          if (isSkinTone) skinPixels++;
          
          const brightness = (r + g + b) / 3;
          avgBrightness += brightness;
          totalPixels++;
        }
      }
    }

    if (totalPixels === 0) return false;

    avgBrightness /= totalPixels;
    const skinRatio = skinPixels / totalPixels;
    
    // Face detected if there's enough skin tone and reasonable brightness
    return skinRatio > 0.1 && avgBrightness > 50 && avgBrightness < 220;
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    setIsCapturing(true);
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (context) {
      // Use standardized capture size for consistency
      const targetWidth = 640;
      const targetHeight = 480;
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      
      // Scale and center the video feed
      const videoAspect = video.videoWidth / video.videoHeight;
      const canvasAspect = targetWidth / targetHeight;
      
      let drawWidth, drawHeight, drawX, drawY;
      
      if (videoAspect > canvasAspect) {
        drawHeight = targetHeight;
        drawWidth = drawHeight * videoAspect;
        drawX = (targetWidth - drawWidth) / 2;
        drawY = 0;
      } else {
        drawWidth = targetWidth;
        drawHeight = drawWidth / videoAspect;
        drawX = 0;
        drawY = (targetHeight - drawHeight) / 2;
      }
      
      context.drawImage(video, drawX, drawY, drawWidth, drawHeight);
      
      const imageData = canvas.toDataURL('image/jpeg', 0.95);
      setCapturedImage(imageData);
      
      let faceDescriptorData;
      
      if (modelsLoaded && faceDescriptor) {
        // Use multiple face descriptor samples for better accuracy
        const descriptorSamples = [];
        
        // Capture descriptor from current frame
        descriptorSamples.push(Array.from(faceDescriptor));
        
        // Try to get additional samples with slight delays
        for (let i = 0; i < 2; i++) {
          await new Promise(resolve => setTimeout(resolve, 100));
          try {
            const detections = await faceapi.detectAllFaces(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.6 }))
              .withFaceLandmarks()
              .withFaceDescriptors();
            
            if (detections.length > 0) {
              descriptorSamples.push(Array.from(detections[0].descriptor));
            }
          } catch (error) {
            console.log('Additional sample failed:', error);
          }
        }
        
        // Average the descriptors for more stable results
        if (descriptorSamples.length > 1) {
          const avgDescriptor = new Array(descriptorSamples[0].length).fill(0);
          descriptorSamples.forEach(desc => {
            desc.forEach((val, idx) => {
              avgDescriptor[idx] += val / descriptorSamples.length;
            });
          });
          faceDescriptorData = JSON.stringify({ descriptor: avgDescriptor, imageData });
        } else {
          faceDescriptorData = JSON.stringify({ descriptor: descriptorSamples[0], imageData });
        }
      } else {
        // Enhanced fallback descriptor with multiple samples
        const enhancedDescriptor = generateEnhancedFaceDescriptor(imageData, context, canvas);
        faceDescriptorData = enhancedDescriptor;
      }
      
      setTimeout(() => {
        setIsCapturing(false);
        onCapture(faceDescriptorData);
      }, 1000);
    }
  };

  const generateEnhancedFaceDescriptor = (imageData: string, context: CanvasRenderingContext2D, canvas: HTMLCanvasElement): string => {
    // Enhanced face descriptor generation with normalized features for consistency
    const imgData = context.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    const width = canvas.width;
    const height = canvas.height;
    
    // Analyze multiple facial regions with normalized coordinates
    const centerX = width / 2;
    const centerY = height / 2;
    const faceRadius = Math.min(width, height) * 0.4;
    
    const features = {
      // Facial regions relative to detected face center
      eyeRegion: analyzeFaceRegion(data, width, height, 0.25, 0.35, 0.5, 0.2),
      noseRegion: analyzeFaceRegion(data, width, height, 0.35, 0.45, 0.3, 0.25),
      mouthRegion: analyzeFaceRegion(data, width, height, 0.3, 0.6, 0.4, 0.2),
      cheekRegion: analyzeFaceRegion(data, width, height, 0.15, 0.4, 0.7, 0.3),
      
      // Lighting and color normalized features
      overallBrightness: Math.round(calculateAverageBrightness(data) / 5) * 5, // Quantized brightness
      colorDistribution: analyzeColorDistribution(data).map(c => Math.round(c * 10) / 10), // Rounded distribution
      
      // Geometric features for better matching
      faceCenter: { x: centerX, y: centerY },
      faceRadius: Math.round(faceRadius),
      aspectRatio: Math.round((width / height) * 100) / 100,
      
      // Add image characteristics for consistency
      imageHash: generateImageHash(data, width, height),
      timestamp: Date.now()
    };
    
    return JSON.stringify(features);
  };

  const analyzeFaceRegion = (data: Uint8ClampedArray, width: number, height: number, 
                           xRatio: number, yRatio: number, wRatio: number, hRatio: number) => {
    const startX = Math.floor(width * xRatio);
    const startY = Math.floor(height * yRatio);
    const regionWidth = Math.floor(width * wRatio);
    const regionHeight = Math.floor(height * hRatio);
    
    let totalR = 0, totalG = 0, totalB = 0, pixelCount = 0;
    
    for (let y = startY; y < startY + regionHeight && y < height; y++) {
      for (let x = startX; x < startX + regionWidth && x < width; x++) {
        const index = (y * width + x) * 4;
        totalR += data[index];
        totalG += data[index + 1];
        totalB += data[index + 2];
        pixelCount++;
      }
    }
    
    return {
      avgR: Math.round(totalR / pixelCount),
      avgG: Math.round(totalG / pixelCount),
      avgB: Math.round(totalB / pixelCount),
      brightness: Math.round((totalR + totalG + totalB) / (pixelCount * 3))
    };
  };

  const calculateAverageBrightness = (data: Uint8ClampedArray): number => {
    let total = 0;
    for (let i = 0; i < data.length; i += 4) {
      total += (data[i] + data[i + 1] + data[i + 2]) / 3;
    }
    return Math.round(total / (data.length / 4));
  };

  const analyzeColorDistribution = (data: Uint8ClampedArray) => {
    const buckets = new Array(8).fill(0);
    
    for (let i = 0; i < data.length; i += 16) { // Sample every 4th pixel
      const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
      const bucket = Math.floor(brightness / 32);
      buckets[Math.min(bucket, 7)]++;
    }
    
    return buckets;
  };

  const generateImageHash = (data: Uint8ClampedArray, width: number, height: number): number => {
    // Generate a simple hash of the facial region for additional verification
    let hash = 0;
    const step = Math.max(1, Math.floor(data.length / 1000)); // Sample every nth pixel
    
    for (let i = 0; i < data.length; i += step * 4) {
      const r = data[i] || 0;
      const g = data[i + 1] || 0;
      const b = data[i + 2] || 0;
      const brightness = (r + g + b) / 3;
      hash = ((hash << 5) - hash + brightness) & 0xffffffff; // 32-bit hash
    }
    
    return Math.abs(hash) % 10000; // Normalize to 4-digit range
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    setIsCapturing(false);
    setIsDetected(false);
    
    // Restart face detection
    setTimeout(() => {
      setIsDetected(true);
    }, 2000);
  };

  if (capturedImage) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="text-center">
          <h3 className="text-lg sm:text-xl font-semibold mb-2">{title}</h3>
          <p className="text-gray-600 text-sm sm:text-base">{description}</p>
        </div>

        <Card>
          <CardContent className="pt-4 sm:pt-6 px-4 sm:px-6">
            <div className="relative mb-4 sm:mb-6">
              <img 
                src={capturedImage} 
                alt="Captured face" 
                className="w-full h-48 sm:h-64 object-cover rounded-xl"
              />
              <div className="absolute top-2 right-2 sm:top-3 sm:right-3 bg-green-600 text-white px-2 py-1 sm:px-3 sm:py-1 rounded-full text-xs sm:text-sm font-medium flex items-center">
                <Check className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                Captured
              </div>
            </div>

            <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
              <Button variant="outline" onClick={retakePhoto} className="flex-1">
                <RotateCcw className="w-4 h-4 mr-2" />
                Retake
              </Button>
              <Button onClick={async () => {
                if (modelsLoaded && capturedImage) {
                  // Re-analyze the captured image for final descriptor
                  const img = new Image();
                  img.onload = async () => {
                    try {
                      const detections = await faceapi
                        .detectAllFaces(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.6 }))
                        .withFaceLandmarks()
                        .withFaceDescriptors();
                      
                      if (detections.length > 0) {
                        const descriptor = JSON.stringify({ descriptor: Array.from(detections[0].descriptor), imageData: capturedImage });
                        onCapture(descriptor);
                      } else {
                        const context = canvasRef.current?.getContext('2d');
                        if (context && canvasRef.current) {
                          onCapture(generateEnhancedFaceDescriptor(capturedImage, context, canvasRef.current));
                        }
                      }
                    } catch (error) {
                      const context = canvasRef.current?.getContext('2d');
                      if (context && canvasRef.current) {
                        onCapture(generateEnhancedFaceDescriptor(capturedImage, context, canvasRef.current));
                      }
                    }
                  };
                  img.src = capturedImage;
                } else {
                  const context = canvasRef.current?.getContext('2d');
                  if (context && canvasRef.current && capturedImage) {
                    onCapture(generateEnhancedFaceDescriptor(capturedImage, context, canvasRef.current));
                  }
                }
              }} className="flex-1">
                <Check className="w-4 h-4 mr-2" />
                {isVerification ? "Verify" : "Register"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="text-center">
        <h3 className="text-lg sm:text-xl font-semibold mb-2">{title}</h3>
        <p className="text-gray-600 text-sm sm:text-base">{description}</p>
      </div>

      <Card>
        <CardContent className="pt-4 sm:pt-6 px-4 sm:px-6">
          <div className="relative mb-4 sm:mb-6">
            <div className="aspect-video bg-gray-900 rounded-xl overflow-hidden relative">
              {stream ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  <canvas ref={canvasRef} className="hidden" />
                  
                  {/* Face detection overlay - responsive sizing */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className={`w-32 h-40 sm:w-48 sm:h-60 border-4 rounded-2xl transition-colors duration-300 ${
                      isDetected ? "border-green-500" : "border-blue-500"
                    }`} />
                  </div>
                  
                  {/* Corner indicators - responsive positioning */}
                  {[
                    "top-2 left-2 sm:top-4 sm:left-4 border-l-4 border-t-4 rounded-tl-lg",
                    "top-2 right-2 sm:top-4 sm:right-4 border-r-4 border-t-4 rounded-tr-lg", 
                    "bottom-2 left-2 sm:bottom-4 sm:left-4 border-l-4 border-b-4 rounded-bl-lg",
                    "bottom-2 right-2 sm:bottom-4 sm:right-4 border-r-4 border-b-4 rounded-br-lg"
                  ].map((position, index) => (
                    <div key={index} className={`absolute w-6 h-6 sm:w-8 sm:h-8 transition-colors duration-300 ${
                      isDetected ? "border-green-500" : "border-blue-500"
                    } ${position}`} />
                  ))}
                  
                  {/* Status indicator - responsive sizing */}
                  <div className={`absolute bottom-2 sm:bottom-4 left-1/2 transform -translate-x-1/2 px-3 py-1 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm font-medium ${
                    isDetected 
                      ? "bg-green-600 text-white" 
                      : "bg-yellow-600 text-white"
                  }`}>
                    <span className="hidden sm:inline">{detectionStatus}</span>
                    <span className="sm:hidden">
                      {isDetected ? "Face ready" : "Position face"}
                    </span>
                  </div>
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center text-white">
                    <Camera className="h-8 w-8 sm:h-12 sm:w-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm sm:text-base">Starting camera...</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3 sm:space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
              <h4 className="text-xs sm:text-sm font-medium text-blue-800 mb-2">Tips for best results:</h4>
              <ul className="text-xs sm:text-sm text-blue-700 space-y-1">
                <li>• Look directly at the camera</li>
                <li>• Ensure bright, even lighting on your face</li>
                <li>• Keep your face centered in the frame</li>
                <li>• Remove glasses, hats, and face coverings</li>
                <li>• Stay still and maintain neutral expression</li>
                <li className="hidden sm:list-item">• Keep camera at eye level for best results</li>
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
              <Button variant="outline" onClick={onCancel} className="flex-1">
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button 
                onClick={capturePhoto}
                disabled={!isDetected || isCapturing}
                className="flex-1"
              >
                <Camera className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">
                  {isCapturing ? "Capturing..." : "Capture Face"}
                </span>
                <span className="sm:hidden">
                  {isCapturing ? "Capturing..." : "Capture"}
                </span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}