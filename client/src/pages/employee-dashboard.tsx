import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { BarChart3, Camera, CheckCircle2, Clock, KeyRound, LogOut, RefreshCw, Settings, Timer } from "lucide-react";
import { AppShell, PageTitle } from "@/components/layout/app-shell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { ChangePasswordDialog } from "@/components/change-password-dialog";
import { PinAuthDialog } from "@/components/pin-auth-dialog";
import { EmployeeAnalyticsDashboard } from "@/components/employee-analytics-dashboard";
import EmployeeSettings from "@/pages/employee-settings";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient as globalQueryClient } from "@/lib/queryClient";
import { faceRecognition } from "@/lib/face-recognition";
import { cleanError, type SafeUser } from "@/lib/types";
import { useOrganization } from "@/features/admin/use-admin-data";
import { statusTone, useMyShifts } from "@/features/admin/schedule-api";
import { addDays, keyToDate, startOfWeek, todayKey } from "@/lib/dates";
import { cn } from "@/lib/utils";

interface UserLocation {
  latitude?: number;
  longitude?: number;
}

interface TodayAttendance {
  record: any | null;
  records: any[];
  activeRecord: any | null;
  isClockedIn: boolean;
  hasForgottenClockOut: boolean;
}

/** Best-effort GPS fix. Resolves undefined if unavailable; the server decides whether location is required. */
function getUserLocation(): Promise<UserLocation | undefined> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(undefined);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => resolve(undefined),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 120000 }
    );
  });
}

