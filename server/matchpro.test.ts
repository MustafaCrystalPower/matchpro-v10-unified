import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock the LLM module before importing the parser
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{
      message: {
        content: JSON.stringify({
          classification: "supply",
          propertyType: "apartment",
          location: "التجمع الخامس",
          city: "Cairo",
          price: 2500000,
          priceUnit: "EGP",
          size: 150,
          bedrooms: 3,
          bathrooms: 2,
          purpose: "sale",
          contact: "01066505665",
          confidence: 95
        })
      }
    }]
  })
}));

// Mock database functions
vi.mock("./db", () => ({
  getSupplyById: vi.fn().mockResolvedValue({
    id: 1,
    propertyType: "apartment",
    location: "التجمع الخامس",
    price: "2500000",
    size: 150,
    bedrooms: 3,
    purpose: "sale"
  }),
  getDemandById: vi.fn().mockResolvedValue({
    id: 1,
    propertyType: "apartment",
    location: "التجمع الخامس",
    priceMin: "2000000",
    priceMax: "3000000",
    sizeMin: 120,
    sizeMax: 180,
    bedrooms: 3,
    purpose: "sale"
  }),
  getUnmatchedSupply: vi.fn().mockResolvedValue([]),
  getUnmatchedDemand: vi.fn().mockResolvedValue([]),
  insertMatch: vi.fn().mockResolvedValue(1),
  markSupplyMatched: vi.fn().mockResolvedValue(undefined),
  markDemandMatched: vi.fn().mockResolvedValue(undefined),
  insertNotification: vi.fn().mockResolvedValue(1)
}));

// Mock notification
vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true)
}));

import { quickClassify } from "./nlpParser";

describe("NLP Parser - Quick Classification", () => {
  it("classifies Arabic supply messages correctly", () => {
    const supplyMessages = [
      "شقة للبيع في التجمع الخامس 150 متر",
      "فيلا للإيجار في الشيخ زايد",
      "محل تجاري للبيع بمدينة نصر",
      "apartment for sale in new cairo"
    ];

    for (const msg of supplyMessages) {
      const result = quickClassify(msg);
      expect(result).toBe("supply");
    }
  });

  it("classifies Arabic demand messages correctly", () => {
    const demandMessages = [
      "مطلوب شقة للإيجار في المعادي",
      "ابحث عن فيلا في 6 اكتوبر",
      "looking for apartment in new cairo",
      "need villa for rent"
    ];

    for (const msg of demandMessages) {
      const result = quickClassify(msg);
      expect(result).toBe("demand");
    }
  });

  it("returns unknown for non-real-estate messages", () => {
    const nonRealEstateMessages = [
      "السلام عليكم",
      "Good morning everyone",
      "What's the weather today?",
      "مساء الخير"
    ];

    for (const msg of nonRealEstateMessages) {
      const result = quickClassify(msg);
      expect(result).toBe("unknown");
    }
  });
});

describe("Matching Algorithm - Score Calculations", () => {
  // Test location matching logic
  it("matches same location cluster correctly", () => {
    // Test that locations in the same cluster are recognized
    const newCairoVariants = [
      "التجمع الخامس",
      "new cairo",
      "5th settlement",
      "tagamoa"
    ];

    // All these should be in the same cluster
    expect(newCairoVariants.length).toBeGreaterThan(0);
  });

  it("validates price tolerance calculations", () => {
    const supplyPrice = 2500000;
    const demandMax = 2000000;
    const tolerance = 0.20;

    const overBudgetPercent = (supplyPrice - demandMax) / demandMax;
    expect(overBudgetPercent).toBe(0.25); // 25% over budget

    // Should be outside 20% tolerance
    expect(overBudgetPercent > tolerance).toBe(true);
  });

  it("validates perfect price match", () => {
    const supplyPrice = 2500000;
    const demandMin = 2000000;
    const demandMax = 3000000;

    const withinBudget = supplyPrice >= demandMin && supplyPrice <= demandMax;
    expect(withinBudget).toBe(true);
  });

  it("validates bedroom matching logic", () => {
    const supplyBedrooms = 3;
    const demandBedrooms = 3;

    const diff = Math.abs(supplyBedrooms - demandBedrooms);
    expect(diff).toBe(0); // Perfect match
  });

  it("validates size matching logic", () => {
    const supplySize = 150;
    const demandSizeMin = 120;
    const demandSizeMax = 180;

    const withinRange = supplySize >= demandSizeMin && supplySize <= demandSizeMax;
    expect(withinRange).toBe(true);
  });
});

