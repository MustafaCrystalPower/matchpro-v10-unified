import { useCallback, useRef } from "react";

/**
 * Custom hook for playing notification sounds using Web Audio API
 * No external audio files needed - generates sounds programmatically
 */
export function useNotificationSound() {
  const audioContextRef = useRef<AudioContext | null>(null);

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContextRef.current;
  }, []);

  /**
   * Play a success/match notification sound (pleasant chime)
   */
  const playMatchSound = useCallback(() => {
    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;

      // Create a pleasant two-tone chime
      const frequencies = [523.25, 659.25, 783.99]; // C5, E5, G5 - major chord
      
      frequencies.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now);
        
        gain.gain.setValueAtTime(0, now + i * 0.1);
        gain.gain.linearRampToValueAtTime(0.15, now + i * 0.1 + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.5);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(now + i * 0.1);
        osc.stop(now + i * 0.1 + 0.6);
      });
    } catch (e) {
      // Audio not available - silently fail
    }
  }, [getAudioContext]);

  /**
   * Play a subtle notification sound (single tone)
   */
  const playNotificationSound = useCallback(() => {
    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, now); // A5
      
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.1, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(now);
      osc.stop(now + 0.4);
    } catch (e) {
      // Audio not available - silently fail
    }
  }, [getAudioContext]);

  /**
   * Request browser notification permission
   */
  const requestPermission = useCallback(async () => {
    if ("Notification" in window && Notification.permission === "default") {
      return await Notification.requestPermission();
    }
    return Notification.permission;
  }, []);

  /**
   * Show a browser push notification
   */
  const showBrowserNotification = useCallback((title: string, options?: NotificationOptions) => {
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        new Notification(title, {
          icon: "/favicon.ico",
          badge: "/favicon.ico",
          ...options
        });
      } catch (e) {
        // Notification not available
      }
    }
  }, []);

  return {
    playMatchSound,
    playNotificationSound,
    requestPermission,
    showBrowserNotification
  };
}
