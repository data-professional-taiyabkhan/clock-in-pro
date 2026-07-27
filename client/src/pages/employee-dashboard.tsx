import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { faceRecognition } from "@/lib/face-recognition";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, MapPin, Camera, LogOut, Upload, BarChart3, Key, Settings } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { EmployeeAnalyticsDashboard } from "@/components/employee-analytics-dashboard";
import { ChangePasswordDialog } from "@/components/change-password-dialog";
import EmployeeSettings from "@/pages/employee-settings";

interface UserLocation {
  latitude?: number;
  longitude?: number;
  postcode?: string;
}

export default function EmployeeDashboard() {
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string>("");
  const [userLocation, setUserLocation] = useState<UserLocation>({});
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [, setLocation_] = useLocation();
  const [faceError, setFaceError] = useState<string>("");
  const [isExtractingDescriptor, setIsExtractingDescriptor] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get current user
  const { data: user } = useQuery({
    queryKey: ["/api/user"],
    queryFn: () => apiRequest("/api/user"),
  });

  // Get today's attendance
  const { data: todayAttendance } = useQuery({
    queryKey: ["/api/attendance/today"],
    queryFn: () => apiRequest("/api/attendance/today"),
  });

  // Get recent attendance records
  const { data: attendanceRecords } = useQuery({
    queryKey: ["/api/attendance"],
    queryFn: () => apiRequest("/api/attendance"),
  });

  // Get user location with Promise support
  const getUserLocation = (): Promise<UserLocation> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          setUserLocation(location);
          resolve(location);
        },
        (error) => {
          console.error("Location access error:", error);
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000
        }
      );
    });
  };

  // Face image upload mutation
  const uploadFaceMutation = useMutation({
    mutationFn: async (imageData: string) => {
      return await apiRequest("/api/upload-face-image", {
        method: "POST",
        body: JSON.stringify({ imageData }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Face image uploaded successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Face verification mutation
  const verifyFaceMutation = useMutation({
    mutationFn: async (data: { imageData: string; descriptor: number[]; location?: UserLocation }) => {
      const requestBody: any = {
        imageData: data.imageData,
        descriptor: data.descriptor,
        action: todayAttendance?.record?.clockOutTime ? 'in' : (todayAttendance?.record?.clockInTime ? 'out' : 'in')
      };

      if (data.location) {
        requestBody.location = {
          latitude: data.location.latitude?.toString(),
          longitude: data.location.longitude?.toString()
        };
      }

      return await apiRequest("/api/verify-face", {
        method: "POST",
        body: JSON.stringify(requestBody),
      });
    },
    onSuccess: (data) => {
      if (data.verified) {
        toast({
          title: "Success",
          description: `Successfully ${data.action === 'in' ? 'clocked in' : 'clocked out'}!`,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/attendance/today"] });
        queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
      }
      setCapturedImage("");
    },
    onError: (error: any) => {
      // Handle expired session (401) — do NOT show "face verification failed"
      const statusCode = error?.status || error?.response?.status;
      if (statusCode === 401 || error?.message?.includes("Authentication required")) {
        toast({
          title: "Session Expired",
          description: "Your session has expired — please sign in again.",
          variant: "destructive",
        });
        setLocation_("/login");
        return;
      }
      toast({
        title: "Verification Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });



  // Clock in mutation
  const clockInMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("/api/clock-in", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Clocked in successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Clock In Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Clock out mutation
  const clockOutMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/clock-out", {
        method: "POST",
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Clocked out successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Clock Out Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/logout", {
        method: "POST",
      });
    },
    onSuccess: () => {
      queryClient.clear();
      window.location.reload();
    },
  });



  const startCamera = async () => {
    try {
      console.log('Starting camera...');
      setIsCapturing(true);
      console.log('Set isCapturing to true');

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: 640,
          height: 480,
          facingMode: "user"
        }
      });
      console.log('Camera stream obtained:', stream);
      streamRef.current = stream;

      // Wait for next render cycle
      setTimeout(() => {
        if (videoRef.current && streamRef.current) {
          videoRef.current.srcObject = streamRef.current;
          videoRef.current.play().then(() => {
            console.log('Video playing successfully');
            getUserLocation().catch(err => console.log('Initial location request:', err.message));
          }).catch((playError) => {
            console.log('Video play error:', playError);
          });
        } else {
          console.log('videoRef or stream not available after timeout');
        }
      }, 100);

    } catch (error) {
      console.error('Error accessing camera:', error);
      setIsCapturing(false);
      toast({
        title: "Camera Error",
        description: "Could not access camera. Please allow camera permissions.",
        variant: "destructive",
      });
    }
  };

  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const context = canvas.getContext('2d');

      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0);

        const imageData = canvas.toDataURL('image/jpeg', 0.8);
        setCapturedImage(imageData);

        // Stop camera
        const stream = video.srcObject as MediaStream;
        stream?.getTracks().forEach(track => track.stop());
        setIsCapturing(false);
      }
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageData = e.target?.result as string;
        uploadFaceMutation.mutate(imageData);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFaceCheckIn = async () => {
    if (!capturedImage) return;
    setFaceError("");

    try {
      // Step 1: Extract face descriptor from captured image
      setIsExtractingDescriptor(true);
      const result = await faceRecognition.generateDescriptorFromImageData(capturedImage);
      setIsExtractingDescriptor(false);

      if (!result.success || !result.descriptor) {
        setFaceError("No face detected. Position your face in the frame and try again.");
        return;
      }

      // Step 2: Get fresh location
      const location = await getUserLocation();
      console.log('Location obtained for verification:', location);

      // Step 3: Send descriptor + imageData to server
      verifyFaceMutation.mutate({
        imageData: capturedImage,
        descriptor: result.descriptor,
        location: location
      });
    } catch (error: any) {
      setIsExtractingDescriptor(false);
      if (error?.code === 1 || error?.message?.includes('denied')) {
        toast({
          title: "Location Required",
          description: "Please enable location services and try again. Location verification is required for check-in.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Verification Error",
          description: error.message || "Failed to process face image.",
          variant: "destructive",
        });
      }
    }
  };

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Welcome, {user.firstName}</h1>
            <p className="text-gray-600 dark:text-gray-400">
              {format(new Date(), "EEEE, MMMM do, yyyy")}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowPasswordDialog(true)}
            >
              <Key className="h-4 w-4 mr-2" />
              Change Password
            </Button>
            <Button
              variant="outline"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>

        <Tabs defaultValue="attendance" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="attendance" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Attendance
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              My Hours
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="attendance" className="space-y-6">
            {/* Face Registration Status — honest banners */}
            {!user.faceRegistered && !user.faceImageUrl && (
              <Alert>
                <Camera className="h-4 w-4" />
                <AlertDescription>
                  Face verification isn't set up yet. Go to Settings → Clock-In Settings → Set up face verification, or use PIN to clock in.
                </AlertDescription>
              </Alert>
            )}

            {user.faceImageUrl && !user.faceRegistered && (
              <Alert>
                <Camera className="h-4 w-4" />
                <AlertDescription>
                  A reference photo is on file. Face clock-in still needs setup: Settings → Clock-In Settings → Set up face verification.
                  <div className="mt-2">
                    <img
                      src={user.faceImageUrl}
                      alt="Reference photo"
                      className="w-16 h-16 rounded-full object-cover border"
                    />
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Today's Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Today's Attendance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Status</p>
                    <Badge variant={todayAttendance?.isClockedIn ? "default" : "secondary"}>
                      {todayAttendance?.isClockedIn ? "Clocked In" : "Not Clocked In"}
                    </Badge>
                  </div>

                  {todayAttendance?.record?.clockInTime && (
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Clock In Time</p>
                      <p className="font-medium">
                        {format(new Date(todayAttendance.record.clockInTime), "h:mm a")}
                      </p>
                    </div>
                  )}

                  {todayAttendance?.record?.clockOutTime && (
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Clock Out Time</p>
                      <p className="font-medium">
                        {format(new Date(todayAttendance.record.clockOutTime), "h:mm a")}
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-4 space-y-2">
                  {user.faceRegistered ? (
                    <div className="space-y-2">
                      {!isCapturing && !capturedImage && (
                        <div className="space-y-2">
                          <Button
                            onClick={() => {
                              startCamera();
                            }}
                            className="w-full"
                          >
                            <Camera className="h-4 w-4 mr-2" />
                            Start Face Check-In
                          </Button>



                        </div>
                      )}

                      {isCapturing && (
                        <div className="space-y-2">
                          <div className="text-center text-green-600 mb-2">
                            Camera is active
                          </div>
                          <div className="flex justify-center">
                            <video
                              ref={videoRef}
                              autoPlay
                              playsInline
                              muted
                              width="300"
                              height="225"
                              style={{
                                backgroundColor: '#000',
                                display: 'block'
                              }}
                              className="rounded-lg border-2 border-green-300"
                            />
                          </div>
                          <div className="text-center text-sm text-gray-600">
                            Position your face in the camera view and click capture when ready
                          </div>
                          <Button onClick={captureImage} className="w-full">
                            Capture Face
                          </Button>
                        </div>
                      )}

                      {capturedImage && (
                        <div className="space-y-2">
                          <img
                            src={capturedImage}
                            alt="Captured face"
                            className="w-full max-w-sm mx-auto rounded-lg"
                          />
                          {faceError && (
                            <div className="text-center text-sm text-red-600 font-medium">
                              {faceError}
                            </div>
                          )}
                          {isExtractingDescriptor && (
                            <div className="text-center text-sm text-blue-600">
                              Preparing face verification…
                            </div>
                          )}
                          <div className="flex gap-2">
                            <Button
                              onClick={handleFaceCheckIn}
                              disabled={verifyFaceMutation.isPending || clockInMutation.isPending || isExtractingDescriptor}
                              className="flex-1"
                            >
                              {isExtractingDescriptor
                                ? "Preparing…"
                                : verifyFaceMutation.isPending || clockInMutation.isPending
                                ? "Processing..."
                                : "Clock In"
                              }
                            </Button>
                            <Button
                              onClick={() => { setCapturedImage(""); setFaceError(""); }}
                              variant="outline"
                            >
                              Retake
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <Alert>
                      <Camera className="h-4 w-4" />
                      <AlertDescription>
                        <div className="space-y-2">
                          <p>Face verification isn't set up. Go to the <strong>Settings</strong> tab → <strong>Clock-In Settings</strong> → <strong>Set up face verification</strong> to register your face.</p>
                          {user.pinEnabled && (
                            <p className="text-sm text-muted-foreground">You can still clock in using your PIN.</p>
                          )}
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Show clock-out button only if currently clocked in */}
                  {user.faceRegistered && todayAttendance?.isClockedIn && (
                    <div className="space-y-2 mt-4">
                      <div className="text-center text-green-600 font-medium">
                        ✓ Currently clocked in
                      </div>
                      <Button
                        onClick={() => clockOutMutation.mutate()}
                        disabled={clockOutMutation.isPending}
                        variant="destructive"
                        className="w-full"
                      >
                        <LogOut className="h-4 w-4 mr-2" />
                        {clockOutMutation.isPending ? "Clocking Out..." : "Clock Out"}
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Recent Attendance */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Attendance</CardTitle>
                <CardDescription>Your attendance history</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {attendanceRecords?.slice(0, 5).map((record: any) => (
                    <div
                      key={record.id}
                      className="flex justify-between items-center p-3 border rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{record.date}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {format(new Date(record.clockInTime), "h:mm a")}
                          {record.clockOutTime && (
                            <> - {format(new Date(record.clockOutTime), "h:mm a")}</>
                          )}
                        </p>
                      </div>
                      <div className="text-right">
                        {record.checkInMethod === "manual" && (
                          <Badge variant="outline">Manual</Badge>
                        )}
                        {record.clockOutTime && (
                          <p className="text-sm font-medium">{record.totalHours}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Hidden canvas for image capture */}
            <canvas ref={canvasRef} className="hidden" />
          </TabsContent>

          <TabsContent value="analytics">
            <EmployeeAnalyticsDashboard />
          </TabsContent>

          <TabsContent value="settings">
            <EmployeeSettings />
          </TabsContent>
        </Tabs>
      </div>

      <ChangePasswordDialog
        open={showPasswordDialog}
        onOpenChange={setShowPasswordDialog}
      />
    </div>
  );
}