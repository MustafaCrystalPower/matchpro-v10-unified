/**
 * Passkey / WebAuthn authentication for the owner (Touch ID / Face ID / Windows Hello)
 * Uses SimpleWebAuthn v13 — FIDO2 compliant, no passwords.
 *
 * Flow:
 *   Registration  → POST /api/auth/passkey/register-options  (admin only, first-time setup)
 *                 → POST /api/auth/passkey/register-verify
 *   Authentication→ POST /api/auth/passkey/auth-options      (public — returns challenge)
 *                 → POST /api/auth/passkey/auth-verify        (verifies & creates session)
 */

import type { Express, Request, Response } from "express";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type {
  AuthenticatorTransportFuture,
  CredentialDeviceType,
} from "@simplewebauthn/server";
import { getDb } from "./db";
import { sql } from "drizzle-orm";
import { ENV } from "./_core/env";

// ─── helpers ────────────────────────────────────────────────────────────────

function getRpId(req: Request): string {
  // Use the request origin host, strip port for localhost
  const host = req.headers.host || "localhost";
  return host.split(":")[0];
}

function getOrigin(req: Request): string {
  return req.headers.origin || `https://${getRpId(req)}`;
}

// ─── in-memory challenge store (per session) ────────────────────────────────
// For production this would be Redis/DB; challenges expire in 5 min
const challengeStore = new Map<string, { challenge: string; expires: number }>();

function storeChallenge(key: string, challenge: string) {
  challengeStore.set(key, { challenge, expires: Date.now() + 5 * 60 * 1000 });
}

function consumeChallenge(key: string): string | null {
  const entry = challengeStore.get(key);
  if (!entry || Date.now() > entry.expires) {
    challengeStore.delete(key);
    return null;
  }
  challengeStore.delete(key);
  return entry.challenge;
}

// Clean up expired challenges every 10 minutes
setInterval(() => {
  const now = Date.now();
  Array.from(challengeStore.entries()).forEach(([k, v]) => {
    if (now > v.expires) challengeStore.delete(k);
  });
}, 10 * 60 * 1000);

// ─── DB helpers ─────────────────────────────────────────────────────────────

async function getPasskeys(userOpenId: string) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.execute(
    sql`SELECT * FROM passkeys WHERE userOpenId = ${userOpenId}`
  );
  return ((rows as any).rows || (rows as any)[0] || []) as PasskeyRow[];
}

async function getPasskeyByCredentialId(credentialId: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.execute(
    sql`SELECT * FROM passkeys WHERE credentialId = ${credentialId} LIMIT 1`
  );
  const list = ((rows as any).rows || (rows as any)[0] || []) as PasskeyRow[];
  return list[0] || null;
}

