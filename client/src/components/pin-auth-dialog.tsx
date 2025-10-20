import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { Loader2, Eye, EyeOff, KeyRound } from 'lucide-react';
import { useToast } from '../hooks/use-toast';

interface PinAuthDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (data: any) => void;
  action?: 'in' | 'out';
  location?: { latitude: number; longitude: number };
  userLocation?: { latitude: number; longitude: number };
}

export function PinAuthDialog({ 
  isOpen, 
  onClose, 
  onSuccess, 
  action = 'in',
  location,
  userLocation 
}: PinAuthDialogProps) {
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState('');
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (pin.length < 4) {
      setError('PIN must be at least 4 digits');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/verify-pin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          pin,
          action,
          location,
          userLocation
        }),
      });

      const data = await response.json();

      if (response.ok && data.verified) {
        toast({
          title: "PIN Verified Successfully",
          description: data.message,
        });
        onSuccess(data);
        setPin('');
        onClose();
      } else {
        setError(data.message || 'PIN verification failed');
        toast({
          title: "PIN Verification Failed",
          description: data.message || 'Please try again',
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('PIN verification error:', error);
      setError('Network error. Please try again.');
      toast({
        title: "Error",
        description: "Failed to verify PIN. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setPin('');
    setError('');
    setShowPin(false);
    onClose();
  };

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, ''); // Only allow digits
    if (value.length <= 6) {
      setPin(value);
      setError('');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            PIN Authentication
          </DialogTitle>
          <DialogDescription>
            Enter your PIN to clock {action === 'in' ? 'in' : 'out'}.
            {action === 'in' && " This is a backup method when face verification is not available."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pin">PIN</Label>
            <div className="relative">
              <Input
                id="pin"
                type={showPin ? 'text' : 'password'}
                value={pin}
                onChange={handlePinChange}
                placeholder="Enter your PIN"
                className="pr-10"
                maxLength={6}
                autoComplete="off"
                disabled={isLoading}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowPin(!showPin)}
                disabled={isLoading}
              >
                {showPin ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              4-6 digit PIN
            </p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="flex-1"
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={isLoading || pin.length < 4}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                `Clock ${action === 'in' ? 'In' : 'Out'}`
              )}
            </Button>
          </div>
        </form>

        <div className="text-xs text-muted-foreground text-center">
          <p>Using PIN authentication for security backup</p>
          <p>Your manager will be notified of this verification method</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
