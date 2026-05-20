/**
 * WhatsApp Magic Link Onboarding Service
 * 
 * Flow:
 * 1. Admin generates QR code with invite token
 * 2. New user scans QR → opens WhatsApp with pre-filled message
 * 3. User sends their phone number via WhatsApp
 * 4. Server receives the message, creates magic link, sends back via WhatsApp
 * 5. User clicks magic link → auto-authenticated → redirected to dashboard
 */

import { Request, Response, Router } from "express";
import * as jwt from "jsonwebtoken";
import QRCode from "qrcode";
import { getDb } from "./db";
import {
  users,
  organizations,
  whatsappMagicLinks,
  userOnboarding,
  InsertWhatsappMagicLink,
} from "../drizzle/schema";
import { eq, and, gt } from "drizzle-orm";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";

export const magicLinkRouter = Router();

const JWT_SECRET = process.env.JWT_SECRET || "matchpro-magic-link-secret";
const GREEN_API_INSTANCE = process.env.GREEN_API_INSTANCE_ID;
const GREEN_API_TOKEN = process.env.GREEN_API_TOKEN;
const APP_BASE_URL = process.env.APP_BASE_URL || process.env.VITE_OAUTH_PORTAL_URL || "https://matchpro.cpimatchpro.pro";

/**
 * DISABLED — outbound WhatsApp messaging is not permitted.
 * MatchPro does not send messages to individuals.
 */
async function sendWhatsAppMessage(_phoneNumber: string, _message: string): Promise<boolean> {
  console.log('[MagicLink] DISABLED: outbound WhatsApp messaging is not permitted in MatchPro.');
  return false;
}

/**
 * Generate a QR code that opens WhatsApp with a pre-filled invite message
 * The QR encodes a WhatsApp deep link: https://wa.me/<number>?text=<invite_message>
 */
export async function generateInviteQR(
  invitedByUserId: number,
  organizationId?: number
): Promise<{
  token: string;
  qrCodeDataUrl: string;
  qrCodeUrl: string;
  invitationUrl: string;
  whatsappDeepLink: string;
}> {
  // Generate a unique invite token
  const token = jwt.sign(
    {
      type: "invite",
      invitedByUserId,
      organizationId,
      iat: Date.now(),
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

  // The invitation URL that the QR will link to
  const invitationUrl = `${APP_BASE_URL}/api/whatsapp/magic-link/start?token=${token}`;

  // WhatsApp deep link: when scanned, opens WhatsApp with pre-filled message
  const whatsappNumber = process.env.WHATSAPP_BUSINESS_NUMBER || "201066505665";
  const prefilledMessage = encodeURIComponent(
    `🏠 MatchPro Invite\nToken: ${token}\nI want to join MatchPro Real Estate Platform`
  );
  const whatsappDeepLink = `https://wa.me/${whatsappNumber}?text=${prefilledMessage}`;

  // Generate QR code pointing to the WhatsApp deep link
  const qrCodeDataUrl = await QRCode.toDataURL(whatsappDeepLink, {
    width: 300,
    margin: 2,
    color: { dark: "#1a1a2e", light: "#ffffff" },
  });

  // Also generate a URL for the QR image via external service
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(whatsappDeepLink)}`;

  return { token, qrCodeDataUrl, qrCodeUrl, invitationUrl, whatsappDeepLink };
}

/**
 * Process an incoming WhatsApp message that contains an invite token
 * Creates a magic link and sends it back to the user
 */
export async function processInviteMessage(
  senderPhone: string,
  messageText: string
): Promise<boolean> {
  // Extract token from message
  const tokenMatch = messageText.match(/Token:\s*([A-Za-z0-9._-]+)/);
  if (!tokenMatch) return false;

  const token = tokenMatch[1];

  try {
    // Verify the invite token
    const decoded = jwt.verify(token, JWT_SECRET) as {
      type: string;
      invitedByUserId: number;
      organizationId?: number;
    };

    if (decoded.type !== "invite") return false;

    const db = await getDb();
    if (!db) return false;

    // Create a magic link token (short-lived, 1 hour)
    const magicToken = jwt.sign(
      {
        type: "magic_link",
        whatsappNumber: senderPhone,
        organizationId: decoded.organizationId,
        invitedByUserId: decoded.invitedByUserId,
      },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    // Store magic link in database
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await db.insert(whatsappMagicLinks).values({
      token: magicToken,
      whatsappNumber: senderPhone,
      organizationId: decoded.organizationId || null,
      invitedByUserId: decoded.invitedByUserId,
      expiresAt,
    });

    // Send magic link back via WhatsApp
    const magicLinkUrl = `${APP_BASE_URL}/api/whatsapp/magic-link/verify?token=${magicToken}`;
    const message = [
      "🎉 *Welcome to MatchPro!*",
      "",
      "Click the link below to access your dashboard:",
      "",
      `🔗 ${magicLinkUrl}`,
      "",
      "⏰ This link expires in 1 hour.",
      "",
      "_Crystal Power Investments - MatchPro Platform_",
    ].join("\n");

    await sendWhatsAppMessage(senderPhone, message);
    return true;
  } catch (error) {
    console.error("[MagicLink] Failed to process invite message:", error);
    return false;
  }
}

/**
 * GET /api/whatsapp/magic-link/start?token=<invite_token>
 * Redirect to WhatsApp with pre-filled message (fallback for non-QR access)
 */
magicLinkRouter.get("/start", async (req: Request, res: Response) => {
  const { token } = req.query as { token?: string };

  if (!token) {
    return res.status(400).send("Invalid invite link");
  }

  try {
    jwt.verify(token, JWT_SECRET);
    const whatsappNumber = process.env.WHATSAPP_BUSINESS_NUMBER || "201066505665";
    const prefilledMessage = encodeURIComponent(
      `🏠 MatchPro Invite\nToken: ${token}\nI want to join MatchPro Real Estate Platform`
    );
    const whatsappDeepLink = `https://wa.me/${whatsappNumber}?text=${prefilledMessage}`;
    res.redirect(302, whatsappDeepLink);
  } catch (error) {
    res.status(400).send("Invalid or expired invite link");
  }
});

