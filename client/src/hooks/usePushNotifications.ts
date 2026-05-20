/**
 * usePushNotifications — React hook for Web Push subscription management
 * Registers the service worker, subscribes to push, and syncs with the server.
 */
import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";

type PushState = "idle" | "loading" | "subscribed" | "denied" | "unsupported" | "error";

export function usePushNotifications() {
  const [state, setState] = useState<PushState>("idle");
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);

  const { data: vapidData } = trpc.push.vapidPublicKey.useQuery();
  const subscribeMutation = trpc.push.subscribe.useMutation();
  const unsubscribeMutation = trpc.push.unsubscribe.useMutation();

  // Check current subscription state on mount
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }
    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((sub) => {
        if (sub) {
          setSubscription(sub);
          setState("subscribed");
        } else {
          setState("idle");
        }
      });
    });
  }, []);

  const subscribe = useCallback(async () => {
    if (!vapidData?.publicKey || !vapidData?.enabled) {
      setState("error");
      return false;
    }

    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return false;
    }

    setState("loading");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState("denied");
        return false;
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidData.publicKey),
      });

      const keys = sub.toJSON().keys;
      if (!keys?.p256dh || !keys?.auth) throw new Error("Missing subscription keys");

      await subscribeMutation.mutateAsync({
        endpoint: sub.endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: navigator.userAgent.substring(0, 512),
      });

      setSubscription(sub);
      setState("subscribed");
      return true;
    } catch (err) {
      console.error("[PushNotifications] Subscribe error:", err);
      setState("error");
      return false;
    }
  }, [vapidData, subscribeMutation]);

  const unsubscribe = useCallback(async () => {
    if (!subscription) return;
    setState("loading");
    try {
      await unsubscribeMutation.mutateAsync({ endpoint: subscription.endpoint });
      await subscription.unsubscribe();
      setSubscription(null);
      setState("idle");
    } catch (err) {
      console.error("[PushNotifications] Unsubscribe error:", err);
      setState("error");
    }
  }, [subscription, unsubscribeMutation]);

  return {
    state,
    isSubscribed: state === "subscribed",
    isSupported: state !== "unsupported",
    isLoading: state === "loading",
    subscribe,
    unsubscribe,
  };
}

// Convert base64 VAPID public key to ArrayBuffer
function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer as ArrayBuffer;
}
