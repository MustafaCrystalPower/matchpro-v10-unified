/**
 * MatchPro Keyword Normalization Layer
 * ------------------------------------
 * Handles Arabic/English variants, emoji noise, casing, punctuation,
 * and provides a strict property-type ontology with compatibility rules.
 */

// ─── Property Type Ontology ───────────────────────────────────────────────────

/**
 * Canonical property type names.
 * Each canonical type maps to all accepted surface forms (Arabic + English).
 */
export const PROPERTY_TYPE_ONTOLOGY: Record<string, string[]> = {
  apartment:  ['apartment', 'flat', 'شقة', 'شقه', 'شقق', 'apt'],
  studio:     ['studio', 'استوديو', 'ستوديو', 'studio apartment'],
  duplex:     ['duplex', 'دوبلكس', 'دوبليكس'],
  penthouse:  ['penthouse', 'بنتهاوس', 'بنت هاوس'],
  villa:      ['villa', 'فيلا', 'فيلة', 'فلة'],
  townhouse:  ['townhouse', 'town house', 'تاون هاوس', 'تاون', 'twin house', 'توين هاوس', 'توين'],
  chalet:     ['chalet', 'شاليه', 'شاليهات'],
  land:       ['land', 'plot', 'أرض', 'ارض', 'قطعة ارض', 'قطعه ارض'],
  office:     ['office', 'مكتب', 'مكاتب'],
  clinic:     ['clinic', 'عيادة', 'عياده'],
  shop:       ['shop', 'store', 'محل', 'محلات', 'دكان'],
  warehouse:  ['warehouse', 'مخزن', 'مستودع'],
  hotel_unit: ['hotel unit', 'hotel apartment', 'وحدة فندقية', 'وحده فندقيه', 'شقة فندقية'],
};

/**
 * Strict compatibility matrix.
 * Key = canonical supply type, value = set of canonical demand types it CAN match.
 * Types NOT listed are incompatible (score = 0).
 *
 * Rules derived from historical mismatch analysis:
 *  - villa/land/office/shop should NEVER match apartment demand
 *  - studio should NOT match apartment unless demand explicitly allows it
 *  - duplex/penthouse CAN match apartment demand (near-types)
 */
export const PROPERTY_COMPATIBILITY: Record<string, Set<string>> = {
  apartment:  new Set(['apartment', 'duplex', 'penthouse', 'studio']),  // apartment can satisfy studio demand too
  studio:     new Set(['studio']),                                        // strict: studio ≠ apartment by default
  duplex:     new Set(['duplex', 'apartment', 'penthouse']),
  penthouse:  new Set(['penthouse', 'apartment', 'duplex']),
  villa:      new Set(['villa', 'townhouse']),
  townhouse:  new Set(['townhouse', 'villa']),
  chalet:     new Set(['chalet']),
  land:       new Set(['land']),
  office:     new Set(['office']),
  clinic:     new Set(['clinic', 'office']),                             // clinic can fill office demand
  shop:       new Set(['shop']),
  warehouse:  new Set(['warehouse']),
  hotel_unit: new Set(['hotel_unit', 'apartment']),
};

/**
 * Partial compatibility scores (when supply type is in demand's compatible set
 * but they are not identical).
 */
export const PARTIAL_TYPE_SCORES: Record<string, Record<string, number>> = {
  duplex:     { apartment: 70, penthouse: 60 },
  penthouse:  { apartment: 65, duplex: 60 },
  villa:      { townhouse: 70 },
  townhouse:  { villa: 70 },
  clinic:     { office: 60 },
  hotel_unit: { apartment: 55 },
  apartment:  { duplex: 70, penthouse: 65, studio: 50 },
};

// ─── Intent / Purpose Keywords ────────────────────────────────────────────────

export const RENT_KEYWORDS = [
  'rent', 'rental', 'للإيجار', 'للايجار', 'إيجار', 'ايجار', 'اجار', 'للأجار',
  'for rent', 'to rent', 'lease', 'monthly', 'شهري', 'سنوي', 'annual',
];

export const SALE_KEYWORDS = [
  'sale', 'sell', 'for sale', 'للبيع', 'بيع', 'تمليك', 'ownership', 'buy', 'purchase',
  'شراء', 'يشتري', 'مطلوب شراء',
];

// ─── Amenity Keywords ─────────────────────────────────────────────────────────

export const AMENITY_KEYWORDS: Record<string, string[]> = {
  furnished:   ['furnished', 'مفروش', 'مفروشة', 'fully furnished', 'مفروشه'],
  unfurnished: ['unfurnished', 'غير مفروش', 'غير مفروشة', 'empty', 'فاضي', 'فارغ'],
  pool:        ['pool', 'swimming pool', 'حمام سباحة', 'حمام سباحه', 'بيسين'],
  garden:      ['garden', 'حديقة', 'حديقه', 'yard'],
  parking:     ['parking', 'garage', 'جراج', 'موقف', 'كراج'],
  sea_view:    ['sea view', 'ocean view', 'بحر', 'اطلالة بحر', 'view'],
  compound:    ['compound', 'كمباوند', 'مجمع سكني'],
  security:    ['security', 'guard', 'حارس', 'امن', 'أمن'],
  elevator:    ['elevator', 'lift', 'اسانسير', 'مصعد'],
};

// ─── Normalization Utilities ──────────────────────────────────────────────────

/**
 * Strip emoji, extra whitespace, and common noise characters.
 */
