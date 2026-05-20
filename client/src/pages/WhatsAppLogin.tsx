import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare, ArrowRight, Shield, Loader2, CheckCircle2,
  RefreshCw, Lock, Fingerprint, Smartphone, ChevronDown, ChevronUp
} from "lucide-react";
import { getLoginUrl } from "@/const";
import {
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";

type Step = "phone" | "otp" | "success";
type AuthMode = "user" | "owner";

const RESEND_COOLDOWN = 60;

// ─── Passkey helpers ─────────────────────────────────────────────────────────

async function checkPasskeyAvailable(): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/passkey/auth-options", { method: "POST" });
    if (!res.ok) return false;
    const data = await res.json();
    return data.hasPasskeys === true;
  } catch {
    return false;
  }
}

async function loginWithPasskey(): Promise<{ success: boolean; error?: string }> {
  try {
    const optRes = await fetch("/api/auth/passkey/auth-options", { method: "POST" });
    if (!optRes.ok) return { success: false, error: "Failed to get passkey options" };
    const options = await optRes.json();

    const credential = await startAuthentication({ optionsJSON: options });

    const verifyRes = await fetch("/api/auth/passkey/auth-verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: credential }),
    });
    const verifyData = await verifyRes.json();
    if (!verifyRes.ok) return { success: false, error: verifyData.error || "Passkey verification failed" };
    return { success: true };
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "NotAllowedError") {
      return { success: false, error: "Touch ID was cancelled or not available" };
    }
    return { success: false, error: "Passkey authentication failed" };
  }
}

async function registerPasskey(passkeyName: string): Promise<{ success: boolean; error?: string }> {
  try {
    const optRes = await fetch("/api/auth/passkey/register-options", { method: "POST" });
    if (!optRes.ok) {
      const d = await optRes.json();
      return { success: false, error: d.error || "Failed to get registration options" };
    }
    const options = await optRes.json();

    const credential = await startRegistration({ optionsJSON: options });

    const verifyRes = await fetch("/api/auth/passkey/register-verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: credential, passkeyName }),
    });
    const verifyData = await verifyRes.json();
    if (!verifyRes.ok) return { success: false, error: verifyData.error || "Registration failed" };
    return { success: true };
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "NotAllowedError") {
      return { success: false, error: "Touch ID was cancelled" };
    }
    return { success: false, error: "Passkey registration failed" };
  }
}

// ─── OTP digit input ─────────────────────────────────────────────────────────

function OTPInput({ value, onChange, onComplete }: {
  value: string;
  onChange: (v: string) => void;
  onComplete: () => void;
}) {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  function handleChange(index: number, char: string) {
    const digit = char.replace(/\D/g, "").slice(-1);
    const newVal = value.split("");
    newVal[index] = digit;
    const joined = newVal.join("").slice(0, 6);
    onChange(joined);
    if (digit && index < 5) {
      inputs.current[index + 1]?.focus();
    }
    if (joined.length === 6) onComplete();
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !value[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
    if (e.key === "Enter" && value.length === 6) onComplete();
  }

  function handlePaste(e: React.ClipboardEvent) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length > 0) {
      onChange(pasted);
      if (pasted.length === 6) {
        setTimeout(onComplete, 50);
      } else {
        inputs.current[pasted.length]?.focus();
      }
    }
    e.preventDefault();
  }

  return (
    <div className="flex gap-2 justify-center" onPaste={handlePaste}>
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={(el) => { inputs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i] || ""}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          autoFocus={i === 0}
          className={`w-11 h-14 text-center text-2xl font-mono font-bold rounded-xl border-2 outline-none transition-all
            ${value[i]
              ? "border-primary bg-primary/5 text-foreground"
              : "border-border bg-background text-foreground"
            }
            focus:border-primary focus:ring-2 focus:ring-primary/20`}
        />
      ))}
    </div>
  );
}

// ─── Main login page ─────────────────────────────────────────────────────────

