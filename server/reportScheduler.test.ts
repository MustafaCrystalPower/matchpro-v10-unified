import { describe, it, expect } from "vitest";
import { normalizeLocationToKey, getAllLocationKeys, getLocationDisplayName, getWhatsappGroupForLocation } from "./locationMappings";
import { maskPhoneNumber, generateOTP, verifyOTP, countPropertyTypes, generateWhatsappMessage } from "./secureReportGenerator";

describe("Location Mappings", () => {
  it("should normalize Fifth Settlement keywords", () => {
    expect(normalizeLocationToKey("التجمع الخامس")).toBe("FIFTH_SETTLEMENT");
    expect(normalizeLocationToKey("Fifth Settlement")).toBe("FIFTH_SETTLEMENT");
    expect(normalizeLocationToKey("Hyde Park")).toBe("FIFTH_SETTLEMENT");
  });

  it("should normalize Madinaty keywords", () => {
    expect(normalizeLocationToKey("مدينتي")).toBe("MADINATY");
    expect(normalizeLocationToKey("Madinaty")).toBe("MADINATY");
    expect(normalizeLocationToKey("B1")).toBe("MADINATY");
  });

  it("should normalize Rehab keywords", () => {
    expect(normalizeLocationToKey("الرحاب")).toBe("REHAB");
    expect(normalizeLocationToKey("Rehab")).toBe("REHAB");
    expect(normalizeLocationToKey("Phase 1")).toBe("REHAB");
  });

  it("should default to OTHER_AREAS for unknown locations", () => {
    expect(normalizeLocationToKey("Unknown Place")).toBe("OTHER_AREAS");
    expect(normalizeLocationToKey("")).toBe("OTHER_AREAS");
  });

  it("should get all location keys", () => {
    const keys = getAllLocationKeys();
    expect(keys).toContain("FIFTH_SETTLEMENT");
    expect(keys).toContain("MADINATY");
    expect(keys).toContain("OTHER_AREAS");
    expect(keys.length).toBeGreaterThan(5);
  });

  it("should get location display names", () => {
    const names = getLocationDisplayName("FIFTH_SETTLEMENT");
    expect(names.arabic).toBe("التجمع الخامس");
    expect(names.english).toBe("Fifth Settlement");
  });

  it("should get WhatsApp group for location", () => {
    expect(getWhatsappGroupForLocation("FIFTH_SETTLEMENT")).toBe("Fifth_Settlement_Brokers");
    expect(getWhatsappGroupForLocation("MADINATY")).toBe("Madinaty_Brokers");
  });
});

describe("Secure Report Generator", () => {
  it("should mask phone numbers correctly", () => {
    expect(maskPhoneNumber("201001234567")).toBe("****4567");
    expect(maskPhoneNumber("20100")).toBe("****0100");
    expect(maskPhoneNumber("")).toBe("****");
  });

  it("should generate valid OTP", () => {
    const otp = generateOTP();
    expect(otp).toMatch(/^\d{6}$/);
  });

  it("should verify OTP correctly", () => {
    const otp = "123456";
    expect(verifyOTP("123456", otp)).toBe(true);
    expect(verifyOTP("654321", otp)).toBe(false);
  });

  it("should count property types correctly", () => {
    const demands = [
      { propertyType: "apartment" } as any,
      { propertyType: "apartment" } as any,
      { propertyType: "villa" } as any,
      { propertyType: "chalet" } as any,
      { propertyType: "townhouse" } as any,
    ];

    const counts = countPropertyTypes(demands);
    expect(counts.apartments).toBe(2);
    expect(counts.villas).toBe(1);
    expect(counts.chalets).toBe(1);
    expect(counts.other).toBe(1);
  });

  it("should handle empty demands array", () => {
    const counts = countPropertyTypes([]);
    expect(counts.apartments).toBe(0);
    expect(counts.villas).toBe(0);
    expect(counts.chalets).toBe(0);
    expect(counts.other).toBe(0);
  });
});

describe("Report Distribution", () => {
  it("should format WhatsApp message with required content", () => {
    const message = generateWhatsappMessage(
      "FIFTH_SETTLEMENT",
      45,
      28,
      12,
      5,
      "https://matchpro.link/r/abc123",
      "847291"
    );

    expect(message).toContain("MatchPro™");
    expect(message).toContain("Fifth Settlement");
    expect(message).toContain("45");
    expect(message).toContain("28");
    expect(message).toContain("847291");
    expect(message).toContain("Do not share");
  });

  it("should include all required fields in WhatsApp message", () => {
    const message = generateWhatsappMessage(
      "MADINATY",
      30,
      20,
      8,
      2,
      "https://example.com/report",
      "654321"
    );

    expect(message).toContain("Date:");
    expect(message).toContain("Time:");
    expect(message).toContain("Total Demands:");
    expect(message).toContain("Secure Access");
    expect(message).toContain("PIN:");
    expect(message).toContain("Expires in 15 minutes");
  });
});