export function stripNoise(text: string): string {
  return text
    // Remove emoji (broad unicode range)
    .replace(/[\uD800-\uDFFF]/g, ' ')  // surrogate pairs (emoji)
    .replace(/[\u2600-\u27FF\uFE00-\uFEFF]/g, ' ')  // misc symbols
    // Remove common punctuation noise
    .replace(/[*•·|،,،؛;:!?#@$%^&*()\[\]{}<>\/\\'"~`]/g, ' ')
    // Normalize Arabic diacritics (tashkeel)
    .replace(/[\u064B-\u065F]/g, '')
    // Normalize Arabic alef variants to bare alef
    .replace(/[أإآا]/g, 'ا')
    // Normalize Arabic taa marbuta
    .replace(/ة/g, 'ه')
    // Normalize Arabic ya variants
    .replace(/ى/g, 'ي')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Normalize a property type string to its canonical form.
 * Returns null if no match found.
 */
export function normalizePropertyType(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = stripNoise(raw);

  for (const [canonical, variants] of Object.entries(PROPERTY_TYPE_ONTOLOGY)) {
    for (const variant of variants) {
      const cleanedVariant = stripNoise(variant);
      if (cleaned === cleanedVariant || cleaned.includes(cleanedVariant) || cleanedVariant.includes(cleaned)) {
        return canonical;
      }
    }
  }
  return cleaned || null;
}

/**
 * Check if a supply property type is compatible with a demand property type.
 * Returns a score 0–100:
 *   100 = exact canonical match
 *   50–80 = partial/near-type match
 *   0 = incompatible
 */
export function getPropertyTypeScore(
  supplyType: string | null | undefined,
  demandType: string | null | undefined,
): number {
  const supply = normalizePropertyType(supplyType);
  const demand = normalizePropertyType(demandType);

  // If either is unknown, return neutral (don't penalize missing data)
  if (!supply || !demand) return 50;

  // Exact canonical match
  if (supply === demand) return 100;

  // Check compatibility matrix
  const compatibleDemandTypes = PROPERTY_COMPATIBILITY[supply];
  if (!compatibleDemandTypes || !compatibleDemandTypes.has(demand)) {
    return 0; // Strictly incompatible
  }

  // Partial score for near-types
  const partialScore = PARTIAL_TYPE_SCORES[supply]?.[demand];
  return partialScore ?? 60;
}

/**
 * Normalize a purpose/intent string to 'rent' | 'sale' | null.
 */
export function normalizePurpose(raw: string | null | undefined): 'rent' | 'sale' | null {
  if (!raw) return null;
  const cleaned = stripNoise(raw);

  if (RENT_KEYWORDS.some(k => cleaned.includes(stripNoise(k)))) return 'rent';
  if (SALE_KEYWORDS.some(k => cleaned.includes(stripNoise(k)))) return 'sale';
  return null;
}

/**
 * Extract amenities present in a text string.
 * Returns a Set of canonical amenity keys.
 */
export function extractAmenities(text: string | null | undefined): Set<string> {
  if (!text) return new Set();
  const cleaned = stripNoise(text);
  const found = new Set<string>();

  for (const [key, keywords] of Object.entries(AMENITY_KEYWORDS)) {
    if (keywords.some(k => cleaned.includes(stripNoise(k)))) {
      found.add(key);
    }
  }
  return found;
}

/**
 * Calculate amenity overlap score (0–100).
 * Only penalizes hard conflicts (furnished vs unfurnished).
 * Rewards overlap.
 */
export function getAmenityScore(
  supplyText: string | null | undefined,
  demandText: string | null | undefined,
): number {
  const supplyAmenities = extractAmenities(supplyText);
  const demandAmenities = extractAmenities(demandText);

  if (demandAmenities.size === 0) return 75; // No demand requirements = neutral

  // Hard conflict: furnished vs unfurnished
  if (supplyAmenities.has('furnished') && demandAmenities.has('unfurnished')) return 10;
  if (supplyAmenities.has('unfurnished') && demandAmenities.has('furnished')) return 10;

  // Count matched amenities
  let matched = 0;
  Array.from(demandAmenities).forEach(amenity => {
    if (supplyAmenities.has(amenity)) matched++;
  });

  const overlapRatio = matched / demandAmenities.size;
  return Math.round(50 + overlapRatio * 50); // 50–100
}

/**
 * Build a human-readable match explanation string.
 * Example: "Matched on: Zamalek + 2BR + rent budget overlap"
 */
export function buildMatchExplanation(params: {
  supplyLocation?: string | null;
  demandLocation?: string | null;
  supplyType?: string | null;
  demandType?: string | null;
  supplyBedrooms?: number | null;
  demandBedrooms?: number | null;
  supplyPrice?: number | null;
  demandPriceMax?: number | null;
  purpose?: string | null;
  locationScore: number;
  priceScore: number;
  typeScore: number;
  specsScore: number;
}): string {
  const parts: string[] = [];

  // Location
  if (params.locationScore >= 85 && params.supplyLocation) {
    parts.push(params.supplyLocation);
  } else if (params.locationScore >= 70) {
    parts.push('nearby location');
  }

  // Property type
  const supplyType = normalizePropertyType(params.supplyType);
  const demandType = normalizePropertyType(params.demandType);
  if (supplyType && supplyType === demandType) {
    parts.push(supplyType);
  }

  // Bedrooms
  if (params.supplyBedrooms && params.demandBedrooms &&
      Math.abs(params.supplyBedrooms - params.demandBedrooms) <= 1) {
    parts.push(`${params.supplyBedrooms}BR`);
  }

  // Price/budget
  if (params.priceScore >= 80) {
    const purpose = params.purpose ?? normalizePurpose(params.supplyType);
    parts.push(purpose === 'rent' ? 'rent budget overlap' : 'price match');
  } else if (params.priceScore >= 60) {
    parts.push('near budget');
  }

  if (parts.length === 0) return 'General compatibility match';
  return `Matched on: ${parts.join(' + ')}`;
}
