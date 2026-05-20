/**
 * WhatsApp OTP Authentication System
 * Allows users to sign in by receiving a 6-digit OTP via WhatsApp
 * Completely independent of Manus OAuth - no email login required
 */

import type { Express, Request, Response } from "express";
import { getDb } from "./db";
import { sql } from "drizzle-orm";
import { sdk } from "./_core/sdk";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import * as dbHelpers from "./db";
import crypto from "crypto";

const GREEN_API_BASE = "https://api.green-api.com";

/**
 * Normalize phone number to international format
 */
function normalizePhone(phone: string): string {
  // Remove all non-digits
  let digits = phone.replace(/\D/g, "");
  
  // Handle Egyptian numbers
  if (digits.startsWith("0") && digits.length === 11) {
    digits = "20" + digits.substring(1);
  } else if (digits.startsWith("1") && digits.length === 10) {
    digits = "20" + digits;
  }
  
  // Ensure it starts with country code
  if (!digits.startsWith("20") && digits.length === 10) {
    digits = "20" + digits;
  }
  
  return digits;
}

/**
 * Generate a 6-digit OTP
 */
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * DISABLED — outbound WhatsApp OTP sending is not permitted.
 * MatchPro does not send messages to individuals.
 * Authentication is handled via local auth (JWT + bcrypt).
 */
async function sendWhatsAppOTP(_phone: string, _otp: string, _name?: string): Promise<boolean> {
  console.log('[WhatsApp Auth] DISABLED: outbound OTP messaging is not permitted in MatchPro.');
  return false;
}

/**
 * Store OTP in database
 */
async function storeOTP(phone: string, otp: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  
  // Invalidate any existing OTPs for this phone
  await db.execute(
    sql`UPDATE whatsappOtp SET used = 1 WHERE phone = ${phone} AND used = 0`
  );
  
  // Insert new OTP
  await db.execute(
    sql`INSERT INTO whatsappOtp (phone, otp, expiresAt) VALUES (${phone}, ${otp}, ${expiresAt})`
  );
}

/**
 * Verify OTP and return user info
 */
const OTP_MAX_ATTEMPTS = 5;
const OTP_LOCKOUT_MINUTES = 15;

async function verifyOTP(phone: string, otp: string): Promise<{ valid: boolean; openId?: string; locked?: boolean; attemptsLeft?: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Fetch the most recent unused, non-expired OTP for this phone
  const rows = await db.execute(
    sql`SELECT id, otp, openId, failedAttempts, lockedUntil FROM whatsappOtp 
        WHERE phone = ${phone} 
        AND used = 0 
        AND expiresAt > NOW()
        ORDER BY createdAt DESC 
        LIMIT 1`
  );

  const row = (rows as any).rows?.[0] || (rows as any)[0]?.[0];

  if (!row) {
    return { valid: false };
  }

  // Check if currently locked out
  if (row.lockedUntil && new Date(row.lockedUntil) > new Date()) {
    return { valid: false, locked: true };
  }

  // Wrong OTP — increment failed counter
  if (row.otp !== otp) {
    const newAttempts = (row.failedAttempts || 0) + 1;
    const shouldLock = newAttempts >= OTP_MAX_ATTEMPTS;
    const lockUntil = shouldLock
      ? new Date(Date.now() + OTP_LOCKOUT_MINUTES * 60 * 1000)
      : null;

    await db.execute(
      sql`UPDATE whatsappOtp 
          SET failedAttempts = ${newAttempts},
              lockedUntil = ${lockUntil}
          WHERE id = ${row.id}`
    );

    return {
      valid: false,
      locked: shouldLock,
      attemptsLeft: Math.max(0, OTP_MAX_ATTEMPTS - newAttempts),
    };
  }

  // Correct OTP — mark as used
  await db.execute(
    sql`UPDATE whatsappOtp SET used = 1, failedAttempts = 0, lockedUntil = NULL WHERE id = ${row.id}`
  );

  return { valid: true, openId: row.openId };
}

/**
 * Get or create user by phone number
 */
