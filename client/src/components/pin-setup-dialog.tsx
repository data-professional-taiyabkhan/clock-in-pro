import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { Loader2, Eye, EyeOff, KeyRound, Shield } from 'lucide-react';
import { useToast } from '../hooks/use-toast';

interface PinSetupDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function PinSetupDialog({ isOpen, onClose, onSuccess }: PinSetupDialogProps) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);
  const [error, setError] = useState('');
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (pin.length < 4) {
      setError('PIN must be at least 4 digits');
      return;
    }

    if (pin !== confirmPin) {
      setError('PINs do not match');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/setup-pin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          pin,
          confirmPin
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "PIN Setup Complete",
          description: "Your PIN has been set up successfully. You can now use it as a backup authentication method.",
        });
        onSuccess();
        handleClose();
      } else {
        setError(data.message || 'Failed to set up PIN');
        toast({
          title: "PIN Setup Failed",
          description: data.message || 'Please try again',
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('PIN setup error:', error);
      setError('Network error. Please try again.');
      toast({
        title: "Error",
        description: "Failed to set up PIN. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setPin('');
    setConfirmPin('');
    setError('');
    setShowPin(false);
    setShowConfirmPin(false);
    onClose();
  };

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>, field: 'pin' | 'confirmPin') => {
    const value = e.target.value.replace(/\D/g, ''); // Only allow digits
    if (value.length <= 6) {
      if (field === 'pin') {
        setPin(value);
      } else {
        setConfirmPin(value);
      }
      setError('');
    }
  };

  const isValidPin = pin.length >= 4 && pin === confirmPin && pin.length <= 6;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Setup PIN Authentication
          </DialogTitle>
          <DialogDescription>
            Create a PIN as a backup authentication method for clocking in and out.
            This PIN will be used when face verification is not available.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pin">New PIN</Label>
            <div className="relative">
              <Input
                id="pin"
                type={showPin ? 'text' : 'password'}
                value={pin}
                onChange={(e) => handlePinChange(e, 'pin')}
                placeholder="Enter new PIN"
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPin">Confirm PIN</Label>
            <div className="relative">
              <Input
                id="confirmPin"
                type={showConfirmPin ? 'text' : 'password'}
                value={confirmPin}
                onChange={(e) => handlePinChange(e, 'confirmPin')}
                placeholder="Confirm your PIN"
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
                onClick={() => setShowConfirmPin(!showConfirmPin)}
                disabled={isLoading}
              >
                {showConfirmPin ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="text-xs text-muted-foreground">
            <p>• PIN must be 4-6 digits long</p>
            <p>• Use only numbers (0-9)</p>
            <p>• Choose a PIN you can remember easily</p>
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
              disabled={isLoading || !isValidPin}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Setting up...
                </>
              ) : (
                'Setup PIN'
              )}
            </Button>
          </div>
        </form>

        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            <strong>Security Notice:</strong> Your PIN is encrypted and stored securely. 
            It will be used as a backup authentication method when face verification is unavailable.
          </AlertDescription>
        </Alert>
      </DialogContent>
    </Dialog>
  );
}
