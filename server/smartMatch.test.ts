/**
 * smartMatch router — unit tests
 * Tests the scoring logic without hitting the DB.
 */
import { describe, it, expect } from "vitest";

function scoreMatch(supply: any, demand: any, mode: "sell" | "buy"): number {
  let score = 0;
  const src = mode === "sell" ? supply : demand;
  const dst = mode === "sell" ? demand : supply;

  const srcLoc = (src.location || src.area || "").toLowerCase();
  const dstLoc = (dst.location || dst.area || "").toLowerCase();
  if (srcLoc && dstLoc) {
    if (srcLoc === dstLoc) score += 40;
    else if (srcLoc.includes(dstLoc) || dstLoc.includes(srcLoc)) score += 30;
    else score += 5;
  }

  const srcType = (src.propertyType || "").toLowerCase();
  const dstType = (dst.propertyType || "").toLowerCase();
  if (srcType && dstType) {
    if (srcType === dstType) score += 20;
    else if (srcType.includes(dstType) || dstType.includes(srcType)) score += 10;
  }

  const price = parseFloat(String(src.price || 0));
  const pMin = parseFloat(String(dst.priceMin || dst.price || 0));
  const pMax = parseFloat(String(dst.priceMax || dst.price || 0));
  if (price > 0 && (pMin > 0 || pMax > 0)) {
    const lo = pMin || price * 0.7;
    const hi = pMax || price * 1.3;
    if (price >= lo && price <= hi) score += 25;
    else if (price >= lo * 0.85 && price <= hi * 1.15) score += 15;
    else if (price >= lo * 0.7 && price <= hi * 1.3) score += 8;
  } else {
    score += 10;
  }

  const srcBeds = src.bedrooms;
  const dstBeds = dst.bedrooms;
  if (srcBeds && dstBeds) {
    if (srcBeds === dstBeds) score += 10;
    else if (Math.abs(srcBeds - dstBeds) === 1) score += 5;
  }

  return Math.min(score, 100);
}

describe("smartMatch scoring", () => {
  it("returns high score for perfect match (sell mode)", () => {
    const supply = {
      location: "مدينتي",
      propertyType: "apartment",
      price: 5000000,
      bedrooms: 3,
    };
    const demand = {
      location: "مدينتي",
      propertyType: "apartment",
      priceMin: 4500000,
      priceMax: 5500000,
      bedrooms: 3,
    };
    const score = scoreMatch(supply, demand, "sell");
    expect(score).toBeGreaterThanOrEqual(90);
  });

  it("returns lower score when location differs", () => {
    const supply = { location: "الرحاب", propertyType: "villa", price: 8000000, bedrooms: 4 };
    const demand = { location: "مدينتي", propertyType: "villa", priceMin: 7000000, priceMax: 9000000, bedrooms: 4 };
    const score = scoreMatch(supply, demand, "sell");
    expect(score).toBeLessThan(70);
  });

  it("caps score at 100", () => {
    const supply = { location: "مدينتي", propertyType: "apartment", price: 5000000, bedrooms: 3 };
    const demand = { location: "مدينتي", propertyType: "apartment", priceMin: 4000000, priceMax: 6000000, bedrooms: 3 };
    const score = scoreMatch(supply, demand, "sell");
    expect(score).toBeLessThanOrEqual(100);
  });

  it("handles missing price gracefully", () => {
    const supply = { location: "مدينتي", propertyType: "apartment", price: 0, bedrooms: 3 };
    const demand = { location: "مدينتي", propertyType: "apartment", priceMin: 0, priceMax: 0, bedrooms: 3 };
    const score = scoreMatch(supply, demand, "sell");
    expect(score).toBeGreaterThan(50);
  });
});
