import { useState, useEffect } from "react";
import { X, Download, Share, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PWAInstallPrompt() {
  // PWA install prompt disabled - not needed for dashboard
  return null;
  
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showAndroidBanner, setShowAndroidBanner] = useState(false);
  const [showIOSBanner, setShowIOSBanner] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isInStandaloneMode =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as { standalone?: boolean }).standalone === true;

  useEffect(() => {
    // Already installed — don't show
    if (isInStandaloneMode) return;

    // Check if dismissed recently (24h)
    const dismissedAt = localStorage.getItem("pwa-dismissed");
    if (dismissedAt && Date.now() - parseInt(dismissedAt) < 24 * 60 * 60 * 1000) return;

    // Android: listen for native install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowAndroidBanner(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // iOS: show manual instructions after 3 seconds
    if (isIOS) {
      const timer = setTimeout(() => setShowIOSBanner(true), 3000);
      return () => {
        window.removeEventListener("beforeinstallprompt", handler);
        clearTimeout(timer);
      };
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, [isInStandaloneMode, isIOS]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowAndroidBanner(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setDismissed(true);
    setShowAndroidBanner(false);
    setShowIOSBanner(false);
    localStorage.setItem("pwa-dismissed", Date.now().toString());
  };

  if (dismissed) return null;

  // Android install banner
  if (showAndroidBanner) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-[#111827] border-t border-yellow-500/30 shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <img src="/icon-72x72.png" alt="MatchPro" className="w-12 h-12 rounded-xl flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm">Install MatchPro™</p>
            <p className="text-gray-400 text-xs truncate">Add to home screen for instant access</p>
          </div>
          <Button
            size="sm"
            onClick={handleInstall}
            className="bg-yellow-500 hover:bg-yellow-400 text-black font-semibold text-xs px-3 flex-shrink-0"
          >
            <Download className="w-3 h-3 mr-1" />
            Install
          </Button>
          <button
            onClick={handleDismiss}
            className="text-gray-500 hover:text-gray-300 flex-shrink-0 p-1"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // iOS install instructions banner
  if (showIOSBanner) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-[#111827] border-t border-yellow-500/30 shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <img src="/icon-72x72.png" alt="MatchPro" className="w-8 h-8 rounded-lg" />
              <p className="text-white font-semibold text-sm">Install MatchPro™ on iPhone</p>
            </div>
            <button
              onClick={handleDismiss}
              className="text-gray-500 hover:text-gray-300 p-1"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-300">
            <div className="flex items-center gap-1">
              <span className="bg-gray-700 rounded p-1"><Share className="w-3 h-3 text-blue-400" /></span>
              <span>Tap Share</span>
            </div>
            <span className="text-gray-600">→</span>
            <div className="flex items-center gap-1">
              <span className="bg-gray-700 rounded p-1"><Plus className="w-3 h-3 text-gray-300" /></span>
              <span>Add to Home Screen</span>
            </div>
            <span className="text-gray-600">→</span>
            <span className="text-yellow-400 font-medium">Add</span>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
