/**
 * WhatsApp Integration Module
 * Sends WhatsApp messages from the application using Green API
 * NOT from Manus - Direct integration with user's WhatsApp Business account
 */

const GREEN_API_INSTANCE_ID = process.env.GREEN_API_INSTANCE_ID;
const GREEN_API_TOKEN = process.env.GREEN_API_TOKEN;
const GREEN_API_URL = 'https://api.green-api.com';

export interface WhatsAppMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send WhatsApp message using Green API
 * Sends from the application's WhatsApp Business account
 */
export async function sendWhatsAppMessage(
  phoneNumber: string,
  message: string
): Promise<boolean> {
  try {
    if (!GREEN_API_INSTANCE_ID || !GREEN_API_TOKEN) {
      console.warn('[WhatsApp] Green API credentials not configured');
      return false;
    }

    // Normalize phone number (remove + and spaces)
    const normalizedPhone = phoneNumber.replace(/[\s+]/g, '');

    console.log(`[WhatsApp] Sending message to ${normalizedPhone}...`);

    const response = await fetch(
      `${GREEN_API_URL}/waInstance${GREEN_API_INSTANCE_ID}/sendMessage/${GREEN_API_TOKEN}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatId: `${normalizedPhone}@c.us`,
          message: message,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error(`[WhatsApp] API error: ${response.status} - ${error}`);
      return false;
    }

    const result = await response.json();

    if (result.idMessage) {
      console.log(`[WhatsApp] Message sent successfully: ${result.idMessage}`);
      return true;
    } else {
      console.error(`[WhatsApp] Failed to send message:`, result);
      return false;
    }
  } catch (error: any) {
    console.error(`[WhatsApp] Error sending message:`, error.message);
    return false;
  }
}

/**
 * Send WhatsApp message with media
 */
export async function sendWhatsAppMediaMessage(
  phoneNumber: string,
  caption: string,
  mediaUrl: string,
  mediaType: 'image' | 'document' | 'video' = 'image'
): Promise<boolean> {
  try {
    if (!GREEN_API_INSTANCE_ID || !GREEN_API_TOKEN) {
      console.warn('[WhatsApp] Green API credentials not configured');
      return false;
    }

    const normalizedPhone = phoneNumber.replace(/[\s+]/g, '');

    console.log(`[WhatsApp] Sending ${mediaType} to ${normalizedPhone}...`);

    const payload: any = {
      chatId: `${normalizedPhone}@c.us`,
      caption: caption,
    };

    // Add media URL based on type
    if (mediaType === 'image') {
      payload.urlFile = mediaUrl;
    } else if (mediaType === 'document') {
      payload.urlFile = mediaUrl;
      payload.filename = 'document.pdf';
    } else if (mediaType === 'video') {
      payload.urlFile = mediaUrl;
    }

    const response = await fetch(
      `${GREEN_API_URL}/waInstance${GREEN_API_INSTANCE_ID}/send${
        mediaType === 'image' ? 'FileByUrl' : mediaType === 'document' ? 'FileByUrl' : 'VideoByUrl'
      }/${GREEN_API_TOKEN}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error(`[WhatsApp] API error: ${response.status} - ${error}`);
      return false;
    }

    const result = await response.json();

    if (result.idMessage) {
      console.log(`[WhatsApp] Media message sent: ${result.idMessage}`);
      return true;
    } else {
      console.error(`[WhatsApp] Failed to send media:`, result);
      return false;
    }
  } catch (error: any) {
    console.error(`[WhatsApp] Error sending media:`, error.message);
    return false;
  }
}

/**
 * Send WhatsApp message to multiple recipients
 */
export async function sendWhatsAppMessageBatch(
  phoneNumbers: string[],
  message: string
): Promise<number> {
  console.log(`[WhatsApp] Sending batch message to ${phoneNumbers.length} recipients...`);

  let successCount = 0;

  for (const phone of phoneNumbers) {
    try {
      const success = await sendWhatsAppMessage(phone, message);
      if (success) {
        successCount++;
      }
      // Add delay between messages to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error: any) {
      console.error(`[WhatsApp] Failed to send to ${phone}:`, error.message);
    }
  }

  console.log(`[WhatsApp] Batch complete: ${successCount}/${phoneNumbers.length} sent`);
  return successCount;
}

/**
 * Check WhatsApp connection status
 */
export async function checkWhatsAppStatus(): Promise<boolean> {
  try {
    if (!GREEN_API_INSTANCE_ID || !GREEN_API_TOKEN) {
      console.warn('[WhatsApp] Green API credentials not configured');
      return false;
    }

    const response = await fetch(
      `${GREEN_API_URL}/waInstance${GREEN_API_INSTANCE_ID}/getStatusInstance/${GREEN_API_TOKEN}`
    );

    if (!response.ok) {
      return false;
    }

    const result = await response.json();
    const isConnected = result.statusInstance === 'authorized';

    console.log(`[WhatsApp] Connection status: ${result.statusInstance}`);
    return isConnected;
  } catch (error: any) {
    console.error(`[WhatsApp] Error checking status:`, error.message);
    return false;
  }
}

/**
 * Get WhatsApp account info
 */
export async function getWhatsAppAccountInfo(): Promise<any> {
  try {
    if (!GREEN_API_INSTANCE_ID || !GREEN_API_TOKEN) {
      console.warn('[WhatsApp] Green API credentials not configured');
      return null;
    }

    const response = await fetch(
      `${GREEN_API_URL}/waInstance${GREEN_API_INSTANCE_ID}/getMe/${GREEN_API_TOKEN}`
    );

    if (!response.ok) {
      return null;
    }

    const result = await response.json();
    console.log(`[WhatsApp] Account info:`, result);
    return result;
  } catch (error: any) {
    console.error(`[WhatsApp] Error getting account info:`, error.message);
    return null;
  }
}
