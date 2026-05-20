/**
 * MatchPro Unified — Local Notification Service
 * Replaces Manus notification dispatch with local in-app + email + WhatsApp
 * INDEPENDENT — no external platform dependency
 */

export type NotificationPayload = {
  title: string;
  content: string;
};

const TITLE_MAX_LENGTH = 1200;
const CONTENT_MAX_LENGTH = 20000;

const trimValue = (value: string): string => value.trim();
const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const validatePayload = (input: NotificationPayload): NotificationPayload => {
  if (!isNonEmptyString(input.title)) {
    throw new Error("Notification title is required.");
  }
  if (!isNonEmptyString(input.content)) {
    throw new Error("Notification content is required.");
  }

  const title = trimValue(input.title).slice(0, TITLE_MAX_LENGTH);
  const content = trimValue(input.content).slice(0, CONTENT_MAX_LENGTH);

  return { title, content };
};

// WebSocket broadcast function — set by server init
let wsBroadcastFn: ((event: string, data: unknown) => void) | null = null;

export function setNotificationBroadcast(fn: (event: string, data: unknown) => void) {
  wsBroadcastFn = fn;
}

/**
 * Dispatches a notification locally:
 * 1. Broadcasts via WebSocket to all connected clients
 * 2. Logs to console
 * 3. Returns true (always succeeds locally)
 * 
 * For email/WhatsApp notifications, those are handled by their respective services
 * and triggered from the matching engine and report scheduler independently.
 */
export async function notifyOwner(
  payload: NotificationPayload
): Promise<boolean> {
  const { title, content } = validatePayload(payload);

  console.log(`[Notification] ${title}: ${content.slice(0, 100)}...`);

  // Broadcast to WebSocket clients
  if (wsBroadcastFn) {
    wsBroadcastFn("owner_notification", { title, content, timestamp: new Date().toISOString() });
  }

  return true;
}
