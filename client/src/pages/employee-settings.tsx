import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AdvancedFaceTraining } from "@/components/advanced-face-training";
import {
    KeyRound,
    ShieldCheck,
    ShieldOff,
    Camera,
    Trash2,
    CheckCircle,
    AlertTriangle,
    Loader2,
} from "lucide-react";

/**
 * Employee Settings Panel — PIN setup, biometric consent, face data management.
 * Intended to be rendered inside the employee dashboard.
 */
export default function EmployeeSettings() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [pinValue, setPinValue] = useState("");
    const [confirmPin, setConfirmPin] = useState("");
    const [showPinForm, setShowPinForm] = useState(false);
    const [showConsentForm, setShowConsentForm] = useState(false);
    const [showFaceRegistration, setShowFaceRegistration] = useState(false);

    // Fetch current user
    const { data: user } = useQuery<any>({
        queryKey: ["/api/user"],
    });

    // Fetch consent status
    const { data: consent } = useQuery<any>({
        queryKey: ["/api/user/consent"],
        retry: false,
    });

    // ── PIN Setup ──
    const setupPinMutation = useMutation({
        mutationFn: async (pin: string) => {
            return apiRequest("/api/user/setup-pin", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pin }),
            });
        },
        onSuccess: () => {
            toast({ title: "PIN set successfully", description: "You can now clock in using your PIN." });
            setPinValue("");
            setConfirmPin("");
            setShowPinForm(false);
            queryClient.invalidateQueries({ queryKey: ["/api/user"] });
        },
        onError: (err: Error) => {
            toast({ title: "Failed to set PIN", description: err.message, variant: "destructive" });
        },
    });

    const disablePinMutation = useMutation({
        mutationFn: async () => {
            return apiRequest("/api/user/pin", { method: "DELETE" });
        },
        onSuccess: () => {
            toast({ title: "PIN disabled" });
            queryClient.invalidateQueries({ queryKey: ["/api/user"] });
        },
        onError: (err: Error) => {
            toast({ title: "Failed", description: err.message, variant: "destructive" });
        },
    });

    // ── Consent ──
    const grantConsentMutation = useMutation({
        mutationFn: async () => {
            return apiRequest("/api/user/consent", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ consentType: "biometric_face", policyVersion: "1.0" }),
            });
        },
        onSuccess: () => {
            toast({ title: "Consent granted", description: "You can now use face verification for clock-in." });
            setShowConsentForm(false);
            queryClient.invalidateQueries({ queryKey: ["/api/user/consent"] });
        },
        onError: (err: Error) => {
            toast({ title: "Failed", description: err.message, variant: "destructive" });
        },
    });

    // ── Delete Face Data ──
    const deleteFaceDataMutation = useMutation({
        mutationFn: async () => {
            return apiRequest("/api/user/face-data", { method: "DELETE" });
        },
        onSuccess: () => {
            toast({ title: "Face data deleted", description: "Your biometric data has been permanently removed." });
            queryClient.invalidateQueries({ queryKey: ["/api/user"] });
            queryClient.invalidateQueries({ queryKey: ["/api/user/consent"] });
        },
        onError: (err: Error) => {
            toast({ title: "Failed", description: err.message, variant: "destructive" });
        },
    });

    const handleSetPin = () => {
        if (pinValue.length < 4 || pinValue.length > 8) {
            toast({ title: "PIN must be 4–8 digits", variant: "destructive" });
            return;
        }
        if (!/^\d+$/.test(pinValue)) {
            toast({ title: "PIN must contain only digits", variant: "destructive" });
            return;
        }
        if (pinValue !== confirmPin) {
            toast({ title: "PINs don't match", variant: "destructive" });
            return;
        }
        setupPinMutation.mutate(pinValue);
    };

    // ── Face Registration ──
    const registerFaceMutation = useMutation({
        mutationFn: async (trainingData: string) => {
            return apiRequest("/api/register-face", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ faceData: trainingData }),
            });
        },
        onSuccess: () => {
            toast({ title: "Face registered", description: "Face verification is now set up. You can clock in with your face." });
            setShowFaceRegistration(false);
            queryClient.invalidateQueries({ queryKey: ["/api/user"] });
        },
        onError: (err: Error) => {
            toast({ title: "Registration failed", description: err.message, variant: "destructive" });
        },
    });

    const hasFaceData = !!user?.faceRegistered;
    const hasPin = !!user?.pinEnabled;
    const hasConsent = consent?.hasActiveConsent;

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold">Clock-In Settings</h2>
                <p className="text-muted-foreground mt-1">Manage your PIN, biometric consent, and face data.</p>
            </div>

            {/* ── Clock-In Method Status ── */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Clock-In Methods</CardTitle>
                    <CardDescription>You can use face verification, PIN, or both.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Camera className="h-5 w-5 text-blue-600" />
                            <span className="font-medium">Face Verification</span>
                        </div>
                        <div className="flex items-center gap-2">
                            {hasFaceData && hasConsent ? (
                                <Badge className="bg-green-100 text-green-800">Active</Badge>
                            ) : (
                                <Badge variant="secondary">Inactive</Badge>
                            )}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowFaceRegistration(true)}
                            >
                                <Camera className="h-3 w-3 mr-1" />
                                {hasFaceData ? "Re-register face" : "Set up face verification"}
                            </Button>
                        </div>
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <KeyRound className="h-5 w-5 text-purple-600" />
                            <span className="font-medium">PIN Code</span>
                        </div>
                        {hasPin ? (
                            <Badge className="bg-green-100 text-green-800">Active</Badge>
                        ) : (
                            <Badge variant="secondary">Not set</Badge>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* ── Face Registration (inline) ── */}
            {showFaceRegistration && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Camera className="h-5 w-5" /> {hasFaceData ? "Re-register Face" : "Set Up Face Verification"}
                        </CardTitle>
                        <CardDescription>
                            Complete the face training flow below to {hasFaceData ? "update" : "enable"} face clock-in.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <AdvancedFaceTraining
                            onComplete={(trainingData: string) => registerFaceMutation.mutate(trainingData)}
                            onCancel={() => setShowFaceRegistration(false)}
                        />
                    </CardContent>
                </Card>
            )}

            {/* ── PIN Management ── */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <KeyRound className="h-5 w-5" /> PIN Setup
                    </CardTitle>
                    <CardDescription>
                        Set a 4–8 digit PIN as an alternative to face verification.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {!showPinForm ? (
                        <div className="flex gap-3">
                            <Button onClick={() => setShowPinForm(true)} variant={hasPin ? "outline" : "default"}>
                                {hasPin ? "Change PIN" : "Set up PIN"}
                            </Button>
                            {hasPin && (
                                <Button
                                    variant="destructive"
                                    onClick={() => disablePinMutation.mutate()}
                                    disabled={disablePinMutation.isPending}
                                >
                                    {disablePinMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                    Disable PIN
                                </Button>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4 max-w-sm">
                            <div className="space-y-1.5">
                                <Label htmlFor="pin">New PIN (4–8 digits)</Label>
                                <Input
                                    id="pin"
                                    type="password"
                                    inputMode="numeric"
                                    maxLength={8}
                                    placeholder="Enter PIN"
                                    value={pinValue}
                                    onChange={(e) => setPinValue(e.target.value.replace(/\D/g, ""))}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="confirmPin">Confirm PIN</Label>
                                <Input
                                    id="confirmPin"
                                    type="password"
                                    inputMode="numeric"
                                    maxLength={8}
                                    placeholder="Re-enter PIN"
                                    value={confirmPin}
                                    onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
                                />
                            </div>
                            <div className="flex gap-3">
                                <Button onClick={handleSetPin} disabled={setupPinMutation.isPending}>
                                    {setupPinMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                    Save PIN
                                </Button>
                                <Button variant="ghost" onClick={() => { setShowPinForm(false); setPinValue(""); setConfirmPin(""); }}>
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* ── Biometric Consent ── */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                        {hasConsent ? <ShieldCheck className="h-5 w-5 text-green-600" /> : <ShieldOff className="h-5 w-5 text-amber-600" />}
                        Biometric Consent
                    </CardTitle>
                    <CardDescription>
                        Face verification requires your explicit consent. You can withdraw consent at any time.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {hasConsent ? (
                        <div className="space-y-3">
                            <Alert>
                                <CheckCircle className="h-4 w-4" />
                                <AlertDescription>
                                    You have granted biometric consent (policy v{consent?.policyVersion || "1.0"}).
                                    You can withdraw your consent and delete your face data at any time.
                                </AlertDescription>
                            </Alert>
                        </div>
                    ) : !showConsentForm ? (
                        <div className="space-y-3">
                            <Alert>
                                <AlertTriangle className="h-4 w-4" />
                                <AlertDescription>
                                    You have not granted biometric consent. To use face verification for clock-in,
                                    you must read and accept the biometric data policy.
                                </AlertDescription>
                            </Alert>
                            <Button onClick={() => setShowConsentForm(true)}>
                                Review &amp; Grant Consent
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-4 max-w-lg">
                            <div className="bg-slate-50 rounded-lg p-4 text-sm space-y-2 border">
                                <h4 className="font-semibold">Biometric Data Policy (v1.0)</h4>
                                <ul className="list-disc list-inside space-y-1 text-slate-700">
                                    <li>Your face image will be captured and stored securely on encrypted servers.</li>
                                    <li>Face data is used <b>only</b> for clock-in/out verification — never shared or sold.</li>
                                    <li>You can <b>withdraw consent</b> and <b>delete all face data</b> at any time.</li>
                                    <li>If you withdraw consent, you must use PIN to clock in.</li>
                                    <li>Face data is encrypted at rest and in transit.</li>
                                    <li>Your organisation's administrator can configure automatic data retention periods.</li>
                                </ul>
                            </div>
                            <div className="flex gap-3">
                                <Button onClick={() => grantConsentMutation.mutate()} disabled={grantConsentMutation.isPending}>
                                    {grantConsentMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                    I Agree — Grant Consent
                                </Button>
                                <Button variant="ghost" onClick={() => setShowConsentForm(false)}>Cancel</Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* ── Face Data Management ── */}
            {(hasFaceData || hasConsent) && (
                <>
                    <Separator />
                    <Card className="border-red-200">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg flex items-center gap-2 text-red-700">
                                <Trash2 className="h-5 w-5" /> Delete Face Data
                            </CardTitle>
                            <CardDescription>
                                Permanently delete your stored face image, revoke biometric consent,
                                and switch to PIN-only clock-in. This cannot be undone.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button
                                variant="destructive"
                                onClick={() => {
                                    if (window.confirm("Are you sure? This will permanently delete your face data and revoke biometric consent. You will need to use PIN to clock in.")) {
                                        deleteFaceDataMutation.mutate();
                                    }
                                }}
                                disabled={deleteFaceDataMutation.isPending}
                            >
                                {deleteFaceDataMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                Delete All Face Data &amp; Revoke Consent
                            </Button>
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    );
}