async function getOrCreateUserByPhone(phone: string, name?: string): Promise<string> {
  // Check if user exists with this phone as openId
  const openId = `wa_${phone}`;
  
  let user = await dbHelpers.getUserByOpenId(openId);
  
  if (!user) {
    // Create new user with phone stored in whatsappNumber
    await dbHelpers.upsertUser({
      openId,
      name: name || `WhatsApp User (${phone.slice(-4)})`,
      email: null,
      loginMethod: "whatsapp",
      lastSignedIn: new Date(),
    });
    user = await dbHelpers.getUserByOpenId(openId);
  }
  
  // Always update whatsappNumber and mark as verified
  const db = await getDb();
  if (db) {
    await db.execute(
      sql`UPDATE users SET whatsappNumber = ${phone}, whatsappVerified = 1 WHERE openId = ${openId}`
    );
  }
  
  return openId;
}

/**
 * Check if a phone number is in the authorized admins whitelist
 */
async function isAuthorizedPhone(phone: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const rows = await db.execute(
    sql`SELECT id FROM authorizedAdmins WHERE phone = ${phone} AND isActive = 1 LIMIT 1`
  );
  const row = (rows as any).rows?.[0] || (rows as any)[0]?.[0];
  return !!row;
}

/**
 * Generate a magic invite link token
 */
function generateMagicToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Re-export auth helpers so other auth modules (e.g. passkeyAuth) can reuse them
 */
export { sdk, COOKIE_NAME, getSessionCookieOptions };

/**
 * Register WhatsApp Auth routes
 */
