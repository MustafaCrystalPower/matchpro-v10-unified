import { Request, Response, Router } from "express";
import { parseRealEstateMessage, quickClassify } from "./nlpParser";
import { parseWhatsAppMessage, formatPhone, generateWhatsAppLink } from "./enhancedParser";
import { findMatchesForSupply, findMatchesForDemand } from "./matchingEngine";
import { storagePut } from "./storage";
import { logIncomingMessage, getWhatsAppHealthStatus } from "./heartbeat";
import { runIngestionPipeline, isSpamMessage } from "./ingestionPipeline";
import {
  insertMessage,
  insertSupply,
  insertDemand,
  upsertWhatsappGroup,
  incrementGroupCounts,
  markMessageProcessed,
  insertNotification
} from "./db";

export const whatsappRouter = Router();

// Store for WebSocket broadcast function
let broadcastFn: ((event: string, data: unknown) => void) | null = null;

export function setWebSocketBroadcast(fn: (event: string, data: unknown) => void) {
  broadcastFn = fn;
}

function broadcast(event: string, data: unknown) {
  if (broadcastFn) {
    broadcastFn(event, data);
  }
}

/**
 * Green API Webhook endpoint
 * Receives incoming WhatsApp messages
 */
whatsappRouter.post("/webhook", async (req: Request, res: Response) => {
  try {
    const data = req.body;
    console.log("[WhatsApp] Webhook received:", JSON.stringify(data).substring(0, 500));

    // Handle different webhook types from Green API
    const webhookType = data.typeWebhook;

    if (webhookType === "incomingMessageReceived") {
      await handleIncomingMessage(data);
    } else if (webhookType === "stateInstanceChanged") {
      console.log("[WhatsApp] Instance state changed:", data.stateInstance);
      broadcast("whatsapp_status", { status: data.stateInstance });
    } else if (webhookType === "outgoingMessageStatus") {
      console.log("[WhatsApp] Outgoing message status:", data.status);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("[WhatsApp] Webhook error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Webhook verification endpoint for Green API
 */
whatsappRouter.get("/webhook", (req: Request, res: Response) => {
  const verifyToken = process.env.GREEN_API_VERIFY_TOKEN || "matchpro_verify_token";
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === verifyToken) {
    console.log("[WhatsApp] Webhook verified successfully");
    res.status(200).send(challenge);
  } else {
    console.log("[WhatsApp] Webhook verification failed");
    res.status(403).send("Verification failed");
  }
});

/**
 * Get WhatsApp connection status
 */
whatsappRouter.get("/status", async (req: Request, res: Response) => {
  try {
    const instanceId = process.env.GREEN_API_INSTANCE_ID;
    const token = process.env.GREEN_API_TOKEN;

    if (!instanceId || !token) {
      return res.json({
        connected: false,
        status: "not_configured",
        message: "Green API credentials not configured"
      });
    }

    // Check Green API instance status
    const response = await fetch(
      `https://api.green-api.com/waInstance${instanceId}/getStateInstance/${token}`
    );
    const data = await response.json();

    res.json({
      connected: data.stateInstance === "authorized",
      status: data.stateInstance,
      phone: "+201066505665"
    });
  } catch (error) {
    console.error("[WhatsApp] Status check error:", error);
    res.json({
      connected: false,
      status: "error",
      message: "Failed to check status"
    });
  }
});

/**
 * Handle incoming WhatsApp message
 * Uses enhanced parser for better Arabic/English extraction
 */
async function handleIncomingMessage(data: any) {
  const messageData = data.messageData || {};
  const senderData = data.senderData || {};

  // Extract message details
  const messageId = messageData.idMessage || `msg_${Date.now()}`;
  const chatId = senderData.chatId || "";
  const sender = senderData.sender || "";
  const senderName = senderData.senderName || "Unknown";
  const chatName = senderData.chatName || "Unknown";
  const timestamp = messageData.timestamp ? new Date(messageData.timestamp * 1000) : new Date();

  // Get message text early for magic link detection
  let earlyMessageText = "";
  if (messageData.textMessageData) {
    earlyMessageText = messageData.textMessageData.textMessage || "";
  } else if (messageData.extendedTextMessageData) {
    earlyMessageText = messageData.extendedTextMessageData.text || "";
  }

  // Check if this is a direct message (not group) containing an invite token
  // This handles the WhatsApp QR onboarding flow
  if (!chatId.includes("@g.us") && earlyMessageText.includes("Token:")) {
    const senderPhone = sender.replace("@c.us", "");
    console.log(`[WhatsApp] Processing invite message from ${senderPhone}`);
    try {
      const { processInviteMessage } = await import("./whatsappMagicLink");
      const processed = await processInviteMessage(senderPhone, earlyMessageText);
      if (processed) {
        console.log(`[WhatsApp] Magic link sent to ${senderPhone}`);
        return;
      }
    } catch (err) {
      console.error("[WhatsApp] Magic link processing failed:", err);
    }
  }

  // Only process group messages for real estate data
  if (!chatId.includes("@g.us")) {
    console.log("[WhatsApp] Ignoring non-group message");
    return;
  }

  // Get message text
  let messageText = earlyMessageText;
  let hasImage = false;
  let imageUrl: string | null = null;

  if (!messageText && messageData.imageMessage) {
    messageText = messageData.imageMessage.caption || "";
    hasImage = true;
    // Handle image download and S3 upload
    if (messageData.imageMessage.downloadUrl) {
      imageUrl = await downloadAndUploadImage(messageData.imageMessage.downloadUrl, messageId);
    }
  }

  if (!messageText.trim()) {
    console.log("[WhatsApp] Empty message, skipping");
    return;
  }

  // ── Structured timestamp log for every incoming message ──────────────────
  logIncomingMessage(messageId, sender, chatName, "processing", messageText);
  console.log(`[WhatsApp] Processing message from ${chatName}: ${messageText.substring(0, 100)}...`);

  // ── STEP 1: Quick spam check before any DB writes ────────────────────────
  if (isSpamMessage(messageText)) {
    console.log("[WhatsApp] Spam/short message, skipping");
    return;
  }

  // ── STEP 2: Save raw message to DB (always, for audit trail) ─────────────
  const msgId = await insertMessage({
    messageId,
    chatId,
    groupName: chatName,
    sender,
    senderName,
    messageText,
    classification: "unknown", // will be updated after pipeline
    language: null,
    hasImage: hasImage ? 1 : 0,
    imageUrl,
    processed: 0
  });

  if (!msgId) {
    console.error("[WhatsApp] Failed to save message");
    return;
  }

  // ── STEP 3: Run full ingestion pipeline ──────────────────────────────────
  const pipelineResult = await runIngestionPipeline({
    messageText,
    messageId,
    chatId,
    groupName: chatName,
    sender,
    senderName,
    msgDbId: msgId,
  });

  const { classification: finalClassification, recordId, matchCount, confidence, priority, reviewStatus, extractedData } = pipelineResult;

  console.log(`[Ingestion] ${finalClassification} | confidence=${confidence.toFixed(2)} | priority=${priority} | review=${reviewStatus} | matches=${matchCount} | time=${pipelineResult.processingTimeMs}ms`);

  // ── STEP 4: Update group stats ────────────────────────────────────────────
  if (finalClassification !== 'spam' && finalClassification !== 'unknown') {
    await upsertWhatsappGroup({
      chatId,
      groupName: chatName,
      messageCount: 1,
      supplyCount: finalClassification === "supply" ? 1 : 0,
      demandCount: finalClassification === "demand" ? 1 : 0,
      isActive: 1,
      lastMessageAt: new Date()
    });
    await incrementGroupCounts(chatId, finalClassification as 'supply' | 'demand');
  }

  // ── STEP 5: Mark message processed ───────────────────────────────────────
  await markMessageProcessed(msgId);

  // ── STEP 6: Broadcast to WebSocket clients ────────────────────────────────
  const senderPhone = sender.replace(/@c\.us$/, "");
  const senderPhoneFormatted = senderPhone.startsWith("20") ? "0" + senderPhone.slice(2) : senderPhone;

  broadcast("new_message", {
    id: msgId,
    messageId,
    text: messageText,
    group: chatName,
    sender: senderName || sender,
    classification: finalClassification,
    timestamp: timestamp.toISOString(),
    contact: {
      name: extractedData?.contactName || senderName || senderPhoneFormatted,
      phone: extractedData?.contact || senderPhoneFormatted,
      phoneFormatted: formatPhone(extractedData?.contact || senderPhoneFormatted),
      whatsappLink: generateWhatsAppLink(extractedData?.contact || senderPhoneFormatted)
    },
    data: {
      propertyType: extractedData?.propertyType,
      location: extractedData?.location,
      price: extractedData?.price,
      size: extractedData?.size,
      bedrooms: extractedData?.bedrooms,
      purpose: extractedData?.purpose,
      features: extractedData?.features || []
    },
    pipeline: {
      confidence,
      priority,
      reviewStatus,
      processingTimeMs: pipelineResult.processingTimeMs,
      recordId,
    },
    matches: matchCount,
    hasImage,
    imageUrl
  });

  // ── STEP 7: Broadcast match notification ─────────────────────────────────
  if (matchCount > 0 && recordId) {
    const contactDisplay = extractedData?.contactName
      ? `${extractedData.contactName} (${formatPhone(extractedData.contact) || 'No phone'})`
      : (formatPhone(senderPhoneFormatted) || 'Unknown');

    broadcast("notification", {
      type: "new_match",
      title: `${matchCount} Match${matchCount > 1 ? 'es' : ''} Found!`,
      message: `${contactDisplay} - ${extractedData?.propertyType || "Property"} in ${extractedData?.location || "Unknown"} matched with ${matchCount} ${finalClassification === 'supply' ? 'buyer(s)' : 'seller(s)'}`,
      confidence,
      priority,
      recordId,
      recordType: finalClassification,
    });
  }

  // ── STEP 8: Broadcast review alert for pending items ─────────────────────
  if (reviewStatus === 'pending_review' && recordId) {
    broadcast("review_needed", {
      type: finalClassification,
      recordId,
      confidence,
      messageText: messageText.substring(0, 200),
      group: chatName,
      sender: senderName || senderPhoneFormatted,
    });
  }
}

/**
 * Download image from WhatsApp and upload to S3
 */
async function downloadAndUploadImage(downloadUrl: string, messageId: string): Promise<string | null> {
  try {
    const response = await fetch(downloadUrl);
    if (!response.ok) {
      console.error("[WhatsApp] Failed to download image");
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const fileKey = `whatsapp-images/${messageId}-${Date.now()}.jpg`;
    
    const { url } = await storagePut(fileKey, buffer, "image/jpeg");
    console.log("[WhatsApp] Image uploaded to S3:", url);
    
    return url;
  } catch (error) {
    console.error("[WhatsApp] Image upload error:", error);
    return null;
  }
}

/**
 * Health status endpoint — returns last message time, heartbeat status
 */
whatsappRouter.get("/health", async (req: Request, res: Response) => {
  try {
    const health = await getWhatsAppHealthStatus();
    const instanceId = process.env.GREEN_API_INSTANCE_ID;
    const token = process.env.GREEN_API_TOKEN;
    let instanceState = "unknown";
    if (instanceId && token) {
      try {
        const r = await fetch(
          `https://api.green-api.com/waInstance${instanceId}/getStateInstance/${token}`
        );
        const d = await r.json() as { stateInstance?: string };
        instanceState = d.stateInstance || "unknown";
      } catch { /* ignore */ }
    }
    res.json({
      connected: health.connected,
      status: health.status,
      instanceState,
      lastActivity: health.lastMessageAt ? new Date(health.lastMessageAt).toLocaleString() : "no activity",
      alertActive: health.alertActive
    });
  } catch (error) {
    console.error("[WhatsApp] Health endpoint error:", error);
    res.status(500).json({ error: "Health check failed" });
  }
});

/**
 * Test endpoint to simulate incoming message
 */
whatsappRouter.post("/test-message", async (req: Request, res: Response) => {
  try {
    const { text, groupName = "Test Group" } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: "Message text required" });
    }

    // Simulate webhook data
    const testData = {
      typeWebhook: "incomingMessageReceived",
      messageData: {
        idMessage: `test_${Date.now()}`,
        timestamp: Math.floor(Date.now() / 1000),
        textMessageData: { textMessage: text }
      },
      senderData: {
        chatId: "test_group@g.us",
        sender: "201066505665@c.us",
        senderName: "Test User",
        chatName: groupName
      }
    };

    await handleIncomingMessage(testData);
    
    res.json({ success: true, message: "Test message processed" });
  } catch (error) {
    console.error("[WhatsApp] Test message error:", error);
    res.status(500).json({ error: "Failed to process test message" });
  }
});

/**
 * Parse a message and return extracted data (for testing)
 */
whatsappRouter.post("/parse-test", async (req: Request, res: Response) => {
  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: "Message text required" });
    }

    // Use enhanced parser
    const enhanced = parseWhatsAppMessage(text);
    
    // Also use LLM parser
    let llmParsed = null;
    try {
      llmParsed = await parseRealEstateMessage(text);
    } catch (error) {
      console.error("[Parse] LLM parsing failed");
    }
    
    res.json({
      enhanced,
      llm: llmParsed,
      merged: {
        classification: enhanced.classification !== "unknown" ? enhanced.classification : (llmParsed?.classification || "unknown"),
        contact: {
          name: enhanced.contact.name || llmParsed?.contactName,
          phone: enhanced.contact.phone || llmParsed?.contact,
          phoneFormatted: enhanced.contact.phoneFormatted,
          whatsappLink: enhanced.contact.whatsappLink
        },
        property: {
          type: enhanced.property.type || llmParsed?.propertyType,
          location: enhanced.property.locationNormalized || enhanced.property.location || llmParsed?.location,
          price: enhanced.property.price || llmParsed?.price,
          priceFormatted: enhanced.property.priceFormatted,
          bedrooms: enhanced.property.bedrooms ?? llmParsed?.bedrooms,
          bathrooms: enhanced.property.bathrooms ?? llmParsed?.bathrooms,
          size: enhanced.property.size ?? llmParsed?.size,
          purpose: enhanced.property.purpose || llmParsed?.purpose,
          features: enhanced.property.features.length > 0 ? enhanced.property.features : (llmParsed?.features || [])
        }
      }
    });
  } catch (error) {
    console.error("[Parse] Test error:", error);
    res.status(500).json({ error: "Failed to parse message" });
  }
});
