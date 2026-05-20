import { describe, it, expect } from "vitest";

describe("Web Push VAPID Configuration", () => {
  it("should have VAPID_PUBLIC_KEY set", () => {
    const key = process.env.VAPID_PUBLIC_KEY;
    expect(key).toBeTruthy();
    expect(key?.length).toBeGreaterThan(50);
  });

  it("should have VAPID_PRIVATE_KEY set", () => {
    const key = process.env.VAPID_PRIVATE_KEY;
    expect(key).toBeTruthy();
    expect(key?.length).toBeGreaterThan(30);
  });

  it("should have VITE_VAPID_PUBLIC_KEY set for frontend", () => {
    const key = process.env.VITE_VAPID_PUBLIC_KEY;
    expect(key).toBeTruthy();
  });

  it("VAPID public and VITE_VAPID_PUBLIC_KEY should match", () => {
    expect(process.env.VAPID_PUBLIC_KEY).toBe(process.env.VITE_VAPID_PUBLIC_KEY);
  });

  it("should be able to initialize web-push with VAPID keys", async () => {
    const webpush = await import("web-push");
    expect(() => {
      webpush.default.setVapidDetails(
        "mailto:test@example.com",
        process.env.VAPID_PUBLIC_KEY!,
        process.env.VAPID_PRIVATE_KEY!
      );
    }).not.toThrow();
  });
});
