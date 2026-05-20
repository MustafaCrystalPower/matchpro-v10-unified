import { useLocation } from "wouter";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function Login() {
  const [, setLocation] = useLocation();
  // Auth check removed - DashboardLayout handles redirects
  // This prevents login page from flashing/disappearing

  const handleLogin = () => {
    const loginUrl = getLoginUrl();
    window.location.href = loginUrl;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      {/* Background accent */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl"></div>
      </div>

      {/* Login Card */}
      <Card className="relative w-full max-w-md p-8 bg-slate-900/80 backdrop-blur border-emerald-500/20 shadow-2xl">
          {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 mb-4 shadow-lg">
            <span className="text-3xl font-bold text-white">M</span>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-400 to-emerald-300 bg-clip-text text-transparent mb-2">MatchPro™</h1>
          <p className="text-sm text-slate-300">The market is talking. Are you listening?</p>
        </div>

        {/* Main Content */}
        <div className="space-y-6">
          {/* Headline */}
          <div className="text-center">
            <h2 className="text-xl font-semibold text-white mb-2">
              Welcome Back
            </h2>
            <p className="text-sm text-slate-400">
              Sign in to access your real estate matching dashboard
            </p>
          </div>

          {/* Features */}
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center mt-0.5">
                <span className="text-xs text-emerald-400">✓</span>
              </div>
              <div>
                <p className="text-sm font-medium text-white">Real-time Matching</p>
                <p className="text-xs text-slate-400">Instant supply & demand matching</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center mt-0.5">
                <span className="text-xs text-emerald-400">✓</span>
              </div>
              <div>
                <p className="text-sm font-medium text-white">Daily Reports</p>
                <p className="text-xs text-slate-400">9 AM Excel sheets & WhatsApp summaries</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center mt-0.5">
                <span className="text-xs text-emerald-400">✓</span>
              </div>
              <div>
                <p className="text-sm font-medium text-white">Market Intelligence</p>
                <p className="text-xs text-slate-400">Live heatmaps & area insights</p>
              </div>
            </div>
          </div>

          {/* Login Button */}
          <Button
            onClick={handleLogin}
            className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-semibold py-3 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            Sign In with MatchPro
          </Button>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-700"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-slate-900/80 text-slate-400">Secure Authentication</span>
            </div>
          </div>

          {/* Info Text */}
          <p className="text-xs text-center text-slate-500">
            By signing in, you agree to our{" "}
            <a href="/privacy" className="text-emerald-400 hover:text-emerald-300">
              Privacy Policy
            </a>
            {" "}and{" "}
            <a href="/terms" className="text-emerald-400 hover:text-emerald-300">
              Terms of Service
            </a>
          </p>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-slate-700/50">
          <p className="text-xs text-center text-slate-500">
            Crystal Power Investments © 2026
          </p>
          <p className="text-xs text-center text-slate-600 mt-1">
            Powered by MatchPro Intelligence
          </p>
        </div>
      </Card>

      {/* Bottom accent */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-emerald-900/20 to-transparent pointer-events-none"></div>
    </div>
  );
}
