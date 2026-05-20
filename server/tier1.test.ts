/**
 * Tier 1 regression tests
 * 1. NLP: block codes not as locations/sizes, size range 40-500m2, duration != bedrooms
 * 2. Match deduplication: insertMatch upserts by phone pair
 *
 * NOTE: No outbound messaging tests — platform is match-only, no messages sent.
 */

import { describe, it, expect } from "vitest";
import {
  extractLocation,
  extractSize,
  extractBedrooms,
} from "./enhancedParser";

// ─── 1. NLP FIXES ────────────────────────────────────────────────────────────

describe("NLP: block codes are NOT locations", () => {
  it("should not extract B6 as a location", () => {
    const result = extractLocation("شقة B6 مدينتي للبيع");
    // B6 is a block code — location should be مدينتي, not B6
    expect(result.normalized).toBe("مدينتي");
  });

  it("should not extract B12 as a location", () => {
    const result = extractLocation("وحدة B12 بالرحاب");
    expect(result.normalized).toBe("الرحاب");
  });

  it("should not extract Q1 as a location", () => {
    const result = extractLocation("Q1 مدينتي 3 غرف");
    expect(result.normalized).toBe("مدينتي");
  });

  it("should still extract real locations correctly", () => {
    const result = extractLocation("شقة للبيع في التجمع الخامس");
    expect(result.normalized).toBe("التجمع الخامس");
  });
});

describe("NLP: size range 40-500m2 only", () => {
  it("should extract valid size 120m2", () => {
    expect(extractSize("شقة 120 متر للبيع")).toBe(120);
  });

  it("should reject size below 40 (e.g. 25m2 — too small)", () => {
    expect(extractSize("غرفة 25 متر")).toBeNull();
  });

  it("should reject size above 500 (e.g. 1200m2 — likely land)", () => {
    expect(extractSize("ارض 1200 متر")).toBeNull();
  });

  it("should NOT extract block code B6 as size 6m2", () => {
    // "B6متر" — the 6 is preceded by letter B, must not be parsed as size
    expect(extractSize("B6متر مدينتي")).toBeNull();
  });

  it("should NOT extract B12 as size 12m2", () => {
    expect(extractSize("وحدة B12متر")).toBeNull();
  });
});

describe("NLP: rental months != bedrooms", () => {
  it("should not parse 6 months as 6 bedrooms", () => {
    expect(extractBedrooms("ايجار 6 شهور")).toBeNull();
  });

  it("should not parse 12 months as 12 bedrooms", () => {
    expect(extractBedrooms("عقد 12 شهر")).toBeNull();
  });

  it("should still parse 3 bedrooms correctly", () => {
    expect(extractBedrooms("شقة 3 غرف نوم")).toBe(3);
  });

  it("should parse غرفتين as 2 bedrooms", () => {
    expect(extractBedrooms("شقة غرفتين وصالة")).toBe(2);
  });
});