/**
 * GET /api/whatsapp/magic-link/verify?token=<magic_token>
 * Verify the magic link, create/find user, set session cookie, redirect to dashboard
 */
magicLinkRouter.get("/verify", async (req: Request, res: Response) => {
  const { token } = req.query as { token?: string };

  if (!token) {
    return res.status(400).send("Invalid magic link");
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      type: string;
      whatsappNumber: string;
      organizationId?: number;
      invitedByUserId?: number;
    };

    if (decoded.type !== "magic_link") {
      return res.status(400).send("Invalid token type");
    }

    const db = await getDb();
    if (!db) {
      return res.status(500).send("Database unavailable");
    }

    // Check if magic link exists and hasn't been used
    const magicLinks = await db
      .select()
      .from(whatsappMagicLinks)
      .where(
        and(
          eq(whatsappMagicLinks.token, token),
          gt(whatsappMagicLinks.expiresAt, new Date())
        )
      )
      .limit(1);

    if (magicLinks.length === 0) {
      return res.status(400).send("Magic link expired or already used");
    }

    const magicLink = magicLinks[0];

    // Find or create user by WhatsApp number
    // Use phone number as openId for WhatsApp-authenticated users
    const openId = `whatsapp:${decoded.whatsappNumber}`;

    let existingUser = await db
      .select()
      .from(users)
      .where(eq(users.openId, openId))
      .limit(1);

    if (existingUser.length === 0) {
      // Create new user
      await db.insert(users).values({
        openId,
        name: `WhatsApp User (${decoded.whatsappNumber})`,
        loginMethod: "whatsapp",
        whatsappNumber: decoded.whatsappNumber,
        whatsappVerified: 1,
        organizationId: decoded.organizationId || null,
        lastSignedIn: new Date(),
      });

      existingUser = await db
        .select()
        .from(users)
        .where(eq(users.openId, openId))
        .limit(1);
    } else {
      // Update last sign in and org if needed
      await db
        .update(users)
        .set({
          lastSignedIn: new Date(),
          whatsappVerified: 1,
          ...(decoded.organizationId && !existingUser[0].organizationId
            ? { organizationId: decoded.organizationId }
            : {}),
        })
        .where(eq(users.openId, openId));
    }

    // Mark magic link as used
    await db
      .update(whatsappMagicLinks)
      .set({ usedAt: new Date(), createdUserId: existingUser[0]?.id || null })
      .where(eq(whatsappMagicLinks.token, token));

    // Create session token using the SDK
    const sessionToken = await sdk.createSessionToken(openId, {
      name: existingUser[0]?.name || `WhatsApp User`,
      expiresInMs: ONE_YEAR_MS,
    });

    const cookieOptions = getSessionCookieOptions(req);
    res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

    // Redirect to dashboard
    res.redirect(302, "/");
  } catch (error) {
    console.error("[MagicLink] Verification failed:", error);
    res.status(400).send("Invalid or expired magic link");
  }
});

/**
 * POST /api/whatsapp/magic-link/generate-qr
 * Generate a QR code for inviting users (admin endpoint)
 */
magicLinkRouter.post("/generate-qr", async (req: Request, res: Response) => {
  const { userId, organizationId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: "userId required" });
  }

  try {
    const result = await generateInviteQR(userId, organizationId);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error("[MagicLink] QR generation failed:", error);
    res.status(500).json({ error: "Failed to generate QR code" });
  }
});
