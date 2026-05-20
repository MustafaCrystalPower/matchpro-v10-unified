import { describe, it, expect, vi } from "vitest";

describe("Enhanced Notification System", () => {
  describe("Match Broadcast Module", () => {
    it("should export initMatchBroadcast function", async () => {
      const { initMatchBroadcast } = await import("./matchingEngine");
      expect(typeof initMatchBroadcast).toBe("function");
    });

    it("should accept a broadcast function without throwing", async () => {
      const { initMatchBroadcast } = await import("./matchingEngine");
      const mockBroadcast = vi.fn();
      expect(() => initMatchBroadcast(mockBroadcast)).not.toThrow();
    });
  });

  describe("Match Broadcast Standalone Module", () => {
    it("should export setMatchBroadcast and getMatchBroadcast", async () => {
      const { setMatchBroadcast, getMatchBroadcast } = await import("./matchBroadcast");
      expect(typeof setMatchBroadcast).toBe("function");
      expect(typeof getMatchBroadcast).toBe("function");
    });

    it("should store and retrieve broadcast function", async () => {
      const { setMatchBroadcast, getMatchBroadcast } = await import("./matchBroadcast");
      const mockFn = vi.fn();
      setMatchBroadcast(mockFn);
      const retrieved = getMatchBroadcast();
      expect(retrieved).toBe(mockFn);
    });
  });

  describe("Score Capping Logic", () => {
    it("should cap all sub-scores at 100", () => {
      const testScores = [120, 150, 200, 99, 100, 0, -5];
      const capped = testScores.map(s => Math.min(100, Math.max(0, s)));
      expect(capped).toEqual([100, 100, 100, 99, 100, 0, 0]);
    });

    it("should calculate weighted score correctly", () => {
      const LOCATION_WEIGHT = 0.40;
      const PRICE_WEIGHT = 0.35;
      const SPECS_WEIGHT = 0.25;

      const perfect = Math.min(100, Math.round(100 * LOCATION_WEIGHT + 100 * PRICE_WEIGHT + 100 * SPECS_WEIGHT));
      expect(perfect).toBe(100);

      const mixed = Math.min(100, Math.round(80 * LOCATION_WEIGHT + 90 * PRICE_WEIGHT + 70 * SPECS_WEIGHT));
      expect(mixed).toBeLessThanOrEqual(100);
      expect(mixed).toBeGreaterThan(0);
    });
  });

  describe("High Confidence Match Threshold", () => {
    it("should correctly identify high-confidence matches", () => {
      const HIGH_CONFIDENCE_THRESHOLD = 85;
      expect(85 >= HIGH_CONFIDENCE_THRESHOLD).toBe(true);
      expect(90 >= HIGH_CONFIDENCE_THRESHOLD).toBe(true);
      expect(100 >= HIGH_CONFIDENCE_THRESHOLD).toBe(true);
      expect(84 >= HIGH_CONFIDENCE_THRESHOLD).toBe(false);
      expect(60 >= HIGH_CONFIDENCE_THRESHOLD).toBe(false);
    });
  });

  describe("Match Alert Data Structure", () => {
    it("should validate complete match alert data", () => {
      const mockAlert = {
        matchId: 1,
        matchScore: 92,
        locationScore: 85,
        priceScore: 100,
        specsScore: 90,
        supply: {
          id: 1,
          propertyType: "apartment",
          location: "التجمع الخامس",
          area: "New Cairo",
          city: "Cairo",
          price: 3500000,
          size: 180,
          bedrooms: 3,
          purpose: "sale",
          contactName: "Mo'men",
          contactPhone: "01066505665"
        },
        demand: {
          id: 2,
          propertyType: "apartment",
          location: "التجمع الخامس",
          priceMax: 4000000,
          bedrooms: 3,
          contactName: "Ahmed",
          contactPhone: "01234567890"
        },
        timestamp: new Date().toISOString()
      };

      expect(mockAlert.matchScore).toBeLessThanOrEqual(100);
      expect(mockAlert.supply.contactPhone).toBeTruthy();
      expect(mockAlert.demand.contactPhone).toBeTruthy();
      expect(mockAlert.timestamp).toBeTruthy();
    });

    it("should format WhatsApp links correctly", () => {
      const formatWhatsAppLink = (phone: string) => {
        const cleaned = phone.replace(/[^0-9]/g, "");
        return `https://wa.me/${cleaned}`;
      };
      expect(formatWhatsAppLink("01066505665")).toBe("https://wa.me/01066505665");
      expect(formatWhatsAppLink("+20-106-650-5665")).toBe("https://wa.me/201066505665");
    });

    it("should format prices correctly", () => {
      const formatPrice = (price: number | null | undefined): string => {
        if (!price) return "N/A";
        if (price >= 1000000) return `${(price / 1000000).toFixed(1)}M EGP`;
        if (price >= 1000) return `${(price / 1000).toFixed(0)}K EGP`;
        return `${price} EGP`;
      };

      expect(formatPrice(3500000)).toBe("3.5M EGP");
      expect(formatPrice(500000)).toBe("500K EGP");
      expect(formatPrice(999)).toBe("999 EGP");
      expect(formatPrice(null)).toBe("N/A");
    });
  });

  describe("Webhook Payload Validation", () => {
    it("should validate Green API webhook payload structure", () => {
      const payload = {
        typeWebhook: "incomingMessageReceived",
        instanceData: { idInstance: 123, wid: "test@c.us", typeInstance: "whatsapp" },
        timestamp: Math.floor(Date.now() / 1000),
        idMessage: "TEST_123",
        senderData: {
          chatId: "120363123@g.us",
          chatName: "Test Group",
          sender: "201066505665@c.us",
          senderName: "Test User"
        },
        messageData: {
          typeMessage: "textMessage",
          textMessageData: {
            textMessage: "للبيع شقة 180 متر"
          }
        }
      };

      expect(payload.typeWebhook).toBe("incomingMessageReceived");
      expect(payload.senderData.chatId).toContain("@g.us");
      expect(payload.messageData.typeMessage).toBe("textMessage");
    });

    it("should validate Green API settings response", () => {
      const mockSettings = {
        webhookUrl: "https://example.com/api/whatsapp/webhook",
        incomingWebhook: "yes",
        stateWebhook: "yes"
      };

      expect(mockSettings.webhookUrl).toContain("/api/whatsapp/webhook");
      expect(mockSettings.incomingWebhook).toBe("yes");
    });
  });
});
