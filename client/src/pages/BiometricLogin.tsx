import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Fingerprint, Camera, Lock, LogIn, AlertCircle } from "lucide-react";

export function BiometricLogin() {
  const [method, setMethod] = useState<"fingerprint" | "face" | "passcode">("passcode");
  const [passcode, setPasscode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isFaceAvailable, setIsFaceAvailable] = useState(false);
  const [isFingerprintAvailable, setIsFingerprintAvailable] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [faceStream, setFaceStream] = useState<MediaStream | null>(null);

  const CORRECT_PASSCODE = "166161";

  // Check for biometric APIs
  useEffect(() => {
    const checkBiometrics = async () => {
      try {
        // Check for WebAuthn/Fingerprint
        if (typeof window !== 'undefined' && window.PublicKeyCredential) {
          const available = await (window.PublicKeyCredential as any).isUserVerifyingPlatformAuthenticatorAvailable();
          setIsFingerprintAvailable(available);
        }

        // Check for Face API (using getUserMedia)
        if (typeof navigator !== 'undefined' && (navigator as any).mediaDevices && (navigator as any).mediaDevices.getUserMedia) {
          setIsFaceAvailable(true);
        }
      } catch (error) {
        console.error("Biometric check error:", error);
      }
    };

    checkBiometrics();
  }, []);

  // Start face recognition
  const startFaceRecognition = async () => {
    try {
      setIsLoading(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setFaceStream(stream);
      }
    } catch (error) {
      console.error("Face recognition error:", error);
      toast.error("Camera access denied. Please use passcode instead.");
      setMethod("passcode");
    } finally {
      setIsLoading(false);
    }
  };

  // Stop face recognition
  const stopFaceRecognition = () => {
    if (faceStream) {
      faceStream.getTracks().forEach(track => track.stop());
      setFaceStream(null);
    }
  };

  // Capture face and verify (mock implementation)
  const captureFace = async () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext("2d");
      if (context) {
        context.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
        
        // Mock face verification - in real app, send to backend for ML verification
        toast.success("Face recognized! Logging in...");
        stopFaceRecognition();
        handleLogin("face");
      }
    }
  };

  // Fingerprint authentication (mock)
  const handleFingerprint = async () => {
    try {
      setIsLoading(true);
      
      // Mock WebAuthn authentication
      if (window.PublicKeyCredential) {
        toast.info("Place your finger on the sensor...");
        
        // Simulate fingerprint reading delay
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        toast.success("Fingerprint verified! Logging in...");
        handleLogin("fingerprint");
      }
    } catch (error) {
      console.error("Fingerprint error:", error);
      toast.error("Fingerprint authentication failed");
    } finally {
      setIsLoading(false);
    }
  };

  // Passcode authentication
  const handlePasscodeSubmit = () => {
    if (passcode === CORRECT_PASSCODE) {
      handleLogin("passcode");
    } else {
      toast.error("Incorrect passcode");
      setPasscode("");
    }
  };

  // Mock login handler
  const handleLogin = async (method: string) => {
    setIsLoading(true);
    try {
      // In a real app, this would call your authentication API
      console.log(`Logged in via ${method}`);
      toast.success(`Successfully authenticated via ${method}`);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Redirect to dashboard
      window.location.href = "/";
    } catch (error) {
      toast.error("Authentication failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="space-y-2 text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-blue-100 p-3 rounded-full">
              <Lock className="w-8 h-8 text-blue-600" />
            </div>
          </div>
          <CardTitle className="text-2xl">MatchPro™ Login</CardTitle>
          <CardDescription>Choose your authentication method</CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Method Selection */}
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant={method === "passcode" ? "default" : "outline"}
              onClick={() => {
                setMethod("passcode");
                stopFaceRecognition();
              }}
              className="flex flex-col items-center gap-1 h-auto py-3"
              disabled={isLoading}
            >
              <Lock className="w-5 h-5" />
              <span className="text-xs">Passcode</span>
            </Button>

            <Button
              variant={method === "fingerprint" ? "default" : "outline"}
              onClick={() => {
                setMethod("fingerprint");
                stopFaceRecognition();
              }}
              disabled={!isFingerprintAvailable || isLoading}
              className="flex flex-col items-center gap-1 h-auto py-3"
            >
              <Fingerprint className="w-5 h-5" />
              <span className="text-xs">Fingerprint</span>
            </Button>

            <Button
              variant={method === "face" ? "default" : "outline"}
              onClick={() => {
                setMethod("face");
                if (!faceStream) startFaceRecognition();
              }}
              disabled={!isFaceAvailable || isLoading}
              className="flex flex-col items-center gap-1 h-auto py-3"
            >
              <Camera className="w-5 h-5" />
              <span className="text-xs">Face ID</span>
            </Button>
          </div>

          {/* Passcode Method */}
          {method === "passcode" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Enter Passcode</label>
                <Input
                  type="password"
                  placeholder="Enter 6-digit passcode"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value.slice(0, 6))}
                  onKeyPress={(e) => e.key === "Enter" && handlePasscodeSubmit()}
                  maxLength={6}
                  className="text-center text-2xl tracking-widest font-mono"
                  disabled={isLoading}
                />
              </div>
              <Button
                onClick={handlePasscodeSubmit}
                disabled={passcode.length !== 6 || isLoading}
                className="w-full gap-2 bg-blue-600 hover:bg-blue-700"
              >
                <LogIn className="w-4 h-4" />
                {isLoading ? "Verifying..." : "Login"}
              </Button>
            </div>
          )}

          {/* Fingerprint Method */}
          {method === "fingerprint" && (
            <div className="space-y-4">
              <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-8 flex flex-col items-center gap-4">
                <Fingerprint className="w-12 h-12 text-blue-600 animate-pulse" />
                <div className="text-center">
                  <p className="font-medium text-sm">Ready for fingerprint</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Place your finger on the sensor
                  </p>
                </div>
              </div>
              <Button
                onClick={handleFingerprint}
                disabled={isLoading}
                className="w-full gap-2 bg-blue-600 hover:bg-blue-700"
              >
                <Fingerprint className="w-4 h-4" />
                {isLoading ? "Scanning..." : "Start Fingerprint Scan"}
              </Button>
            </div>
          )}

          {/* Face Recognition Method */}
          {method === "face" && (
            <div className="space-y-4">
              {!faceStream ? (
                <Button
                  onClick={startFaceRecognition}
                  disabled={isLoading}
                  className="w-full gap-2 bg-blue-600 hover:bg-blue-700"
                >
                  <Camera className="w-4 h-4" />
                  {isLoading ? "Starting..." : "Start Camera"}
                </Button>
              ) : (
                <>
                  <div className="relative bg-black rounded-lg overflow-hidden">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      className="w-full h-64 object-cover"
                    />
                    <canvas
                      ref={canvasRef}
                      className="hidden"
                      width={1280}
                      height={720}
                    />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-32 h-40 border-2 border-green-500 rounded-lg opacity-50" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={captureFace}
                      disabled={isLoading}
                      className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
                    >
                      <Camera className="w-4 h-4" />
                      Capture & Verify
                    </Button>
                    <Button
                      onClick={stopFaceRecognition}
                      variant="outline"
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Availability Warnings */}
          {!isFingerprintAvailable && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-700">
                Fingerprint authentication not available on this device
              </p>
            </div>
          )}

          {!isFaceAvailable && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-700">
                Face recognition requires camera access
              </p>
            </div>
          )}

          {/* Demo Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-900">
              <strong>Demo Passcode:</strong> 166161
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