async function savePasskey(p: {
  userOpenId: string;
  credentialId: string;
  publicKey: string;
  counter: number;
  deviceType: string;
  backedUp: boolean;
  transports: string;
  name: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.execute(
    sql`INSERT INTO passkeys (userOpenId, credentialId, publicKey, counter, deviceType, backedUp, transports, name, createdAt)
        VALUES (${p.userOpenId}, ${p.credentialId}, ${p.publicKey}, ${p.counter}, ${p.deviceType}, ${p.backedUp ? 1 : 0}, ${p.transports}, ${p.name}, NOW())`
  );
}

async function updatePasskeyCounter(credentialId: string, counter: number) {
  const db = await getDb();
  if (!db) return;
  await db.execute(
    sql`UPDATE passkeys SET counter = ${counter}, lastUsedAt = NOW() WHERE credentialId = ${credentialId}`
  );
}

interface PasskeyRow {
  userOpenId: string;
  credentialId: string;
  publicKey: string;
  counter: number;
  deviceType: string;
  backedUp: number | boolean;
  transports: string;
  name: string;
}

// ─── ensure passkeys table exists ───────────────────────────────────────────

export async function ensurePasskeysTable() {
  const db = await getDb();
  if (!db) return;
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS passkeys (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userOpenId VARCHAR(255) NOT NULL,
      credentialId TEXT NOT NULL,
      publicKey TEXT NOT NULL,
      counter BIGINT NOT NULL DEFAULT 0,
      deviceType VARCHAR(64),
      backedUp TINYINT(1) DEFAULT 0,
      transports TEXT,
      name VARCHAR(255) DEFAULT 'Passkey',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      lastUsedAt DATETIME,
      INDEX idx_userOpenId (userOpenId),
      INDEX idx_credentialId (credentialId(255))
    )
  `);
}

// ─── route registration ──────────────────────────────────────────────────────

export function registerPasskeyRoutes(
  app: Express,
  sdk: { authenticateRequest: (req: Request) => Promise<{ openId: string; role: string; name?: string | null }>;
         createSessionToken: (openId: string, opts: { name?: string; expiresInMs: number }) => Promise<string> },
  getSessionCookieOptions: (req: Request) => object,
  COOKIE_NAME: string
) {
  const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

  // ── Registration: generate options (owner/admin only) ──────────────────────
  app.post("/api/auth/passkey/register-options", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      // Only the owner can register passkeys
      if (user.openId !== ENV.ownerOpenId && user.role !== "admin") {
        res.status(403).json({ error: "Owner access required" });
        return;
      }

      const existingPasskeys = await getPasskeys(user.openId);

      const options = await generateRegistrationOptions({
        rpName: "MatchPro™ by Crystal Power",
        rpID: getRpId(req),
        userName: user.name || "Owner",
        userDisplayName: user.name || "Mo'men Maisara",
        attestationType: "none",
        excludeCredentials: existingPasskeys.map((pk) => ({
          id: pk.credentialId,
          transports: (pk.transports ? JSON.parse(pk.transports) : []) as AuthenticatorTransportFuture[],
        })),
        authenticatorSelection: {
          residentKey: "preferred",
          userVerification: "preferred",
          authenticatorAttachment: "platform", // Touch ID / Face ID only
        },
      });

      storeChallenge(`reg_${user.openId}`, options.challenge);
      res.json(options);
    } catch (err) {
      console.error("[Passkey] register-options error:", err);
      res.status(401).json({ error: "Authentication required" });
    }
  });

  // ── Registration: verify response ─────────────────────────────────────────
  app.post("/api/auth/passkey/register-verify", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (user.openId !== ENV.ownerOpenId && user.role !== "admin") {
        res.status(403).json({ error: "Owner access required" });
        return;
      }

      const expectedChallenge = consumeChallenge(`reg_${user.openId}`);
      if (!expectedChallenge) {
        res.status(400).json({ error: "Challenge expired. Please try again." });
        return;
      }

      const { body, passkeyName } = req.body;
      const verification = await verifyRegistrationResponse({
        response: body,
        expectedChallenge,
        expectedOrigin: getOrigin(req),
        expectedRPID: getRpId(req),
        requireUserVerification: false,
      });

      if (!verification.verified || !verification.registrationInfo) {
        res.status(400).json({ error: "Passkey registration failed" });
        return;
      }

      const { credential, credentialDeviceType, credentialBackedUp } =
        verification.registrationInfo;

      await savePasskey({
        userOpenId: user.openId,
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey).toString("base64"),
        counter: credential.counter,
        deviceType: credentialDeviceType as string,
        backedUp: credentialBackedUp,
        transports: JSON.stringify(credential.transports || []),
        name: passkeyName || "MacBook Touch ID",
      });

      res.json({ verified: true, message: "Passkey registered successfully!" });
    } catch (err) {
      console.error("[Passkey] register-verify error:", err);
      res.status(500).json({ error: "Registration failed" });
    }
  });

  // ── Authentication: generate options (public) ──────────────────────────────
  app.post("/api/auth/passkey/auth-options", async (req: Request, res: Response) => {
    try {
      // Get owner's passkeys
      const ownerOpenId = ENV.ownerOpenId;
      const passkeys = ownerOpenId ? await getPasskeys(ownerOpenId) : [];

      const options = await generateAuthenticationOptions({
        rpID: getRpId(req),
        userVerification: "preferred",
        allowCredentials: passkeys.map((pk) => ({
          id: pk.credentialId,
          transports: (pk.transports ? JSON.parse(pk.transports) : []) as AuthenticatorTransportFuture[],
        })),
      });

      storeChallenge("auth_owner", options.challenge);
      res.json({ ...options, hasPasskeys: passkeys.length > 0 });
    } catch (err) {
      console.error("[Passkey] auth-options error:", err);
      res.status(500).json({ error: "Failed to generate auth options" });
    }
  });

  // ── Authentication: verify response ───────────────────────────────────────
  app.post("/api/auth/passkey/auth-verify", async (req: Request, res: Response) => {
    try {
      const expectedChallenge = consumeChallenge("auth_owner");
      if (!expectedChallenge) {
        res.status(400).json({ error: "Challenge expired. Please try again." });
        return;
      }

      const { body } = req.body;
      const passkey = await getPasskeyByCredentialId(body.id);
      if (!passkey) {
        res.status(400).json({ error: "Passkey not found" });
        return;
      }

      const verification = await verifyAuthenticationResponse({
        response: body,
        expectedChallenge,
        expectedOrigin: getOrigin(req),
        expectedRPID: getRpId(req),
        credential: {
          id: passkey.credentialId,
          publicKey: new Uint8Array(Buffer.from(passkey.publicKey, "base64")),
          counter: passkey.counter,
          transports: (passkey.transports ? JSON.parse(passkey.transports) : []) as AuthenticatorTransportFuture[],
        },
        requireUserVerification: false,
      });

      if (!verification.verified) {
        res.status(400).json({ error: "Passkey verification failed" });
        return;
      }

      // Update counter
      await updatePasskeyCounter(passkey.credentialId, verification.authenticationInfo.newCounter);

      // Create session for owner
      const ownerOpenId = passkey.userOpenId;
      const sessionToken = await sdk.createSessionToken(ownerOpenId, {
        name: "Mo'men Maisara",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...(cookieOptions as object), maxAge: ONE_YEAR_MS });
      res.json({ verified: true, redirectTo: "/" });
    } catch (err) {
      console.error("[Passkey] auth-verify error:", err);
      res.status(500).json({ error: "Authentication failed" });
    }
  });

  // ── List registered passkeys (owner only) ─────────────────────────────────
  app.get("/api/auth/passkey/list", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (user.openId !== ENV.ownerOpenId && user.role !== "admin") {
        res.status(403).json({ error: "Owner access required" });
        return;
      }
      const passkeys = await getPasskeys(user.openId);
      res.json({
        passkeys: passkeys.map((p) => ({
          credentialId: p.credentialId.substring(0, 12) + "...",
          name: p.name,
          deviceType: p.deviceType,
          backedUp: p.backedUp,
        })),
      });
    } catch {
      res.status(401).json({ error: "Authentication required" });
    }
  });

  // ── Delete a passkey (owner only) ─────────────────────────────────────────
  app.delete("/api/auth/passkey/:credentialId", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (user.openId !== ENV.ownerOpenId && user.role !== "admin") {
        res.status(403).json({ error: "Owner access required" });
        return;
      }
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.execute(
        sql`DELETE FROM passkeys WHERE credentialId = ${req.params.credentialId} AND userOpenId = ${user.openId}`
      );
      res.json({ success: true });
    } catch {
      res.status(401).json({ error: "Authentication required" });
    }
  });
}
