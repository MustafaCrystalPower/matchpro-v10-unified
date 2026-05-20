import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, MessageCircle, Building2, TrendingUp, Shield } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

type JoinState = "loading" | "valid" | "invalid" | "expired" | "verifying" | "success";

export default function JoinPage() {
  const [, setLocation] = useLocation();
  const [state, setState] = useState<JoinState>("loading");
  const [token, setToken] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [name, setName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getByTokenQuery = trpc.onboarding.getByToken.useQuery(
    { token },
    { enabled: token.length > 0 && state === 'valid' }
  );
  const completeMutation = trpc.onboarding.complete.useMutation();

  useEffect(() => {
    // Extract token from URL: /join/:token or ?token=xxx
    const path = window.location.pathname;
    const search = window.location.search;
    const pathToken = path.split("/join/")[1];
    const urlParams = new URLSearchParams(search);
    const queryToken = urlParams.get("token");
    const foundToken = pathToken || queryToken || "";

    if (!foundToken) {
      setState("invalid");
      return;
    }

    setToken(foundToken);

    // Validate token format (JWT has 3 parts)
    const parts = foundToken.split(".");
    if (parts.length !== 3) {
      setState("invalid");
      return;
    }

    // Try to decode payload to check expiry
    try {
      const payload = JSON.parse(atob(parts[1]));
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < now) {
        setState("expired");
        return;
      }
      if (payload.phone) {
        setPhoneNumber(payload.phone);
      }
    } catch {
      // Can't decode, still try
    }

    setState("valid");
  }, []);

  const handleJoin = async () => {
    if (!phoneNumber.trim()) {
      toast.error("Please enter your WhatsApp number");
      return;
    }
    if (!name.trim()) {
      toast.error("Please enter your name");
      return;
    }

    setIsSubmitting(true);
    setState("verifying");

    try {
      const result = await completeMutation.mutateAsync({
        token,
      });

      if (result.success) {
        setState("success");
        toast.success("Welcome to MatchPro™! Redirecting to dashboard...");
        setTimeout(() => {
          window.location.href = "/";
        }, 2000);
      } else {
        setState("valid");
        toast.error("Verification failed. Please try again.");
      }
    } catch (error: any) {
      setState("valid");
      toast.error(error?.message || "Failed to verify. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center shadow-lg">
              <Building2 className="w-7 h-7 text-white" />
            </div>
            <div className="text-left">
              <h1 className="text-2xl font-bold text-white">MatchPro™</h1>
              <p className="text-xs text-amber-400 font-medium">Crystal Power Intelligence</p>
            </div>
          </div>
          <p className="text-slate-400 text-sm">Real Estate Intelligence Platform</p>
        </div>

        {/* State: Loading */}
        {state === "loading" && (
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="w-10 h-10 animate-spin text-amber-400" />
              <p className="text-slate-300">Validating your invitation...</p>
            </CardContent>
          </Card>
        )}

        {/* State: Invalid */}
        {state === "invalid" && (
          <Card className="bg-slate-800 border-red-800">
            <CardHeader className="text-center">
              <XCircle className="w-12 h-12 text-red-400 mx-auto mb-2" />
              <CardTitle className="text-white">Invalid Invitation</CardTitle>
              <CardDescription className="text-slate-400">
                This invitation link is invalid or has already been used.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-400 text-center">
                Please ask your administrator to generate a new invitation QR code.
              </p>
            </CardContent>
          </Card>
        )}

        {/* State: Expired */}
        {state === "expired" && (
          <Card className="bg-slate-800 border-orange-800">
            <CardHeader className="text-center">
              <XCircle className="w-12 h-12 text-orange-400 mx-auto mb-2" />
              <CardTitle className="text-white">Invitation Expired</CardTitle>
              <CardDescription className="text-slate-400">
                This invitation link has expired (valid for 15 minutes).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-400 text-center">
                Please scan a fresh QR code or ask for a new invitation link.
              </p>
            </CardContent>
          </Card>
        )}

        {/* State: Valid — Show Join Form */}
        {(state === "valid" || state === "verifying") && (
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <div className="flex items-center gap-2 mb-1">
                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">
                  You're invited
                </Badge>
              </div>
              <CardTitle className="text-white">Join MatchPro™</CardTitle>
              <CardDescription className="text-slate-400">
                Complete your profile to start receiving personalized property matches via WhatsApp.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Benefits */}
              <div className="grid grid-cols-3 gap-3 py-3 border-y border-slate-700">
                <div className="text-center space-y-1">
                  <MessageCircle className="w-5 h-5 text-green-400 mx-auto" />
                  <p className="text-xs text-slate-400">WhatsApp Alerts</p>
                </div>
                <div className="text-center space-y-1">
                  <TrendingUp className="w-5 h-5 text-blue-400 mx-auto" />
                  <p className="text-xs text-slate-400">Smart Matches</p>
                </div>
                <div className="text-center space-y-1">
                  <Shield className="w-5 h-5 text-amber-400 mx-auto" />
                  <p className="text-xs text-slate-400">Secure Access</p>
                </div>
              </div>

              {/* Form */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-slate-300 text-sm">Full Name *</Label>
                  <Input
                    id="name"
                    placeholder="Mo'men Maisara"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500 focus:border-amber-400"
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-slate-300 text-sm">
                    WhatsApp Number *
                    <span className="text-slate-500 font-normal ml-1">(with country code)</span>
                  </Label>
                  <Input
                    id="phone"
                    placeholder="+201066505665"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500 focus:border-amber-400 font-mono"
                    disabled={isSubmitting}
                  />
                  <p className="text-xs text-slate-500">
                    You'll receive a confirmation message on this number.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="org" className="text-slate-300 text-sm">
                    Company / Agency
                    <span className="text-slate-500 font-normal ml-1">(optional)</span>
                  </Label>
                  <Input
                    id="org"
                    placeholder="Crystal Power Investments"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500 focus:border-amber-400"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <Button
                onClick={handleJoin}
                disabled={isSubmitting || !name.trim() || !phoneNumber.trim()}
                className="w-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold h-11"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Join via WhatsApp
                  </>
                )}
              </Button>

              <p className="text-xs text-slate-500 text-center">
                By joining, you agree to receive WhatsApp notifications for property matches.
                You can unsubscribe at any time.
              </p>
            </CardContent>
          </Card>
        )}

        {/* State: Success */}
        {state === "success" && (
          <Card className="bg-slate-800 border-green-800">
            <CardHeader className="text-center">
              <CheckCircle2 className="w-14 h-14 text-green-400 mx-auto mb-2" />
              <CardTitle className="text-white text-xl">Welcome to MatchPro™!</CardTitle>
              <CardDescription className="text-slate-400">
                Your account has been created. Check WhatsApp for your confirmation message.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <div className="bg-green-900/30 border border-green-800 rounded-lg p-4">
                <p className="text-green-300 text-sm">
                  A welcome message has been sent to your WhatsApp. Redirecting to dashboard...
                </p>
              </div>
              <Loader2 className="w-6 h-6 animate-spin text-amber-400 mx-auto" />
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-slate-600">
          Crystal Power Intelligence · Real Estate Platform · Cairo, Egypt
        </p>
      </div>
    </div>
  );
}
