import { describe, it, expect } from "vitest";

// ── Inline helpers copied from ingestionPipeline.ts for unit testing ──────────

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0") && digits.length === 11) return "2" + digits;
  if (digits.startsWith("2") && digits.length === 12) return digits;
  return digits;
}

function normalizePrice(raw: string | number | null | undefined): number | null {
  if (!raw) return null;
  const str = String(raw).replace(/,/g, "").replace(/\s/g, "").toLowerCase();
  const num = parseFloat(str.replace(/[^0-9.]/g, ""));
  if (isNaN(num)) return null;
  if (str.includes("مليون") || str.includes("million") || str.includes("m")) return Math.round(num * 1_000_000);
  if (str.includes("ألف") || str.includes("الف") || str.includes("k")) return Math.round(num * 1_000);
  return Math.round(num);
}

function normalizePropertyType(raw: string | null | undefined): string {
  if (!raw) return "apartment";
  const t = raw.toLowerCase();
  if (t.includes("villa") || t.includes("فيلا")) return "villa";
  if (t.includes("duplex") || t.includes("دوبلكس")) return "duplex";
  if (t.includes("penthouse") || t.includes("بنتهاوس")) return "penthouse";
  if (t.includes("studio") || t.includes("ستوديو")) return "studio";
  if (t.includes("townhouse") || t.includes("تاون")) return "townhouse";
  if (t.includes("apartment") || t.includes("شقة") || t.includes("شقه")) return "apartment";
  return "apartment";
}

function computeConfidence(extracted: Record<string, any>): number {
  const fields = ["propertyType", "location", "price", "purpose"];
  const filled = fields.filter(f => extracted[f] != null && extracted[f] !== "").length;
  const base = filled / fields.length;
  const bonus = extracted.bedrooms ? 0.05 : 0;
  const bonus2 = extracted.size ? 0.05 : 0;
  return Math.min(1, base + bonus + bonus2);
}

function computePriority(confidence: number, purpose: string | null): "high" | "medium" | "low" {
  if (confidence >= 0.75) return "high";
  if (confidence >= 0.5) return "medium";
  return "low";
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("normalizePhone", () => {
  it("converts Egyptian 11-digit number to 12-digit", () => {
    expect(normalizePhone("01066505665")).toBe("201066505665");
  });

  it("leaves 12-digit number unchanged", () => {
    expect(normalizePhone("201066505665")).toBe("201066505665");
  });

  it("strips non-digit characters", () => {
    expect(normalizePhone("+20 106 650 5665")).toBe("201066505665");
  });
});

describe("normalizePrice", () => {
  it("parses plain number", () => {
    expect(normalizePrice(2500000)).toBe(2500000);
  });

  it("parses million suffix", () => {
    expect(normalizePrice("2.5 million")).toBe(2500000);
  });

  it("parses Arabic million", () => {
    expect(normalizePrice("2.5 مليون")).toBe(2500000);
  });

  it("parses K suffix", () => {
    expect(normalizePrice("500k")).toBe(500000);
  });

  it("returns null for empty input", () => {
    expect(normalizePrice(null)).toBeNull();
    expect(normalizePrice("")).toBeNull();
  });
});

describe("normalizePropertyType", () => {
  it("maps villa correctly", () => {
    expect(normalizePropertyType("Villa")).toBe("villa");
    expect(normalizePropertyType("فيلا")).toBe("villa");
  });

  it("maps apartment correctly", () => {
    expect(normalizePropertyType("شقة")).toBe("apartment");
    expect(normalizePropertyType("Apartment")).toBe("apartment");
  });

  it("defaults to apartment for unknown", () => {
    expect(normalizePropertyType("unknown type")).toBe("apartment");
    expect(normalizePropertyType(null)).toBe("apartment");
  });
});

describe("computeConfidence", () => {
  it("returns 1.0 for fully populated record", () => {
    const score = computeConfidence({
      propertyType: "villa",
      location: "New Cairo",
      price: 3000000,
      purpose: "sale",
      bedrooms: 4,
      size: 250,
    });
    expect(score).toBe(1.0);
  });

  it("returns 0.25 for minimal record", () => {
    const score = computeConfidence({ propertyType: "apartment" });
    expect(score).toBe(0.25);
  });

  it("returns 0.5 for half-filled record", () => {
    const score = computeConfidence({ propertyType: "villa", location: "Maadi" });
    expect(score).toBe(0.5);
  });
});

describe("computePriority", () => {
  it("returns high for confidence >= 0.75", () => {
    expect(computePriority(0.9, "sale")).toBe("high");
    expect(computePriority(0.75, "rent")).toBe("high");
  });

  it("returns medium for confidence 0.5–0.74", () => {
    expect(computePriority(0.6, "sale")).toBe("medium");
    expect(computePriority(0.5, "rent")).toBe("medium");
  });

  it("returns low for confidence < 0.5", () => {
    expect(computePriority(0.3, "sale")).toBe("low");
    expect(computePriority(0, null)).toBe("low");
  });
});