export default function WhatsAppLogin() {
  const [mode, setMode] = useState<AuthMode>("user");
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [maskedPhone, setMaskedPhone] = useState("");
  const [resendTimer, setResendTimer] = useState(0);
  const [passkeyAvailable, setPasskeyAvailable] = useState(false);
  const [showAltLogin, setShowAltLogin] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check if owner has a passkey registered
  useEffect(() => {
    checkPasskeyAvailable().then(setPasskeyAvailable);
  }, []);

  // Countdown timer
  useEffect(() => {
    if (resendTimer > 0) {
      timerRef.current = setInterval(() => {
        setResendTimer((t) => {
          if (t <= 1) { if (timerRef.current) clearInterval(timerRef.current); return 0; }
          return t - 1;
        });
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [resendTimer]);

  // ── Passkey login ──────────────────────────────────────────────────────────
  const handlePasskeyLogin = useCallback(async () => {
    setLoading(true);
    setError("");
    const result = await loginWithPasskey();
    if (result.success) {
      setStep("success");
      setTimeout(() => { window.location.href = "/"; }, 1200);
    } else {
      setError(result.error || "Passkey authentication failed");
    }
    setLoading(false);
  }, []);

  // Auto-trigger passkey if owner mode and passkey available
  useEffect(() => {
    if (mode === "owner" && passkeyAvailable && !loading) {
      handlePasskeyLogin();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, passkeyAvailable]);

  // ── OTP flow ───────────────────────────────────────────────────────────────
  async function requestOTP(isResend = false) {
    if (!phone.trim()) { setError("Please enter your WhatsApp number"); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/auth/whatsapp/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim(), name: name.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to send OTP"); return; }
      setMaskedPhone(data.phone || phone);
      if (!isResend) setStep("otp");
      setResendTimer(RESEND_COOLDOWN);
      if (isResend) setOtp("");
    } catch { setError("Network error. Please try again."); }
    finally { setLoading(false); }
  }

  async function verifyOTP() {
    if (otp.length !== 6) { setError("Please enter the 6-digit code"); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/auth/whatsapp/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim(), otp, name: name.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Invalid verification code"); return; }
      setStep("success");
      setTimeout(() => { window.location.href = data.redirectTo || "/"; }, 1200);
    } catch { setError("Network error. Please try again."); }
    finally { setLoading(false); }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (step === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0d1b2e] via-[#111827] to-[#0d1b2e]">
        <div className="flex flex-col items-center gap-4 text-white">
          <CheckCircle2 className="w-20 h-20 text-emerald-400 animate-bounce" />
          <p className="text-xl font-semibold">Signed in successfully</p>
          <p className="text-white/50 text-sm">Taking you to the dashboard...</p>
          <Loader2 className="w-5 h-5 animate-spin text-white/40" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0d1b2e] via-[#111827] to-[#0d1b2e] p-4">
      <div className="w-full max-w-md space-y-5">

        {/* Logo */}
        <div className="flex items-center justify-center py-2">
          <img
            src="https://d2xsxph8kpxj0f.cloudfront.net/310419663030942069/HgSVP8jV8ZSftqvVvjqzZM/matchpro-logo-transparent_4567f9fe.png"
            alt="MatchPro™ by Crystal Power Investments"
            className="h-36 w-auto object-contain drop-shadow-2xl"
          />
        </div>

        {/* ── OWNER: Touch ID card ── */}
        {passkeyAvailable && (
          <Card className="border-white/10 bg-gradient-to-br from-[#1a2744] to-[#0f1e38] shadow-2xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 to-transparent pointer-events-none" />
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-teal-500/20 flex items-center justify-center">
                    <Fingerprint className="h-4 w-4 text-teal-400" />
                  </div>
                  <div>
                    <CardTitle className="text-white text-base">Owner Access</CardTitle>
                    <CardDescription className="text-white/50 text-xs">Touch ID · Face ID · Windows Hello</CardDescription>
                  </div>
                </div>
                <Badge variant="outline" className="border-teal-500/30 text-teal-400 text-xs">
                  Biometric
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pb-4">
              {error && mode === "owner" && (
                <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2 mb-3">
                  <Lock className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              <Button
                onClick={() => { setMode("owner"); setError(""); handlePasskeyLogin(); }}
                disabled={loading}
                className="w-full bg-teal-600 hover:bg-teal-500 text-white h-12 text-base font-medium rounded-xl"
              >
                {loading && mode === "owner" ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Verifying...</>
                ) : (
                  <><Fingerprint className="w-5 h-5 mr-2" /> Sign in with Touch ID</>
                )}
              </Button>
              <p className="text-center text-xs text-white/30 mt-2">
                Uses your MacBook's secure enclave — no password needed
              </p>
            </CardContent>
          </Card>
        )}

        {/* ── USERS: WhatsApp OTP card ── */}
        <Card className="border-white/10 shadow-2xl bg-white/95 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                <Smartphone className="h-4 w-4 text-green-600" />
              </div>
              <div>
                {step === "phone" && (
                  <>
                    <CardTitle className="text-base">Sign in with WhatsApp</CardTitle>
                    <CardDescription className="text-xs">Enter your number to receive a verification code</CardDescription>
                  </>
                )}
                {step === "otp" && (
                  <>
                    <CardTitle className="text-base">Enter verification code</CardTitle>
                    <CardDescription className="text-xs">
                      Sent to WhatsApp ···{maskedPhone.slice(-4)}
                    </CardDescription>
                  </>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {step === "phone" && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-xs font-medium">Your name (optional)</Label>
                  <Input
                    id="name"
                    placeholder="e.g. Ahmed Mohamed"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && requestOTP(false)}
                    disabled={loading}
                    className="h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone" className="text-xs font-medium">WhatsApp number</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">🇪🇬</span>
                    <Input
                      id="phone"
                      placeholder="01012345678"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && requestOTP(false)}
                      disabled={loading}
                      type="tel"
                      className="h-11 pl-10"
                      autoFocus
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Start with 01 or +20</p>
                </div>
                {error && (
                  <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                    <Lock className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
                <Button
                  onClick={() => requestOTP(false)}
                  disabled={loading || !phone.trim()}
                  className="w-full h-11"
                  size="lg"
                >
                  {loading ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending code...</>
                  ) : (
                    <><MessageSquare className="w-4 h-4 mr-2" /> Send verification code</>
                  )}
                </Button>
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => { setPhone(""); setName(""); setError(""); }}
                    className="text-xs text-muted-foreground hover:text-primary underline underline-offset-2 transition-colors"
                  >
                    Forgot / Changed your number?
                  </button>
                </div>
              </>
            )}

            {step === "otp" && (
              <>
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-center text-green-800">
                  Code sent to WhatsApp ···{maskedPhone.slice(-4)}
                </div>

                {/* Segmented OTP input */}
                <div className="space-y-3">
                  <Label className="text-xs font-medium text-center block">6-digit code</Label>
                  <OTPInput
                    value={otp}
                    onChange={(v) => { setOtp(v); setError(""); }}
                    onComplete={verifyOTP}
                  />
                  <p className="text-xs text-muted-foreground text-center">Code expires in 10 minutes</p>
                </div>

                {error && (
                  <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                    <Lock className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <Button
                  onClick={verifyOTP}
                  disabled={loading || otp.length !== 6}
                  className="w-full h-11"
                  size="lg"
                >
                  {loading ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verifying...</>
                  ) : (
                    <><ArrowRight className="w-4 h-4 mr-2" /> Verify & sign in</>
                  )}
                </Button>

                <div className="flex items-center justify-between">
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => requestOTP(true)}
                    disabled={loading || resendTimer > 0}
                    className="text-xs"
                  >
                    {resendTimer > 0 ? (
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <RefreshCw className="w-3 h-3" />
                        Resend in {resendTimer}s
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5">
                        <RefreshCw className="w-3 h-3" />
                        Resend code
                      </span>
                    )}
                  </Button>
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => { setStep("phone"); setOtp(""); setError(""); }}
                    disabled={loading}
                    className="text-xs text-muted-foreground"
                  >
                    Change number
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* ── Setup passkey (shown only when no passkey registered yet) ── */}
        {!passkeyAvailable && (
          <div className="text-center">
            <button
              type="button"
              onClick={() => setShowAltLogin(!showAltLogin)}
              className="text-xs text-white/40 hover:text-white/60 flex items-center gap-1 mx-auto transition-colors"
            >
              {showAltLogin ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              Owner options
            </button>
            {showAltLogin && (
              <div className="mt-3 space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    setLoading(true); setError("");
                    const result = await registerPasskey("MacBook Touch ID");
                    if (result.success) {
                      setPasskeyAvailable(true);
                    } else {
                      setError(result.error || "Registration failed");
                    }
                    setLoading(false);
                  }}
                  disabled={loading}
                  className="w-full bg-white/10 border-white/20 text-white hover:bg-white/20 text-xs h-9"
                >
                  {loading ? <Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> : <Fingerprint className="w-3 h-3 mr-1.5" />}
                  Register Touch ID (first-time setup)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { window.location.href = getLoginUrl(); }}
                  className="w-full bg-white/5 border-white/10 text-white/50 hover:bg-white/10 text-xs h-9"
                >
                  Sign in with email / Google
                </Button>
              </div>
            )}
          </div>
        )}

        <p className="text-center text-xs text-white/30 flex items-center justify-center gap-1">
          <Shield className="w-3 h-3" />
          Secured by Crystal Power Investments · PDPL Compliant
        </p>
      </div>
    </div>
  );
}
