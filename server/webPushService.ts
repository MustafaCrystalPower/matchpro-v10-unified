/**
 * MatchPro Web Push Notification Service
 * Uses VAPID-based Web Push to send match alerts to subscribed browsers/devices
 * even when the browser is closed.
 */
import webpush from "web-push";
import { getDb } from "./db";
import { pushSubscriptions } from "../drizzle/schema";
import { eq } from "drizzle-orm";

// ─── VAPID Configuration ──────────────────────────────────────────────────────
function initVapid() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    console.warn("[WebPush] VAPID keys not configured — push notifications disabled");
    return false;
  }
  webpush.setVapidDetails(
    "mailto:mmaisara@crystalpowerinvestment.com",
    publicKey,
    privateKey
  );
  return true;
}

let vapidReady = false;
try {
  vapidReady = initVapid();
} catch (e) {
  console.warn("[WebPush] VAPID init failed:", (e as Error).message);
}

// ─── Subscription management ──────────────────────────────────────────────────
export async function savePushSubscription(
  userId: number | null,
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  userAgent?: string
): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;

  // Upsert by endpoint
  const existing = await db
    .select({ id: pushSubscriptions.id })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, subscription.endpoint))
    .limit(1);

  if (existing.length > 0) {
    // Update userId if it changed (user logged in after subscribing)
    if (userId) {
      await db
        .update(pushSubscriptions)
        .set({ userId, userAgent: userAgent ?? null })
        .where(eq(pushSubscriptions.id, existing[0].id));
    }
    return existing[0].id;
  }

  const result = await db.insert(pushSubscriptions).values({
    userId,
    endpoint: subscription.endpoint,
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth,
    userAgent: userAgent ?? null,
  });
  return (result as unknown as { insertId: number }).insertId ?? null;
}

export async function deletePushSubscription(endpoint: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
}

// ─── Send push notification ───────────────────────────────────────────────────
export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
  tag?: string;
  data?: Record<string, unknown>;
}

export async function sendPushToAll(payload: PushPayload): Promise<{ sent: number; failed: number }> {
  if (!vapidReady) {
    console.warn("[WebPush] Skipping push — VAPID not configured");
    return { sent: 0, failed: 0 };
  }

  const db = await getDb();
  if (!db) return { sent: 0, failed: 0 };

  const subs = await db.select().from(pushSubscriptions).limit(500);
  let sent = 0;
  let failed = 0;

  const notification = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: payload.icon ?? "/icon-192x192.png",
    badge: payload.badge ?? "/icon-96x96.png",
    url: payload.url ?? "/",
    tag: payload.tag ?? "matchpro-alert",
    data: payload.data ?? {},
  });

  const staleEndpoints: string[] = [];

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          notification,
          { TTL: 86400 } // 24h TTL
        );
        sent++;
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 410 || statusCode === 404) {
          // Subscription expired — remove it
          staleEndpoints.push(sub.endpoint);
        }
        failed++;
      }
    })
  );

  // Clean up stale subscriptions
  for (const endpoint of staleEndpoints) {
    await deletePushSubscription(endpoint);
  }

  console.log(`[WebPush] Sent: ${sent}, Failed: ${failed}, Cleaned: ${staleEndpoints.length}`);
  return { sent, failed };
}

export async function sendPushToUser(userId: number, payload: PushPayload): Promise<{ sent: number; failed: number }> {
  if (!vapidReady) return { sent: 0, failed: 0 };

  const db = await getDb();
  if (!db) return { sent: 0, failed: 0 };

  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId))
    .limit(10);

  let sent = 0;
  let failed = 0;
  const notification = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: payload.icon ?? "/icon-192x192.png",
    badge: payload.badge ?? "/icon-96x96.png",
    url: payload.url ?? "/",
    tag: payload.tag ?? "matchpro-alert",
  });

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          notification,
          { TTL: 86400 }
        );
        sent++;
      } catch {
        failed++;
      }
    })
  );

  return { sent, failed };
}

export function isVapidReady(): boolean {
  return vapidReady;
}
