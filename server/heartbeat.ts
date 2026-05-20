/**
 * WhatsApp Heartbeat & Health Monitor
 * 
 * Checks every hour if a WhatsApp message has been received in the last 24 hours.
 * If no message is received, sends an alert via Green API to the owner's number.
 * Also tracks message timestamps for the System Health dashboard widget.
 */

import { getDb } from "./db";
import { messages } from "../drizzle/schema";
import { desc, sql } from "drizzle-orm";

// ─── In-memory state ──────────────────────────────────────────────────────────
let lastMessageTimestamp: Date | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let alertSentAt: Date | null = null;

const ALERT_THRESHOLD_HOURS = 24;
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const OWNER_PHONE = process.env.OWNER_PHONE || "201066505665";

// ─── Logging ──────────────────────────────────────────────────────────────────
export function logIncomingMessage(
  messageId: string,
  sender: string,
  groupName: string,
  classification: string,
  textPreview: string
) {
  const ts = new Date().toISOString();
  lastMessageTimestamp = new Date();
  // Reset alert state when a message arrives
  alertSentAt = null;

  console.log(
    `[MSG] ${ts} | id=${messageId} | from=${sender} | group="${groupName}" | type=${classification} | text="${textPreview.substring(0, 80)}..."`
  );
}

// ─── Health status ────────────────────────────────────────────────────────────
export async function getWhatsAppHealthStatus(): Promise<{
  connected: boolean;
  lastMessageAt: string | null;
  hoursSinceLastMessage: number | null;
  alertActive: boolean;
  status: "healthy" | "warning" | "critical";
}> {
  try {
    const db = await getDb();
    if (!db) return { connected: false, lastMessageAt: null, hoursSinceLastMessage: null, alertActive: false, status: "critical" as const };
    // Get the most recent message timestamp from DB
    const result = await db
      .select({ createdAt: messages.createdAt })
      .from(messages)
      .orderBy(desc(messages.createdAt))
      .limit(1);

    const dbLastMessage = result[0]?.createdAt ? new Date(result[0].createdAt) : null;
    // Use the more recent of in-memory or DB timestamp
    const effectiveLast =
      lastMessageTimestamp && dbLastMessage
        ? lastMessageTimestamp > dbLastMessage
          ? lastMessageTimestamp
          : dbLastMessage
        : lastMessageTimestamp || dbLastMessage;

    const hoursSince = effectiveLast
      ? (Date.now() - effectiveLast.getTime()) / (1000 * 60 * 60)
      : null;

    const alertActive = hoursSince !== null && hoursSince > ALERT_THRESHOLD_HOURS;

    let status: "healthy" | "warning" | "critical" = "healthy";
    if (hoursSince === null) status = "critical";
    else if (hoursSince > ALERT_THRESHOLD_HOURS) status = "critical";
    else if (hoursSince > 12) status = "warning";

    return {
      connected: status !== "critical",
      lastMessageAt: effectiveLast ? effectiveLast.toISOString() : null,
      hoursSinceLastMessage: hoursSince ? Math.round(hoursSince * 10) / 10 : null,
      alertActive,
      status,
    };
  } catch (err) {
    console.error("[Heartbeat] Health check DB error:", err);
    return {
      connected: false,
      lastMessageAt: null,
      hoursSinceLastMessage: null,
      alertActive: false,
      status: "critical",
    };
  }
}

// ─── Alert logger (no outbound WhatsApp — dashboard-only system) ─────────────
async function sendHeartbeatAlert(hoursSince: number) {
  // Throttle: only log once per 6 hours
  if (alertSentAt && Date.now() - alertSentAt.getTime() < 6 * 60 * 60 * 1000) {
    return;
  }
  alertSentAt = new Date();
  // MatchPro is a read-only dashboard — no outbound WhatsApp messages are sent.
  // The System Health widget on the dashboard shows the alert status in real time.
  console.warn(
    `[Heartbeat] ⚠️ No WhatsApp messages received in ${Math.round(hoursSince)}h. Check Green API / webhook config. Alert visible on dashboard.`
  );
}

// ─── Heartbeat check ──────────────────────────────────────────────────────────
async function runHeartbeatCheck() {
  console.log("[Heartbeat] Running health check...");
  const health = await getWhatsAppHealthStatus();

  console.log(
    `[Heartbeat] Status: ${health.status} | Last message: ${
      health.lastMessageAt
        ? `${health.hoursSinceLastMessage}h ago`
        : "never"
    }`
  );

  if (health.alertActive && health.hoursSinceLastMessage !== null) {
    console.warn(
      `[Heartbeat] ⚠️ No messages for ${health.hoursSinceLastMessage}h — sending alert`
    );
    await sendHeartbeatAlert(health.hoursSinceLastMessage);
  }
}

// ─── Start / Stop ─────────────────────────────────────────────────────────────
export function startHeartbeat() {
  if (heartbeatTimer) return; // already running
  console.log(
    `[Heartbeat] Started — checking every ${CHECK_INTERVAL_MS / 60000} minutes, alert threshold: ${ALERT_THRESHOLD_HOURS}h`
  );
  // Run immediately on startup
  runHeartbeatCheck().catch(console.error);
  heartbeatTimer = setInterval(() => {
    runHeartbeatCheck().catch(console.error);
  }, CHECK_INTERVAL_MS);
}

export function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
    console.log("[Heartbeat] Stopped");
  }
}