export function registerWhatsAppAuthRoutes(app: Express) {
  
  // Step 1: Request OTP
  app.post("/api/auth/whatsapp/request-otp", async (req: Request, res: Response) => {
    const { phone, name } = req.body;
    
    if (!phone) {
      res.status(400).json({ error: "Phone number is required" });
      return;
    }
    
    const normalizedPhone = normalizePhone(phone);
    
    if (normalizedPhone.length < 10) {
      res.status(400).json({ error: "Invalid phone number format" });
      return;
    }
    
    // Whitelist check — only authorized admins can log in
    const authorized = await isAuthorizedPhone(normalizedPhone);
    if (!authorized) {
      res.status(403).json({ 
        error: "Access restricted. This number is not authorized to access MatchPro. Contact your administrator."
      });
      return;
    }
    
    try {
      const otp = generateOTP();
      await storeOTP(normalizedPhone, otp);
      
      const sent = await sendWhatsAppOTP(normalizedPhone, otp, name);
      
      if (!sent) {
        res.status(500).json({ error: "Failed to send OTP via WhatsApp. Please try again." });
        return;
      }
      
      res.json({ 
        success: true, 
        message: `Verification code sent to WhatsApp ${normalizedPhone.slice(-4).padStart(normalizedPhone.length, '*')}`,
        phone: normalizedPhone
      });
    } catch (error) {
      console.error("[WhatsApp Auth] Error requesting OTP:", error);
      res.status(500).json({ error: "Failed to send OTP" });
    }
  });
  
  // Step 2: Verify OTP and create session
  app.post("/api/auth/whatsapp/verify-otp", async (req: Request, res: Response) => {
    const { phone, otp, name } = req.body;
    
    if (!phone || !otp) {
      res.status(400).json({ error: "Phone and OTP are required" });
      return;
    }
    
    const normalizedPhone = normalizePhone(phone);
    
    try {
      const result = await verifyOTP(normalizedPhone, otp);

      if (!result.valid) {
        if (result.locked) {
          res.status(429).json({
            error: `Too many failed attempts. Your code is locked for ${OTP_LOCKOUT_MINUTES} minutes. Request a new code after the lockout expires.`,
            locked: true,
          });
        } else if (result.attemptsLeft !== undefined) {
          res.status(401).json({
            error: `Invalid code. ${result.attemptsLeft} attempt${result.attemptsLeft === 1 ? '' : 's'} remaining before lockout.`,
            attemptsLeft: result.attemptsLeft,
          });
        } else {
          res.status(401).json({ error: "Invalid or expired verification code" });
        }
        return;
      }
      
      // Get or create user
      const openId = await getOrCreateUserByPhone(normalizedPhone, name);
      
      // Create session token
      const userName = name || `User ${normalizedPhone.slice(-4)}`;
      const sessionToken = await sdk.createSessionToken(openId, {
        name: userName,
        expiresInMs: ONE_YEAR_MS,
      });
      
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      
      res.json({ 
        success: true, 
        message: "Signed in successfully",
        redirectTo: "/"
      });
    } catch (error) {
      console.error("[WhatsApp Auth] Error verifying OTP:", error);
      res.status(500).json({ error: "Verification failed" });
    }
  });
  
  // Create magic invite link (admin only)
  app.post("/api/auth/invite/create", async (req: Request, res: Response) => {
    // Verify admin session
    try {
      const user = await sdk.authenticateRequest(req);
      if (user.role !== "admin") {
        res.status(403).json({ error: "Admin access required" });
        return;
      }
      
      const { email, phone, name, role = "user", expiresInDays = 7 } = req.body;
      
      const token = generateMagicToken();
      const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
      
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      await db.execute(
        sql`INSERT INTO magicLinks (token, email, phone, name, role, createdBy, expiresAt)
            VALUES (${token}, ${email || null}, ${phone || null}, ${name || null}, ${role}, ${user.openId}, ${expiresAt})`
      );
      
      const origin = req.headers.origin || req.headers.referer?.split("/").slice(0, 3).join("/") || "";
      const inviteUrl = `${origin}/auth/invite?token=${token}`;
      
      res.json({ 
        success: true, 
        token,
        inviteUrl,
        expiresAt: expiresAt.toISOString()
      });
    } catch (error) {
      res.status(401).json({ error: "Authentication required" });
    }
  });
  
  // Redeem magic invite link
  app.get("/api/auth/invite/redeem", async (req: Request, res: Response) => {
    const token = req.query.token as string;
    
    if (!token) {
      res.redirect("/?error=invalid_invite");
      return;
    }
    
    try {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const rows = await db.execute(
        sql`SELECT * FROM magicLinks 
            WHERE token = ${token} 
            AND usedAt IS NULL 
            AND expiresAt > NOW()
            LIMIT 1`
      );
      
      const link = (rows as any).rows?.[0] || (rows as any)[0]?.[0];
      
      if (!link) {
        res.redirect("/?error=expired_invite");
        return;
      }
      
      // Create user openId based on email or phone
      const identifier = link.email || link.phone || token.substring(0, 16);
      const openId = `invite_${crypto.createHash("sha256").update(identifier).digest("hex").substring(0, 16)}`;
      
      // Create or update user
      await dbHelpers.upsertUser({
        openId,
        name: link.name || "Invited User",
        email: link.email || null,
        loginMethod: "invite_link",
        lastSignedIn: new Date(),
      });
      
      // Set role if admin
      if (link.role === "admin") {
        await db.execute(
          sql`UPDATE users SET role = 'admin' WHERE openId = ${openId}`
        );
      }
      
      // Mark link as used
      await db.execute(
        sql`UPDATE magicLinks SET usedAt = NOW(), usedByOpenId = ${openId} WHERE token = ${token}`
      );
      
      // Create session
      const sessionToken = await sdk.createSessionToken(openId, {
        name: link.name || "Invited User",
        expiresInMs: ONE_YEAR_MS,
      });
      
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      
      res.redirect("/");
    } catch (error) {
      console.error("[Invite Auth] Error redeeming invite:", error);
      res.redirect("/?error=invite_failed");
    }
  });
  
  // List magic links (admin only)
  app.get("/api/auth/invite/list", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (user.role !== "admin") {
        res.status(403).json({ error: "Admin access required" });
        return;
      }
      
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const rows = await db.execute(
        sql`SELECT id, email, phone, name, role, expiresAt, usedAt, createdAt 
            FROM magicLinks 
            WHERE createdBy = ${user.openId}
            ORDER BY createdAt DESC 
            LIMIT 50`
      );
      
      const links = (rows as any).rows || (rows as any)[0] || [];
      res.json({ links });
    } catch (error) {
      res.status(401).json({ error: "Authentication required" });
    }
  });
}
