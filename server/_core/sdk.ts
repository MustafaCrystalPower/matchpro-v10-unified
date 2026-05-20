/**
 * MatchPro Unified — Local Auth SDK
 * Replaces Manus OAuth with local JWT-based authentication.
 * INDEPENDENT — no external platform dependency.
 */

import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import bcrypt from "bcryptjs";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";

export type SessionPayload = {
  openId: string;
  appId: string;
  name: string;
};

const SECRET_KEY = new TextEncoder().encode(ENV.cookieSecret);

/**
 * Create a signed JWT session token
 */
async function createSessionToken(user: { openId: string; name: string | null }): Promise<string> {
  const payload: SessionPayload = {
    openId: user.openId,
    appId: "matchpro-local",
    name: user.name || "User",
  };

  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(SECRET_KEY);
}

/**
 * Verify a session token from cookie
 */
async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

/**
 * Extract session cookie value from request
 */
function getCookieFromRequest(req: Request): string | null {
  const cookieHeader = req.headers.cookie || "";
  const cookies = Object.fromEntries(
    cookieHeader.split(";").map(c => {
      const [key, ...rest] = c.trim().split("=");
      return [key, rest.join("=")];
    })
  );
  return cookies[COOKIE_NAME] || null;
}

/**
 * Authenticate a request by reading the session cookie and looking up the user.
 * Returns the User record or null if not authenticated.
 */
async function authenticateRequest(req: Request): Promise<User | null> {
  const token = getCookieFromRequest(req);
  if (!token) return null;

  const session = await verifySessionToken(token);
  if (!session || !session.openId) return null;

  // Look up user in DB
  const user = await db.getUserByOpenId(session.openId);
  return user;
}

/**
 * Hash a password
 */
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * Verify a password against hash
 */
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Export as a single sdk object (matches existing import pattern)
export const sdk = {
  createSessionToken,
  verifySessionToken,
  authenticateRequest,
  hashPassword,
  verifyPassword,
  getCookieFromRequest,
};

// Also export individual functions for direct import
export {
  createSessionToken,
  verifySessionToken,
  authenticateRequest,
  hashPassword,
  verifyPassword,
};
