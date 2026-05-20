/**
 * MatchPro Unified — Local Auth Routes
 * Replaces Manus OAuth callback with local login/register endpoints.
 * INDEPENDENT — no external platform dependency.
 */

import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

export function registerOAuthRoutes(app: Express) {
  /**
   * POST /api/auth/login — Email + Password login
   */
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    try {
      const user = await db.getUserByEmail(email);
      if (!user) {
        res.status(401).json({ error: "Invalid email or password" });
        return;
      }

      // Check password (stored in a local passwords table or user record)
      const passwordHash = await db.getUserPasswordHash(user.openId);
      if (!passwordHash) {
        res.status(401).json({ error: "Account has no password set. Use WhatsApp login or contact admin." });
        return;
      }

      const isValid = await sdk.verifyPassword(password, passwordHash);
      if (!isValid) {
        res.status(401).json({ error: "Invalid email or password" });
        return;
      }

      // Update last sign in
      await db.updateUserLastSignIn(user.openId);

      // Create session
      const sessionToken = await sdk.createSessionToken({ openId: user.openId, name: user.name });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.json({ success: true, user: { name: user.name, email: user.email, role: user.role } });
    } catch (error) {
      console.error("[Auth] Login failed:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  /**
   * POST /api/auth/register — New user registration (admin approval required)
   */
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({ error: "Name, email, and password are required" });
      return;
    }

    try {
      // Check if user already exists
      const existing = await db.getUserByEmail(email);
      if (existing) {
        res.status(409).json({ error: "An account with this email already exists" });
        return;
      }

      const openId = uuidv4();
      const passwordHash = await sdk.hashPassword(password);

      // Create user (default role: "user", needs admin approval for elevated access)
      await db.upsertUser({
        openId,
        name,
        email,
        loginMethod: "local",
        lastSignedIn: new Date(),
      });

      // Store password hash
      await db.setUserPasswordHash(openId, passwordHash);

      // If this is the first user or email matches admin config, make admin
      const userCount = await db.getUserCount();
      const isConfiguredAdmin = email.toLowerCase() === (process.env.ADMIN_EMAIL || "").toLowerCase();
      
      if (userCount <= 1 || isConfiguredAdmin) {
        await db.setUserRole(openId, "admin");
      }

      // Auto-login after registration
      const sessionToken = await sdk.createSessionToken({ openId, name });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.json({ success: true, message: "Account created successfully" });
    } catch (error) {
      console.error("[Auth] Registration failed:", error);
      res.status(500).json({ error: "Registration failed" });
    }
  });

  /**
   * POST /api/auth/setup — First-time admin setup (only works when no users exist)
   */
  app.post("/api/auth/setup", async (req: Request, res: Response) => {
    const { name, email, password, phone } = req.body;

    try {
      const userCount = await db.getUserCount();
      if (userCount > 0) {
        res.status(403).json({ error: "Setup already completed. Use /api/auth/login." });
        return;
      }

      if (!name || !email || !password) {
        res.status(400).json({ error: "Name, email, and password are required" });
        return;
      }

      const openId = uuidv4();
      const passwordHash = await sdk.hashPassword(password);

      await db.upsertUser({
        openId,
        name,
        email,
        loginMethod: "local",
        lastSignedIn: new Date(),
      });

      await db.setUserPasswordHash(openId, passwordHash);
      await db.setUserRole(openId, "admin");

      if (phone) {
        await db.setUserPhone(openId, phone);
      }

      // Auto-login
      const sessionToken = await sdk.createSessionToken({ openId, name });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.json({ success: true, message: "Admin setup complete", role: "admin" });
    } catch (error) {
      console.error("[Auth] Setup failed:", error);
      res.status(500).json({ error: "Setup failed" });
    }
  });

  /**
   * GET /api/auth/status — Check if system needs setup
   */
  app.get("/api/auth/status", async (_req: Request, res: Response) => {
    try {
      const userCount = await db.getUserCount();
      res.json({
        needsSetup: userCount === 0,
        hasUsers: userCount > 0,
      });
    } catch (error) {
      res.json({ needsSetup: true, hasUsers: false });
    }
  });

  /**
   * Legacy OAuth callback — redirect to login page
   * (keeps old bookmarks working)
   */
  app.get("/api/oauth/callback", (_req: Request, res: Response) => {
    res.redirect(302, "/login");
  });
}
