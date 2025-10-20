import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { User, Camera, KeyRound } from "lucide-react";
import { SimpleFaceCapture } from "./simple-face-capture";
import { PinAuthDialog } from "./pin-auth-dialog";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface FaceAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  action: 'in' | 'out';
  userPinEnabled?: boolean;
  location?: { latitude: number; longitude: number };
  userLocation?: { latitude: number; longitude: number };
}

export function FaceAuthModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  action, 
  userPinEnabled = false,
  location,
  userLocation 
}: FaceAuthModalProps) {
  const [showCamera, setShowCamera] = useState(false);
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [canUsePin, setCanUsePin] = useState(userPinEnabled);
  const { toast } = useToast();

  const verifyFaceMutation = useMutation({
    mutationFn: async (faceData: string) => {
      return await apiRequest("/api/verify-face", {
        method: "POST",
        body: JSON.stringify({ 
          faceData,
          action,
          location,
          userLocation
        })
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Face Verified",
        description: data.message || `Successfully verified for clock ${action}`,
      });
      onSuccess();
    },
    onError: (error: any) => {
      let errorMessage = error.message;
      const response = error.response?.data || error.data;
      
      // Check if PIN backup is available
      if (response?.canUsePin) {
        setCanUsePin(true);
      }
      
      // Provide user-friendly error messages
      if (errorMessage.includes("face does not match")) {
        errorMessage = "Your face doesn't match the registered profile. Please try again with better lighting or use PIN backup.";
      } else if (errorMessage.includes("not registered")) {
        errorMessage = "No face profile found. Please register your face first from the dashboard or use PIN backup.";
      } else if (errorMessage.includes("quality too low")) {
        errorMessage = "Face image quality is too low. Please improve lighting and try again or use PIN backup.";
      } else if (errorMessage.includes("liveness")) {
        errorMessage = "Liveness detection failed. Please ensure you're using a live camera feed or use PIN backup.";
      } else if (!errorMessage || errorMessage === "Face verification failed") {
        errorMessage = "Face verification failed. Please ensure good lighting and try again or use PIN backup.";
      }
      
      toast({
        title: "Verification Failed",
        description: errorMessage,
        variant: "destructive",
      });
      setShowCamera(false);
    },
  });

  useEffect(() => {
    if (isOpen) {
      setShowCamera(true);
    } else {
      setShowCamera(false);
    }
  }, [isOpen]);

  const handleFaceCapture = (faceData: string) => {
    verifyFaceMutation.mutate(faceData);
  };

  const handleCancel = () => {
    setShowCamera(false);
    onClose();
  };

  const handlePinSuccess = () => {
    onSuccess();
    setShowPinDialog(false);
  };

  const handleUsePin = () => {
    setShowCamera(false);
    setShowPinDialog(true);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-w-[95vw] max-h-[95vh] overflow-y-auto">
        <DialogHeader className="px-4 sm:px-6">
          <DialogTitle className="text-lg sm:text-xl">
            {action === 'in' ? 'Clock In' : 'Clock Out'} - Face Verification
          </DialogTitle>
          <DialogDescription className="text-sm sm:text-base">
            Use face authentication to securely {action === 'in' ? 'clock in' : 'clock out'} for your attendance.
          </DialogDescription>
        </DialogHeader>
        <div className="px-4 sm:px-6 pb-4 sm:pb-6">
          {showCamera ? (
            <div className="space-y-4">
              <SimpleFaceCapture
                onCapture={handleFaceCapture}
                onCancel={handleCancel}
                title={`Verify Identity for Clock ${action === 'in' ? 'In' : 'Out'}`}
                description="Position your face within the frame to verify your identity"
              />
              {canUsePin && (
                <div className="text-center">
                  <Button 
                    variant="outline" 
                    onClick={handleUsePin}
                    className="w-full"
                  >
                    <KeyRound className="h-4 w-4 mr-2" />
                    Use PIN Instead
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center p-4 sm:p-6 space-y-4">
              <div className="mx-auto h-10 w-10 sm:h-12 sm:w-12 bg-primary rounded-full flex items-center justify-center mb-3 sm:mb-4">
                <User className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <h3 className="text-base sm:text-lg font-semibold mb-2">Face Verification</h3>
              <p className="text-gray-600 mb-4 sm:mb-6 text-sm sm:text-base">Prepare for face authentication</p>
              <div className="space-y-2">
                <Button onClick={() => setShowCamera(true)} className="w-full">
                  Start Face Verification
                </Button>
                {canUsePin && (
                  <Button 
                    variant="outline" 
                    onClick={handleUsePin}
                    className="w-full"
                  >
                    <KeyRound className="h-4 w-4 mr-2" />
                    Use PIN Instead
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* PIN Authentication Dialog */}
        <PinAuthDialog
          isOpen={showPinDialog}
          onClose={() => setShowPinDialog(false)}
          onSuccess={handlePinSuccess}
          action={action}
          location={location}
          userLocation={userLocation}
        />
      </DialogContent>
    </Dialog>
  );
}
