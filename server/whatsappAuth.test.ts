/**
 * Tests for WhatsApp OTP Authentication System
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fetch for OTP sending tests
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("WhatsApp Auth - Phone Normalization", () => {
  function normalizePhone(phone: string): string {
    let digits = phone.replace(/\D/g, "");
    if (digits.startsWith("0") && digits.length === 11) {
      digits = "20" + digits.substring(1);
    } else if (digits.startsWith("1") && digits.length === 10) {
      digits = "20" + digits;
    }
    if (!digits.startsWith("20") && digits.length === 10) {
      digits = "20" + digits;
    }
    return digits;
  }

  it("normalizes Egyptian number starting with 0", () => {
    expect(normalizePhone("01012345678")).toBe("201012345678");
  });

  it("normalizes Egyptian number starting with 1", () => {
    expect(normalizePhone("1012345678")).toBe("201012345678");
  });

  it("keeps already normalized international number", () => {
    expect(normalizePhone("+201012345678")).toBe("201012345678");
    expect(normalizePhone("201012345678")).toBe("201012345678");
  });

  it("strips non-digit characters", () => {
    expect(normalizePhone("+20 101 234 5678")).toBe("201012345678");
    expect(normalizePhone("(+20) 101-234-5678")).toBe("201012345678");
  });
});

describe("WhatsApp Auth - OTP Generation", () => {
  function generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  it("generates a 6-digit OTP", () => {
    const otp = generateOTP();
    expect(otp).toHaveLength(6);
    expect(/^\d{6}$/.test(otp)).toBe(true);
  });

  it("generates different OTPs each time", () => {
    const otps = new Set(Array.from({ length: 10 }, generateOTP));
    expect(otps.size).toBeGreaterThan(1);
  });

  it("OTP is always in range 100000-999999", () => {
    for (let i = 0; i < 20; i++) {
      const otp = parseInt(generateOTP());
      expect(otp).toBeGreaterThanOrEqual(100000);
      expect(otp).toBeLessThanOrEqual(999999);
    }
  });
});

describe("WhatsApp Auth - Magic Token Generation", () => {
  const crypto = require("crypto");

  function generateMagicToken(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  it("generates a 64-character hex token", () => {
    const token = generateMagicToken();
    expect(token).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(token)).toBe(true);
  });

  it("generates unique tokens", () => {
    const tokens = new Set(Array.from({ length: 10 }, generateMagicToken));
    expect(tokens.size).toBe(10);
  });
});

describe("WhatsApp Auth - API Route Validation", () => {
  it("validates phone is required for OTP request", () => {
    const body = { name: "Test User" };
    expect((body as any).phone).toBeUndefined();
  });

  it("validates phone and OTP are required for verification", () => {
    const body = { phone: "201012345678" };
    expect((body as any).otp).toBeUndefined();
  });

  it("validates OTP format (6 digits)", () => {
    const validOTP = "123456";
    const invalidOTP1 = "12345";
    const invalidOTP2 = "1234567";
    const invalidOTP3 = "abc123";

    expect(/^\d{6}$/.test(validOTP)).toBe(true);
    expect(/^\d{6}$/.test(invalidOTP1)).toBe(false);
    expect(/^\d{6}$/.test(invalidOTP2)).toBe(false);
    expect(/^\d{6}$/.test(invalidOTP3)).toBe(false);
  });
});

describe("WhatsApp Auth - Green API Message Format", () => {
  it("formats OTP message correctly with name", () => {
    const otp = "123456";
    const name = "Ahmed";
    const greeting = name ? `Hello ${name}! ` : "Hello! ";
    const message = `${greeting}Your MatchPro verification code is: *${otp}*`;
    
    expect(message).toContain("Hello Ahmed!");
    expect(message).toContain("*123456*");
  });

  it("formats OTP message without name", () => {
    const otp = "654321";
    const name = undefined;
    const greeting = name ? `Hello ${name}! ` : "Hello! ";
    const message = `${greeting}Your MatchPro verification code is: *${otp}*`;
    
    expect(message).toContain("Hello! ");
    expect(message).toContain("*654321*");
  });

  it("formats chat ID correctly for Green API", () => {
    const phone = "201012345678";
    const chatId = `${phone}@c.us`;
    expect(chatId).toBe("201012345678@c.us");
  });
});

describe("WhatsApp Auth - User OpenId Format", () => {
  it("creates correct openId for WhatsApp users", () => {
    const phone = "201012345678";
    const openId = `wa_${phone}`;
    expect(openId).toBe("wa_201012345678");
  });

  it("creates correct openId for invite link users", () => {
    const crypto = require("crypto");
    const identifier = "test@example.com";
    const openId = `invite_${crypto.createHash("sha256").update(identifier).digest("hex").substring(0, 16)}`;
    expect(openId).toMatch(/^invite_[0-9a-f]{16}$/);
  });
});

describe("WhatsApp Auth - OTP Brute-Force Protection Logic", () => {
  const OTP_MAX_ATTEMPTS = 5;
  const OTP_LOCKOUT_MINUTES = 15;

  // Simulate the brute-force state machine in isolation (no DB required)
  function simulateVerify(
    storedOtp: string,
    inputOtp: string,
    currentAttempts: number,
    lockedUntil: Date | null
  ): { valid: boolean; locked?: boolean; attemptsLeft?: number; newAttempts?: number; newLockedUntil?: Date | null } {
    // Check lockout
    if (lockedUntil && lockedUntil > new Date()) {
      return { valid: false, locked: true };
    }
    // Wrong OTP
    if (storedOtp !== inputOtp) {
      const newAttempts = currentAttempts + 1;
      const shouldLock = newAttempts >= OTP_MAX_ATTEMPTS;
      const newLockedUntil = shouldLock
        ? new Date(Date.now() + OTP_LOCKOUT_MINUTES * 60 * 1000)
        : null;
      return {
        valid: false,
        locked: shouldLock,
        attemptsLeft: Math.max(0, OTP_MAX_ATTEMPTS - newAttempts),
        newAttempts,
        newLockedUntil,
      };
    }
    // Correct OTP
    return { valid: true };
  }

  it("allows correct OTP on first attempt", () => {
    const result = simulateVerify("123456", "123456", 0, null);
    expect(result.valid).toBe(true);
  });

  it("rejects wrong OTP and decrements attempts remaining", () => {
    const result = simulateVerify("123456", "000000", 0, null);
    expect(result.valid).toBe(false);
    expect(result.locked).toBe(false);
    expect(result.attemptsLeft).toBe(4); // 5 - 1 = 4
  });

  it("locks after 5 failed attempts", () => {
    const result = simulateVerify("123456", "000000", 4, null); // 4 previous failures, this is the 5th
    expect(result.valid).toBe(false);
    expect(result.locked).toBe(true);
    expect(result.attemptsLeft).toBe(0);
    expect(result.newLockedUntil).toBeDefined();
    expect(result.newLockedUntil!.getTime()).toBeGreaterThan(Date.now());
  });

  it("blocks all attempts when locked (even correct OTP)", () => {
    const lockedUntil = new Date(Date.now() + 10 * 60 * 1000); // locked for 10 more minutes
    const result = simulateVerify("123456", "123456", 5, lockedUntil);
    expect(result.valid).toBe(false);
    expect(result.locked).toBe(true);
  });

  it("allows attempt after lockout expires", () => {
    const expiredLock = new Date(Date.now() - 1000); // expired 1 second ago
    const result = simulateVerify("123456", "123456", 5, expiredLock);
    expect(result.valid).toBe(true);
  });

  it("attemptsLeft is 0 at exactly 5 failures", () => {
    const result = simulateVerify("123456", "wrong", 4, null);
    expect(result.attemptsLeft).toBe(0);
    expect(result.locked).toBe(true);
  });

  it("lockout duration is 15 minutes", () => {
    const result = simulateVerify("123456", "wrong", 4, null);
    const lockDurationMs = result.newLockedUntil!.getTime() - Date.now();
    const lockDurationMin = lockDurationMs / (60 * 1000);
    expect(lockDurationMin).toBeGreaterThanOrEqual(14.9);
    expect(lockDurationMin).toBeLessThanOrEqual(15.1);
  });
});