export default function EmployeeDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [pinAction, setPinAction] = useState<"in" | "out">("in");

  // Camera state
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedImage, setCapturedImage] = useState("");
  const [videoReady, setVideoReady] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [faceError, setFaceError] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const { data: user } = useQuery<SafeUser>({ queryKey: ["/api/user"], queryFn: () => apiRequest("/api/user") });
  const { data: org } = useOrganization();
  const { data: today } = useQuery<TodayAttendance>({ queryKey: ["/api/attendance/today"], queryFn: () => apiRequest("/api/attendance/today"), refetchInterval: 60_000 });
  const { data: records = [] } = useQuery<any[]>({ queryKey: ["/api/attendance"], queryFn: () => apiRequest("/api/attendance") });
  const weekStart = startOfWeek(todayKey());
  const { data: myShifts } = useMyShifts(weekStart, addDays(weekStart, 6));
  const todayCell = myShifts?.days.find((d) => d.date === myShifts.today);

  const refreshAttendance = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/attendance/today"] });
    queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
  };

  // Attach the stream once both it and the <video> exist.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !cameraStream) return;
    if (v.srcObject !== cameraStream) v.srcObject = cameraStream;
    v.play().catch(() => {});
  }, [cameraStream, isCapturing]);

  // Stop the camera on unmount.
  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), []);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraStream(null);
    setIsCapturing(false);
    setVideoReady(false);
  };

  const startCamera = async () => {
    try {
      setFaceError("");
      setVideoReady(false);
      setIsCapturing(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: "user" } });
      streamRef.current = stream;
      setCameraStream(stream);
    } catch (error) {
      console.error("Error accessing camera:", error);
      setIsCapturing(false);
      toast({ title: "Camera unavailable", description: "Please allow camera access, or use your PIN.", variant: "destructive" });
    }
  };

  const captureImage = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    if (video.readyState < 2 || video.videoWidth === 0) {
      setFaceError("Camera is still starting. Give it a second and try again.");
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    setCapturedImage(canvas.toDataURL("image/jpeg", 0.85));
    stopCamera();
  };

  const verifyFace = useMutation({
    mutationFn: async (data: { imageData: string; descriptor: number[]; location?: UserLocation }) => {
      const body: any = { imageData: data.imageData, descriptor: data.descriptor, action: "in" };
      if (data.location?.latitude != null && data.location?.longitude != null) {
        body.location = { latitude: String(data.location.latitude), longitude: String(data.location.longitude) };
      }
      return apiRequest("/api/verify-face", { method: "POST", body });
    },
    onSuccess: (data) => {
      if (data.verified) {
        toast({ title: "Clocked in", description: `Face verified at ${format(new Date(), "HH:mm")}.` });
        refreshAttendance();
      }
      setCapturedImage("");
    },
    onError: (error: any) => {
      const msg = cleanError(error);
      if (/401|Authentication required/.test(String(error?.message))) {
        window.location.href = "/login";
        return;
      }
      setFaceError(msg);
    },
  });

  const clockOut = useMutation({
    mutationFn: async () => apiRequest("/api/clock-out", { method: "POST" }),
    onSuccess: () => {
      toast({ title: "Clocked out", description: `Have a good one. ${format(new Date(), "HH:mm")}` });
      refreshAttendance();
    },
    onError: (e) => toast({ title: "Couldn't clock out", description: cleanError(e), variant: "destructive" }),
  });

  const logout = useMutation({
    mutationFn: async () => apiRequest("/api/logout", { method: "POST" }),
    onSuccess: () => {
      globalQueryClient.clear();
      window.location.href = "/";
    },
  });

  const handleFaceClockIn = async () => {
    if (!capturedImage) return;
    setFaceError("");
    setIsExtracting(true);
    try {
      const result = await faceRecognition.generateDescriptorFromImageData(capturedImage);
      if (!result.success || !result.descriptor) {
        setFaceError("No face found in that photo. Face the camera in good light and try again.");
        return;
      }
      const location = await getUserLocation();
      verifyFace.mutate({ imageData: capturedImage, descriptor: result.descriptor, location });
    } catch (e) {
      setFaceError(cleanError(e));
    } finally {
      setIsExtracting(false);
    }
  };

  if (!user) return null;

  const isIn = !!today?.isClockedIn;
  const active = today?.activeRecord;
  const sinceLabel = active ? format(new Date(active.clockInTime), "HH:mm") : null;
  const hoursSoFar = active ? ((Date.now() - new Date(active.clockInTime).getTime()) / 36e5).toFixed(1) : null;
  const canFace = !!user.faceRegistered;
  const canPin = !!user.pinEnabled;

  return (
    <AppShell
      user={user}
      org={org ? { name: org.name, logoUrl: org.logoUrl, brandColor: org.brandColor } : null}
      onLogout={() => logout.mutate()}
      onChangePassword={() => setShowPasswordDialog(true)}
    >
      <Tabs defaultValue="today" className="space-y-6">
        <PageTitle
          title={`Hi ${user.firstName}`}
          subtitle={format(new Date(), "EEEE d MMMM yyyy")}
          actions={
            <TabsList className="h-auto gap-1 bg-muted/60 p-1">
              <TabsTrigger value="today" className="gap-1.5 rounded-lg px-3 py-1.5">
                <Clock className="h-4 w-4" /> Today
              </TabsTrigger>
              <TabsTrigger value="hours" className="gap-1.5 rounded-lg px-3 py-1.5">
                <BarChart3 className="h-4 w-4" /> My hours
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-1.5 rounded-lg px-3 py-1.5">
                <Settings className="h-4 w-4" /> Settings
              </TabsTrigger>
            </TabsList>
          }
        />

        <TabsContent value="today" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
            {/* Status + action */}
            <Card className="overflow-hidden">
              <div className={`h-1.5 ${isIn ? "bg-success" : "bg-muted"}`} />
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-2xl">{isIn ? "You're clocked in" : "Not clocked in"}</CardTitle>
                    <CardDescription>
                      {isIn ? `Since ${sinceLabel} · ${hoursSoFar}h so far` : today?.record?.clockOutTime ? `Clocked out at ${format(new Date(today.record.clockOutTime), "HH:mm")}` : "Clock in when you arrive"}
                      {todayCell?.shift && todayCell.shift.status !== "cancelled" && (
                        <span className="mt-1 block">
                          Today's shift {todayCell.shift.startTime}–{todayCell.shift.endTime}
                          {todayCell.evaluation && todayCell.evaluation.status !== "upcoming" && (
                            <span className={cn("ml-2 rounded-full px-2 py-0.5 text-[11px] font-medium", statusTone(todayCell))}>{todayCell.label}</span>
                          )}
                        </span>
                      )}
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className={isIn ? "border-success/40 bg-success/10 text-success" : "text-muted-foreground"}>
                    {isIn ? "On shift" : "Off"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {today?.hasForgottenClockOut && (
                  <Alert>
                    <Timer className="h-4 w-4" />
                    <AlertDescription>You forgot to clock out from an earlier shift. It will be closed automatically; tell your admin the real finish time.</AlertDescription>
                  </Alert>
                )}

                {isIn ? (
                  <Button size="lg" variant="destructive" className="h-12 w-full text-base" onClick={() => clockOut.mutate()} disabled={clockOut.isPending}>
                    <LogOut className="h-5 w-5" /> {clockOut.isPending ? "Clocking out…" : "Clock out"}
                  </Button>
                ) : !canFace && !canPin ? (
                  <Alert>
                    <Camera className="h-4 w-4" />
                    <AlertDescription>
                      Set up face verification or a PIN in the <b>Settings</b> tab before you can clock in.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-3">
                    {canFace && !isCapturing && !capturedImage && (
                      <Button size="lg" className="brand-gradient h-12 w-full text-base text-white shadow-glow hover:opacity-95" onClick={startCamera}>
                        <Camera className="h-5 w-5" /> Clock in with face
                      </Button>
                    )}

                    {isCapturing && (
                      <div className="space-y-3">
                        <div className="relative mx-auto w-full max-w-sm overflow-hidden rounded-xl border bg-black">
                          <video ref={videoRef} autoPlay playsInline muted onLoadedMetadata={() => setVideoReady(true)} className="aspect-[4/3] w-full object-cover" style={{ transform: "scaleX(-1)" }} />
                          {!videoReady && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-sm text-white">
                              <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Starting camera…
                            </div>
                          )}
                        </div>
                        <p className="text-center text-sm text-muted-foreground">Centre your face, then capture.</p>
                        <div className="flex gap-2">
                          <Button className="flex-1" onClick={captureImage} disabled={!videoReady}>
                            {videoReady ? "Capture" : "Camera starting…"}
                          </Button>
                          <Button variant="outline" onClick={stopCamera}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}

                    {capturedImage && (
                      <div className="space-y-3">
                        <img src={capturedImage} alt="Your capture" className="mx-auto w-full max-w-sm rounded-xl border" style={{ transform: "scaleX(-1)" }} />
                        {faceError && (
                          <Alert variant="destructive">
                            <AlertDescription>{faceError}</AlertDescription>
                          </Alert>
                        )}
                        <div className="flex gap-2">
                          <Button className="flex-1" onClick={handleFaceClockIn} disabled={verifyFace.isPending || isExtracting}>
                            {isExtracting ? "Checking face…" : verifyFace.isPending ? "Verifying…" : "Clock in"}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setCapturedImage("");
                              setFaceError("");
                            }}
                          >
                            Retake
                          </Button>
                        </div>
                      </div>
                    )}

                    {canPin && !isCapturing && !capturedImage && (
                      <Button
                        size="lg"
                        variant={canFace ? "outline" : "default"}
                        className="h-12 w-full text-base"
                        onClick={() => {
                          setPinAction("in");
                          setShowPin(true);
                        }}
                      >
                        <KeyRound className="h-5 w-5" /> {canFace ? "Use PIN instead" : "Clock in with PIN"}
                      </Button>
                    )}
                    {!canFace && canPin && (
                      <p className="text-center text-xs text-muted-foreground">Add face verification in Settings for faster clock-ins.</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Today summary */}
            <Card>
              <CardHeader>
                <CardTitle>Today</CardTitle>
                <CardDescription>Your clock-ins so far</CardDescription>
              </CardHeader>
              <CardContent>
                {(today?.records?.length ?? 0) === 0 ? (
                  <EmptyState icon={<Clock />} title="Nothing yet" description="Your first clock-in today will show here." className="py-6" />
                ) : (
                  <ul className="divide-y divide-border">
                    {today!.records.map((r: any) => (
                      <li key={r.id} className="flex items-center justify-between py-3 text-sm">
                        <span className="tabular-nums">
                          {format(new Date(r.clockInTime), "HH:mm")} – {r.clockOutTime ? format(new Date(r.clockOutTime), "HH:mm") : <span className="text-success">now</span>}
                        </span>
                        <span className="text-muted-foreground">{r.clockOutTime ? `${((new Date(r.clockOutTime).getTime() - new Date(r.clockInTime).getTime()) / 36e5).toFixed(1)}h` : "on shift"}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Your shifts this week</CardTitle>
              <CardDescription>
                {myShifts?.hasContract ? "From your weekly contract, plus any one-off changes" : "No weekly contract set. Ask your admin if you expect shifts here."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!myShifts ? null : myShifts.days.every((d) => !d.shift) ? (
                <EmptyState icon={<Clock />} title="No shifts scheduled this week" className="py-6" />
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
                  {myShifts.days.map((d) => {
                    const isToday = d.date === myShifts.today;
                    return (
                      <li key={d.date} className={cn("rounded-xl border p-3", isToday ? "border-primary/50 bg-primary/5" : "border-border", !d.shift && "opacity-60")}>
                        <p className={cn("text-xs font-medium uppercase tracking-wide", isToday ? "text-primary" : "text-muted-foreground")}>{format(keyToDate(d.date), "EEE d")}</p>
                        {d.shift ? (
                          <>
                            <p className={cn("mt-1 text-sm font-semibold tabular-nums", d.shift.status === "cancelled" && "line-through text-muted-foreground")}>
                              {d.shift.startTime}–{d.shift.endTime}
                            </p>
                            <span className={cn("mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium", statusTone(d))}>{d.label}</span>
                          </>
                        ) : (
                          <p className="mt-1 text-sm text-muted-foreground">Off</p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent attendance</CardTitle>
              <CardDescription>Your last few shifts</CardDescription>
            </CardHeader>
            <CardContent>
              {records.length === 0 ? (
                <EmptyState icon={<Clock />} title="No shifts recorded yet" className="py-6" />
              ) : (
                <ul className="divide-y divide-border">
                  {records.slice(0, 7).map((r: any) => (
                    <li key={r.id} className="flex items-center justify-between py-3">
                      <div>
                        <p className="font-medium">{format(new Date(r.date + "T00:00:00"), "EEE d MMM")}</p>
                        <p className="text-sm tabular-nums text-muted-foreground">
                          {format(new Date(r.clockInTime), "HH:mm")}
                          {r.clockOutTime && ` – ${format(new Date(r.clockOutTime), "HH:mm")}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {r.schedule && <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", statusTone({ shift: null, evaluation: { status: r.schedule.status } as any, label: r.schedule.label }))}>{r.schedule.label}</span>}
                        {r.checkInMethod === "manual" && <Badge variant="outline">Manual</Badge>}
                        {r.clockOutTime ? (
                          <span className="text-sm font-medium tabular-nums">{((new Date(r.clockOutTime).getTime() - new Date(r.clockInTime).getTime()) / 36e5).toFixed(1)}h</span>
                        ) : (
                          <CheckCircle2 className="h-4 w-4 text-success" />
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <canvas ref={canvasRef} className="hidden" />
        </TabsContent>

        <TabsContent value="hours">
          <EmployeeAnalyticsDashboard />
        </TabsContent>

        <TabsContent value="settings">
          <EmployeeSettings />
        </TabsContent>
      </Tabs>

      <ChangePasswordDialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog} />
      <PinAuthDialog
        isOpen={showPin}
        onClose={() => setShowPin(false)}
        action={pinAction}
        onSuccess={() => {
          refreshAttendance();
        }}
      />
    </AppShell>
  );
}
