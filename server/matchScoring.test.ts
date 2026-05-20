import { describe, it, expect } from "vitest";
import { generateMatchSummary, generateMatchExplanation, generateMatchLabel, formatPrice, calculateSavings } from "./matchSummaryGenerator";

describe("Match Score Capping", () => {
  it("should cap match summary score at 100%", () => {
    const summary = generateMatchSummary(
      { contactName: "Ahmed", contact: "01234567890", propertyType: "apartment", location: "Sheikh Zayed", price: "2000000", bedrooms: 3 },
      { contactName: "Mohamed", contact: "01098765432", propertyType: "apartment", location: "Sheikh Zayed", priceMax: "3000000" },
      170 // Score > 100
    );
    expect(summary).toContain("Matched (100%)");
    expect(summary).not.toContain("Matched (170%)");
  });

  it("should cap explanation score breakdown at 100%", () => {
    const explanation = generateMatchExplanation(
      { propertyType: "apartment", location: "Sheikh Zayed", price: "2000000", bedrooms: 3 },
      { propertyType: "apartment", location: "Sheikh Zayed", priceMax: "3000000", bedrooms: 3 },
      170,
      100, // location
      299, // price > 100
      150  // specs > 100
    );
    expect(explanation).toContain("Location: 100% (weight: 40%)");
    expect(explanation).toContain("Price: 100% (weight: 35%)");
    expect(explanation).toContain("Specs: 100% (weight: 25%)");
    expect(explanation).not.toContain("299%");
    expect(explanation).not.toContain("150%");
  });

  it("should show Excellent match for scores >= 90 even when capped", () => {
    const explanation = generateMatchExplanation(
      { propertyType: "apartment", location: "مدينتي" },
      { propertyType: "apartment", location: "مدينتي" },
      170 // Will be capped to 100, still >= 90
    );
    expect(explanation).toContain("Excellent match");
  });

  it("should show Good match for score 80", () => {
    const explanation = generateMatchExplanation(
      { propertyType: "apartment", location: "مدينتي" },
      { propertyType: "apartment", location: "مدينتي" },
      80
    );
    expect(explanation).toContain("Good match");
  });

  it("should show Moderate match for score 65", () => {
    const explanation = generateMatchExplanation(
      { propertyType: "apartment", location: "مدينتي" },
      { propertyType: "apartment", location: "مدينتي" },
      65
    );
    expect(explanation).toContain("Moderate match");
  });

  it("should show Weak match for score 40", () => {
    const explanation = generateMatchExplanation(
      { propertyType: "apartment", location: "مدينتي" },
      { propertyType: "apartment", location: "مدينتي" },
      40
    );
    expect(explanation).toContain("Weak match");
  });
});

describe("Match Summary Generation", () => {
  it("should include buyer and seller names and phones", () => {
    const summary = generateMatchSummary(
      { contactName: "Soaad", contact: "01030642200", propertyType: "apartment", location: "مدينتي", price: "18000", bedrooms: 3 },
      { contactName: "مليون عميل جاد", contact: "01155603755", propertyType: "apartment", location: "مدينتي", priceMax: "3000000" },
      95
    );
    expect(summary).toContain("مليون عميل جاد");
    expect(summary).toContain("01155603755");
    expect(summary).toContain("Soaad");
    expect(summary).toContain("01030642200");
    expect(summary).toContain("95%");
  });

  it("should handle missing contact names gracefully", () => {
    const summary = generateMatchSummary(
      { contact: "01234567890", propertyType: "villa", location: "New Cairo" },
      { contact: "01098765432", location: "New Cairo" },
      85
    );
    expect(summary).toContain("Anonymous Buyer");
    expect(summary).toContain("Anonymous Seller");
  });

  it("should format prices correctly", () => {
    const summary = generateMatchSummary(
      { contactName: "Test", contact: "01234567890", price: "2500000" },
      { contactName: "Test2", contact: "01098765432", priceMax: "3000000" },
      90
    );
    expect(summary).toContain("3.0M EGP");
    expect(summary).toContain("2.5M EGP");
  });
});

describe("Match Explanation Generation", () => {
  it("should show location match when both are same", () => {
    const explanation = generateMatchExplanation(
      { location: "Sheikh Zayed", propertyType: "apartment" },
      { location: "Sheikh Zayed", propertyType: "apartment" },
      90
    );
    expect(explanation).toContain("Location match: Both in Sheikh Zayed");
  });

  it("should show price match with savings", () => {
    const explanation = generateMatchExplanation(
      { price: "2000000" },
      { priceMax: "3000000" },
      85
    );
    expect(explanation).toContain("Price match");
    expect(explanation).toContain("potential savings");
  });

  it("should show price over budget warning", () => {
    const explanation = generateMatchExplanation(
      { price: "5000000" },
      { priceMax: "3000000" },
      60
    );
    expect(explanation).toContain("Price over budget");
  });

  it("should show bedroom match", () => {
    const explanation = generateMatchExplanation(
      { bedrooms: 3 },
      { bedrooms: 3 },
      85
    );
    expect(explanation).toContain("Bedrooms: 3 bedrooms (exact match)");
  });

  it("should show property type mismatch", () => {
    const explanation = generateMatchExplanation(
      { propertyType: "villa" },
      { propertyType: "apartment" },
      60
    );
    expect(explanation).toContain("Property type: Villa vs Apartment");
  });
});

describe("formatPrice", () => {
  it("should format millions", () => {
    expect(formatPrice(2500000)).toBe("2.5M EGP");
  });

  it("should format thousands", () => {
    expect(formatPrice(18000)).toBe("18K EGP");
  });

  it("should handle null", () => {
    expect(formatPrice(null)).toBe("price negotiable");
  });

  it("should handle string input", () => {
    expect(formatPrice("3000000")).toBe("3.0M EGP");
  });
});

describe("generateMatchLabel", () => {
  it("should return Excellent Match for 90+", () => {
    expect(generateMatchLabel(95).text).toBe("Excellent Match");
  });

  it("should return Good Match for 75-89", () => {
    expect(generateMatchLabel(80).text).toBe("Good Match");
  });

  it("should return Moderate Match for 60-74", () => {
    expect(generateMatchLabel(65).text).toBe("Moderate Match");
  });

  it("should return Weak Match for <60", () => {
    expect(generateMatchLabel(40).text).toBe("Weak Match");
  });
});

describe("calculateSavings", () => {
  it("should calculate savings correctly", () => {
    expect(calculateSavings(2000000, 3000000)).toBe(1000000);
  });

  it("should return null when no savings", () => {
    expect(calculateSavings(3000000, 2000000)).toBeNull();
  });

  it("should return null for null inputs", () => {
    expect(calculateSavings(null, null)).toBeNull();
  });
});
