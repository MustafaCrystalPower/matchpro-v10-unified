/**
 * Match broadcast module - provides Socket.IO broadcast capability to the matching engine
 * Avoids circular dependency between whatsappHandler and matchingEngine
 */

let broadcastFn: ((event: string, data: unknown) => void) | null = null;

export function setMatchBroadcast(fn: (event: string, data: unknown) => void) {
  broadcastFn = fn;
}

export function getMatchBroadcast(): ((event: string, data: unknown) => void) | null {
  return broadcastFn;
}