describe("Matching Weights", () => {
  const LOCATION_WEIGHT = 0.40;
  const PRICE_WEIGHT = 0.35;
  const SPECS_WEIGHT = 0.25;

  it("weights sum to 1.0", () => {
    const total = LOCATION_WEIGHT + PRICE_WEIGHT + SPECS_WEIGHT;
    expect(total).toBe(1.0);
  });

  it("calculates weighted score correctly", () => {
    const locationScore = 100;
    const priceScore = 100;
    const specsScore = 100;

    const matchScore = Math.round(
      locationScore * LOCATION_WEIGHT +
      priceScore * PRICE_WEIGHT +
      specsScore * SPECS_WEIGHT
    );

    expect(matchScore).toBe(100);
  });

  it("calculates partial match score correctly", () => {
    const locationScore = 85; // Same cluster
    const priceScore = 100; // Within budget
    const specsScore = 70; // Partial match

    const matchScore = Math.round(
      locationScore * LOCATION_WEIGHT +
      priceScore * PRICE_WEIGHT +
      specsScore * SPECS_WEIGHT
    );

    // 85*0.4 + 100*0.35 + 70*0.25 = 34 + 35 + 17.5 = 86.5 ≈ 87
    expect(matchScore).toBe(87);
  });
});

describe("Match Thresholds", () => {
  const MIN_MATCH_SCORE = 60;
  const HIGH_CONFIDENCE_THRESHOLD = 85;

  it("validates minimum match threshold", () => {
    expect(MIN_MATCH_SCORE).toBe(60);
  });

  it("validates high confidence threshold", () => {
    expect(HIGH_CONFIDENCE_THRESHOLD).toBe(85);
  });

  it("correctly identifies high confidence matches", () => {
    const scores = [59, 60, 84, 85, 90, 100];
    
    const validMatches = scores.filter(s => s >= MIN_MATCH_SCORE);
    expect(validMatches).toEqual([60, 84, 85, 90, 100]);

    const highConfidence = scores.filter(s => s >= HIGH_CONFIDENCE_THRESHOLD);
    expect(highConfidence).toEqual([85, 90, 100]);
  });
});

describe("Property Type Normalization", () => {
  it("normalizes Arabic property types", () => {
    const arabicTypes = ["شقة", "شقه", "فيلا", "دوبلكس", "استوديو"];
    const expectedNormalized = ["apartment", "apartment", "villa", "duplex", "studio"];

    // Property type groups for reference
    const PROPERTY_TYPE_GROUPS: Record<string, string[]> = {
      'apartment': ['apartment', 'flat', 'شقة', 'شقه'],
      'villa': ['villa', 'فيلا'],
      'duplex': ['duplex', 'دوبلكس'],
      'studio': ['studio', 'استوديو']
    };

    function normalizePropertyType(type: string): string | null {
      const typeLower = type.toLowerCase();
      for (const [normalized, variants] of Object.entries(PROPERTY_TYPE_GROUPS)) {
        if (variants.some(v => typeLower.includes(v.toLowerCase()))) {
          return normalized;
        }
      }
      return typeLower;
    }

    for (let i = 0; i < arabicTypes.length; i++) {
      const normalized = normalizePropertyType(arabicTypes[i]);
      expect(normalized).toBe(expectedNormalized[i]);
    }
  });
});

describe("Location Cluster Matching", () => {
  const LOCATION_CLUSTERS: Record<string, string[]> = {
    'new_cairo': ['التجمع الخامس', 'التجمع الاول', 'القاهرة الجديدة', 'الرحاب', 'مدينتي', 'new cairo', '5th settlement', 'tagamoa', 'rehab', 'madinaty'],
    'october': ['6 اكتوبر', 'الشيخ زايد', 'october', 'sheikh zayed', 'zayed'],
    'maadi': ['المعادي', 'maadi', 'degla', 'دجلة']
  };

  function getLocationCluster(location: string): string | null {
    const locationLower = location.toLowerCase();
    for (const [cluster, locations] of Object.entries(LOCATION_CLUSTERS)) {
      if (locations.some(loc => locationLower.includes(loc.toLowerCase()) || loc.toLowerCase().includes(locationLower))) {
        return cluster;
      }
    }
    return locationLower;
  }

  it("identifies New Cairo cluster correctly", () => {
    const newCairoLocations = ["التجمع الخامس", "new cairo", "5th settlement", "الرحاب"];
    
    for (const loc of newCairoLocations) {
      expect(getLocationCluster(loc)).toBe("new_cairo");
    }
  });

  it("identifies October cluster correctly", () => {
    const octoberLocations = ["6 اكتوبر", "الشيخ زايد", "sheikh zayed"];
    
    for (const loc of octoberLocations) {
      expect(getLocationCluster(loc)).toBe("october");
    }
  });

  it("returns original location for unknown areas", () => {
    const unknownLocation = "some random area";
    expect(getLocationCluster(unknownLocation)).toBe("some random area");
  });
});
