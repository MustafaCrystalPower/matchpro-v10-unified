import { Supply, Demand, InsertMatch } from "../drizzle/schema";
import { 
  getUnmatchedSupply, 
  getUnmatchedDemand, 
  insertMatch, 
  markSupplyMatched, 
  markDemandMatched,
  insertNotification,
  getSupplyById,
  getDemandById,
  normalizePriceToTotal,
  markMatchNotified,
} from "./db";
import { notifyOwner } from "./_core/notification";
import { sendPushToAll, isVapidReady } from "./webPushService";
import { generateMatchSummary, generateMatchExplanation, formatPrice } from "./matchSummaryGenerator";
import {
  getPropertyTypeScore,
  normalizePurpose,
  getAmenityScore,
  buildMatchExplanation,
} from "./keywordNormalizer";

// No unused import needed - matchBroadcast is initialized from server core

let matchBroadcastFn: ((event: string, data: unknown) => void) | null = null;

export function initMatchBroadcast(fn: (event: string, data: unknown) => void) {
  matchBroadcastFn = fn;
}

function broadcastMatch(event: string, data: unknown) {
  if (matchBroadcastFn) {
    matchBroadcastFn(event, data);
  }
}

// ─── Configurable Matching Weights ──────────────────────────────────────────
// Weights must sum to 1.0. Adjust to tune algorithm precision.
export const MATCH_WEIGHTS = {
  PROPERTY_TYPE: 0.30,   // Highest — wrong type = wrong match
  LOCATION:      0.30,   // High — location is primary filter
  PRICE:         0.25,   // High — budget must overlap
  SPECS:         0.10,   // Medium — bedrooms, size
  AMENITIES:     0.05,   // Low — furnished, pool, etc.
};
// Legacy aliases (kept for backward compat)
const LOCATION_WEIGHT = MATCH_WEIGHTS.LOCATION;
const PRICE_WEIGHT = MATCH_WEIGHTS.PRICE;
const SPECS_WEIGHT = MATCH_WEIGHTS.SPECS;

// Thresholds
const MIN_MATCH_SCORE = 75;           // Only store matches ≥75% — quality over quantity
const HIGH_CONFIDENCE_THRESHOLD = 85; // Notify owner for ≥85%
const PRICE_TOLERANCE = 0.20;         // ±20% price tolerance (kept for reference)

// Location normalization: canonical name → all known aliases
const LOCATION_ALIASES: Record<string, string[]> = {
  'مدينتي': ['مدينتي', 'madinaty', 'مدينة تي', 'b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8', 'b9', 'b10', 'b11', 'b12', 'b13', 'b14', 'b15', 'b16', 'b17', 'b18', 'b19', 'b20'],
  'مدينة نور': ['مدينة نور', 'نور', 'madinat nour', 'city of light'],
  'الرحاب': ['الرحاب', 'rehab', 'الرحاب سيتي', 'rehab city'],
  'القاهرة الجديدة': ['القاهرة الجديدة', 'new cairo', 'التجمع الخامس', 'التجمع الاول', 'التجمع', '5th settlement', 'tagamoa'],
  'مفيدا': ['مفيدا', 'mivida', 'ميفيدا'],
  'أليجريا': ['أليجريا', 'اليجريا', 'allegria', 'alegria'],
  'ليك فيو': ['ليك فيو', 'lake view', 'ليك فيو ريزيدنس'],
  'هايد بارك': ['هايد بارك', 'hyde park', 'هايد بارك القاهرة'],
  'فيفث سكوير': ['فيفث سكوير', 'fifth square', 'فيفث سكوير المستقبل'],
  'بريفادو': ['بريفادو', 'privado', 'بريفادو القاهرة'],
  'الشيخ زايد': ['الشيخ زايد', 'sheikh zayed', 'زايد', 'zayed'],
  '6 اكتوبر': ['6 اكتوبر', 'october', '6th october', 'السادس من اكتوبر'],
  'الدقي': ['الدقي', 'dokki', 'دوكي'],
  'المعادي': ['المعادي', 'maadi', 'دجلة', 'degla', 'كورنيش المعادي'],
  'الزمالك': ['الزمالك', 'zamalek'],
  'مدينة نصر': ['مدينة نصر', 'nasr city', 'نصر سيتي'],
  'هليوبوليس': ['هليوبوليس', 'heliopolis', 'مصر الجديدة'],
  'العاصمة الادارية': ['العاصمة الادارية', 'new capital', 'administrative capital', 'العاصمة'],
  'الساحل الشمالي': ['الساحل الشمالي', 'north coast', 'sahel', 'الساحل'],
  'العين السخنة': ['العين السخنة', 'ain sokhna', 'sokhna'],
  'الدور': ['الدور', 'الدور*', 'aldawr'],
  'العاشر من رمضان': ['العاشر من رمضان', '10th ramadan', 'العاشر'],
};

// Normalize a location string to its canonical form
function normalizeLocation(location: string | null): string | null {
  if (!location) return null;
  const loc = location.trim().toLowerCase();
  for (const [canonical, aliases] of Object.entries(LOCATION_ALIASES)) {
    if (aliases.some(a => a.toLowerCase() === loc || loc.includes(a.toLowerCase()) || a.toLowerCase().includes(loc))) {
      return canonical;
    }
  }
  return location.trim();
}

// Location similarity mappings (areas that are close to each other)
const LOCATION_CLUSTERS: Record<string, string[]> = {
  'new_cairo': ['مدينتي', 'مفيدا', 'الرحاب', 'القاهرة الجديدة', 'أليجريا', 'ليك فيو', 'هايد بارك', 'فيفث سكوير', 'بريفادو', 'مدينة نور'],
  'october': ['6 اكتوبر', 'الشيخ زايد'],
  'heliopolis': ['هليوبوليس', 'مدينة نصر'],
  'maadi': ['المعادي'],
  'downtown': ['الزمالك', 'الدقي'],
  'coast': ['الساحل الشمالي', 'العين السخنة'],
  'new_capital': ['العاصمة الادارية']
};

// Property type equivalents
const PROPERTY_TYPE_GROUPS: Record<string, string[]> = {
  'apartment': ['apartment', 'flat', 'شقة', 'شقه'],
  'villa': ['villa', 'فيلا'],
  'duplex': ['duplex', 'دوبلكس'],
  'studio': ['studio', 'استوديو'],
  'penthouse': ['penthouse', 'بنتهاوس'],
  'land': ['land', 'أرض', 'ارض'],
  'shop': ['shop', 'store', 'محل'],
  'office': ['office', 'مكتب'],
  'chalet': ['chalet', 'شاليه'],
  'townhouse': ['townhouse', 'تاون هاوس', 'twin house', 'توين هاوس']
};

export interface MatchResult {
  supplyId: number;
  demandId: number;
  matchScore: number;
  locationScore: number;
  priceScore: number;
  specsScore: number;
  typeScore: number;
  amenityScore: number;
  explanation: string;
}

/**
 * Get location cluster for a given location
 */
function getLocationCluster(location: string | null): string | null {
  if (!location) return null;
  const locationLower = location.toLowerCase();
  
  for (const [cluster, locations] of Object.entries(LOCATION_CLUSTERS)) {
    if (locations.some(loc => locationLower.includes(loc.toLowerCase()) || loc.toLowerCase().includes(locationLower))) {
      return cluster;
    }
  }
  return locationLower;
}

/**
 * Calculate location match score (0-100)
 */
function calculateLocationScore(supplyLocation: string | null, demandLocation: string | null): number {
  if (!supplyLocation || !demandLocation) return 50; // Neutral if unknown
  
  // Normalize both locations to canonical form first
  const supplyNorm = normalizeLocation(supplyLocation);
  const demandNorm = normalizeLocation(demandLocation);
  
  // Exact match (after normalization)
  if (supplyNorm && demandNorm && supplyNorm.toLowerCase() === demandNorm.toLowerCase()) return 100;
  
  // Same cluster (nearby areas) — use normalized names
  const supplyCluster = getLocationCluster(supplyNorm || supplyLocation);
  const demandCluster = getLocationCluster(demandNorm || demandLocation);
  if (supplyCluster && demandCluster && supplyCluster === demandCluster) return 85;
  
  // Partial match on normalized names
  const s = (supplyNorm || supplyLocation).toLowerCase();
  const d = (demandNorm || demandLocation).toLowerCase();
  if (s.includes(d) || d.includes(s)) return 75;
  
  return 20; // Different locations — hard penalty
}

/**
 * Calculate price match score (0-100) with strict accuracy.
 * 
 * Rules:
 * - Supply price within 10% of demand max budget = 100 (perfect)
 * - Supply price within 20% of demand max budget = 90 (excellent)
 * - Supply price within 30% of demand max budget = 80 (good)
 * - Supply price within 50% of demand max budget = 70 (acceptable)
 * - Supply price < 50% of demand max budget = penalized (scale mismatch)
 * - Supply price > budget = penalized proportionally
 * - Unknown price on either side = 50 (neutral, not 100)
 */
function calculatePriceScore(
  supplyPrice: number | null,
  demandPriceMin: number | null,
  demandPriceMax: number | null
): number {
  // Unknown price = neutral 50, never 100
  if (!supplyPrice) return 50;
  if (!demandPriceMin && !demandPriceMax) return 50;
  
  const price = Number(supplyPrice);
  const minPrice = demandPriceMin ? Number(demandPriceMin) : 0;
  const maxPrice = demandPriceMax ? Number(demandPriceMax) : price * 1.5; // If no max, assume 50% above supply
  
  // Hard fail: supply is more than 2x the max budget (completely out of range)
  if (maxPrice > 0 && price > maxPrice * 2) return 0;
  
  // Hard fail: supply is less than 15% of max budget (completely wrong scale)
  if (maxPrice > 0 && price < maxPrice * 0.15) return 10;
  
  // Supply within budget range
  if (price >= minPrice && price <= maxPrice) {
    const ratio = maxPrice > 0 ? price / maxPrice : 1;
    // Perfect: supply is 70-100% of max budget (sweet spot)
    if (ratio >= 0.70) return 100;
    // Excellent: supply is 50-70% of max budget
    if (ratio >= 0.50) return 88;
    // Good: supply is 35-50% of max budget
    if (ratio >= 0.35) return 72;
    // Acceptable: supply is 20-35% of max budget
    if (ratio >= 0.20) return 55;
    // Poor: supply is 15-20% of max budget
    return 35;
  }
  
  // Supply over budget
  if (price > maxPrice) {
    const overPercent = (price - maxPrice) / maxPrice;
    if (overPercent <= 0.05) return 95; // Within 5% over = still excellent
    if (overPercent <= 0.10) return 88; // Within 10% over = very good
    if (overPercent <= 0.20) return 75; // Within 20% over = good (negotiable)
    if (overPercent <= 0.35) return 55; // Within 35% over = marginal
    if (overPercent <= 0.50) return 35; // Within 50% over = unlikely
    return 15; // More than 50% over budget = poor
  }
  
  // Supply under minimum budget
  if (minPrice > 0 && price < minPrice) {
    const underPercent = (minPrice - price) / minPrice;
    if (underPercent <= 0.10) return 90; // Just under minimum = great deal
    if (underPercent <= 0.25) return 70; // Somewhat under = good deal
    if (underPercent <= 0.50) return 45; // Significantly under = scale mismatch
    return 20; // Way under minimum = wrong category
  }
  
  return 25;
}

/**
 * Normalize property type
 */
function normalizePropertyType(type: string | null): string | null {
  if (!type) return null;
  const typeLower = type.toLowerCase();
  
  for (const [normalized, variants] of Object.entries(PROPERTY_TYPE_GROUPS)) {
    if (variants.some(v => typeLower.includes(v.toLowerCase()))) {
      return normalized;
    }
  }
  return typeLower;
}

/**
 * Calculate specs match score (0-100)
 */
function calculateSpecsScore(supply: Supply, demand: Demand): number {
  let score = 0;
  let factors = 0;
  
  // Property type match (40% of specs score)
  const supplyType = normalizePropertyType(supply.propertyType);
  const demandType = normalizePropertyType(demand.propertyType);
  
  if (supplyType && demandType) {
    factors += 40;
    if (supplyType === demandType) {
      score += 40;
    } else if (
      (supplyType === 'apartment' && demandType === 'duplex') ||
      (supplyType === 'duplex' && demandType === 'apartment')
    ) {
      score += 25; // Similar types
    }
  }
  
  // Bedrooms match (30% of specs score)
  // If both have bedroom data: score based on match quality
  // If only one side has bedroom data: partial penalty (unknown = 50% credit)
  // If neither has bedroom data: no bedroom factor (don't inflate score)
  if (supply.bedrooms !== null && supply.bedrooms !== undefined && 
      demand.bedrooms !== null && demand.bedrooms !== undefined) {
    factors += 30;
    const diff = Math.abs(Number(supply.bedrooms) - Number(demand.bedrooms));
    if (diff === 0) score += 30;      // Exact match
    else if (diff === 1) score += 20; // 1 bedroom off
    else if (diff === 2) score += 10; // 2 bedrooms off
    else score += 0;                  // 3+ bedrooms off = no credit
  } else if (supply.bedrooms !== null && supply.bedrooms !== undefined) {
    // Supply has bedrooms but demand doesn't specify — partial credit
    factors += 15;
    score += 10; // Slight penalty for unknown demand preference
  } else if (demand.bedrooms !== null && demand.bedrooms !== undefined) {
    // Demand specifies bedrooms but supply doesn't have data — penalty
    factors += 15;
    score += 5; // Bigger penalty — we can't confirm the requirement
  }
  // Both null = no bedroom factor added (avoids inflating score with fake data)
  
  // Size match (30% of specs score)
  const supplySize = supply.size;
  const demandSizeMin = demand.sizeMin;
  const demandSizeMax = demand.sizeMax;
  
  if (supplySize && (demandSizeMin || demandSizeMax)) {
    factors += 30;
    const size = Number(supplySize);
    const minSize = demandSizeMin ? Number(demandSizeMin) : 0;
    const maxSize = demandSizeMax ? Number(demandSizeMax) : Infinity;
    
    if (size >= minSize && size <= maxSize) {
      score += 30;
    } else {
      const deviation = size < minSize 
        ? (minSize - size) / minSize 
        : (size - maxSize) / maxSize;
      score += Math.max(0, 30 - Math.round(deviation * 60));
    }
  }
  
  // Purpose match (must match if both specified)
  if (supply.purpose && demand.purpose && supply.purpose !== demand.purpose) {
    return 0; // Incompatible - one wants to buy, other wants to rent
  }
  
  return factors > 0 ? Math.min(100, Math.round((score / factors) * 100)) : 50;
}

/**
 * Calculate overall match score using the new weighted model.
 * Property type incompatibility is a hard gate (returns score 0).
 */
function calculateMatchScore(supply: Supply, demand: Demand): MatchResult {
  // 1. Property type score (hard gate — incompatible types = skip)
  const typeScore = getPropertyTypeScore(supply.propertyType, demand.propertyType);
  if (typeScore === 0) {
    return {
      supplyId: supply.id, demandId: demand.id, matchScore: 0,
      locationScore: 0, priceScore: 0, specsScore: 0,
      typeScore: 0, amenityScore: 0,
      explanation: 'Incompatible property types',
    };
  }

  // 2. Purpose/intent hard gate
  const supplyPurpose = normalizePurpose(supply.purpose);
  const demandPurpose = normalizePurpose(demand.purpose);
  if (supplyPurpose && demandPurpose && supplyPurpose !== demandPurpose) {
    return {
      supplyId: supply.id, demandId: demand.id, matchScore: 0,
      locationScore: 0, priceScore: 0, specsScore: 0,
      typeScore: 0, amenityScore: 0,
      explanation: 'Incompatible intent (rent vs sale)',
    };
  }

  // 3. Sub-scores
  const locationScore = calculateLocationScore(supply.location, demand.location);
  // P1: Normalize prices to total EGP before comparison to block cross-unit mismatches
  const supplyPriceRaw = supply.price ? parseFloat(String(supply.price)) : null;
  const supplyPrice = normalizePriceToTotal(
    supplyPriceRaw,
    (supply as Record<string, unknown>).priceUnit as string | null,
    supply.size ? parseFloat(String(supply.size)) : null
  );
  const demandPriceMin = demand.priceMin ? parseFloat(String(demand.priceMin)) : null;
  const demandPriceMax = demand.priceMax ? parseFloat(String(demand.priceMax)) : null;
  const priceScore = calculatePriceScore(supplyPrice, demandPriceMin, demandPriceMax);
  const specsScore = calculateSpecsScore(supply, demand);
  const amenityScore = getAmenityScore(
    (supply as Record<string, unknown>).rawMessage as string | null,
    (demand as Record<string, unknown>).rawMessage as string | null
  );

  const cappedType     = Math.min(100, Math.max(0, typeScore));
  const cappedLocation = Math.min(100, Math.max(0, locationScore));
  const cappedPrice    = Math.min(100, Math.max(0, priceScore));
  const cappedSpecs    = Math.min(100, Math.max(0, specsScore));
  const cappedAmenity  = Math.min(100, Math.max(0, amenityScore));

  // 4. Weighted composite score
  const matchScore = Math.min(100, Math.round(
    cappedType     * MATCH_WEIGHTS.PROPERTY_TYPE +
    cappedLocation * MATCH_WEIGHTS.LOCATION +
    cappedPrice    * MATCH_WEIGHTS.PRICE +
    cappedSpecs    * MATCH_WEIGHTS.SPECS +
    cappedAmenity  * MATCH_WEIGHTS.AMENITIES
  ));

  // 5. Human-readable explanation
  const explanation = buildMatchExplanation({
    supplyLocation: supply.location,
    demandLocation: demand.location,
    supplyType: supply.propertyType,
    demandType: demand.propertyType,
    supplyBedrooms: supply.bedrooms,
    demandBedrooms: demand.bedrooms,
    supplyPrice,
    demandPriceMax,
    purpose: supplyPurpose,
    locationScore: cappedLocation,
    priceScore: cappedPrice,
    typeScore: cappedType,
    specsScore: cappedSpecs,
  });

  return {
    supplyId: supply.id, demandId: demand.id, matchScore,
    locationScore: cappedLocation, priceScore: cappedPrice,
    specsScore: cappedSpecs, typeScore: cappedType,
    amenityScore: cappedAmenity, explanation,
  };
}

/**
 * Find matches for a new supply listing
 */
export async function findMatchesForSupply(supplyId: number): Promise<MatchResult[]> {
  const supply = await getSupplyById(supplyId);
  if (!supply) return [];
  
  const unmatchedDemands = await getUnmatchedDemand();
  const matches: MatchResult[] = [];
  
  for (const demand of unmatchedDemands) {
    const result = calculateMatchScore(supply, demand);
    
    if (result.matchScore >= MIN_MATCH_SCORE) {
      matches.push(result);
      
      // Generate match summary and explanation
      const matchSummary = generateMatchSummary(supply, demand, result.matchScore);
      const matchExplanation = generateMatchExplanation(
        supply, demand, result.matchScore,
        result.locationScore, result.priceScore, result.specsScore
      );
      
      // Save match to database
      const matchId = await insertMatch({
        supplyId: result.supplyId,
        demandId: result.demandId,
        matchScore: result.matchScore.toString(),
        locationScore: result.locationScore.toString(),
        priceScore: result.priceScore.toString(),
        specsScore: result.specsScore.toString(),
        matchSummary,
        matchExplanation,
        supplyContactPhone: supply.contact || 'Unknown',
        supplyContactName: supply.contactName || 'Unknown',
        demandContactPhone: demand.contact || 'Unknown',
        demandContactName: demand.contactName || 'Unknown',
        transactionType: (supply.purpose as 'sale' | 'rent' | null) ?? null,
        status: 'new',
        notified: 0
      });
      
      // Send notification for high-confidence matches
      if (result.matchScore >= HIGH_CONFIDENCE_THRESHOLD && matchId) {
        await sendHighMatchNotification(matchId, result, supply, demand);
      }
    }
  }
  
  // Mark supply as matched if any matches found
  if (matches.length > 0) {
    await markSupplyMatched(supplyId);
  }
  
  return matches.sort((a, b) => b.matchScore - a.matchScore);
}

/**
 * Find matches for a new demand request
 */
export async function findMatchesForDemand(demandId: number): Promise<MatchResult[]> {
  const demand = await getDemandById(demandId);
  if (!demand) return [];
  
  const unmatchedSupplies = await getUnmatchedSupply();
  const matches: MatchResult[] = [];
  
  for (const supply of unmatchedSupplies) {
    // Skip supply with no identified seller
    if (!supply.contactName || supply.contactName === 'Unknown' || supply.contactName.trim() === '') {
      continue;
    }
    const result = calculateMatchScore(supply, demand);
    
    if (result.matchScore >= MIN_MATCH_SCORE) {
      matches.push(result);
      
      // Generate match summary and explanation
      const matchSummary = generateMatchSummary(supply, demand, result.matchScore);
      const matchExplanation = generateMatchExplanation(
        supply, demand, result.matchScore,
        result.locationScore, result.priceScore, result.specsScore
      );
      
      // Save match to database
      const matchId = await insertMatch({
        supplyId: result.supplyId,
        demandId: result.demandId,
        matchScore: result.matchScore.toString(),
        locationScore: result.locationScore.toString(),
        priceScore: result.priceScore.toString(),
        specsScore: result.specsScore.toString(),
        matchSummary,
        matchExplanation,
        supplyContactPhone: supply.contact || 'Unknown',
        supplyContactName: supply.contactName || 'Unknown',
        demandContactPhone: demand.contact || 'Unknown',
        demandContactName: demand.contactName || 'Unknown',
        transactionType: (supply.purpose as 'sale' | 'rent' | null) ?? null,
        status: 'new',
        notified: 0
      });
      
      // Send notification for high-confidence matches
      if (result.matchScore >= HIGH_CONFIDENCE_THRESHOLD && matchId) {
        await sendHighMatchNotification(matchId, result, supply, demand);
      }
    }
  }
  
  // Mark demand as matched if any matches found
  if (matches.length > 0) {
    await markDemandMatched(demandId);
  }
  
  return matches.sort((a, b) => b.matchScore - a.matchScore);
}

/**
 * Send notification for high-confidence match
 */
async function sendHighMatchNotification(
  matchId: number,
  result: MatchResult,
  supply: Supply,
  demand: Demand
): Promise<void> {
  const title = `🎯 High-Confidence Match: ${result.matchScore}%`;
  const content = `
Property Match Found!
━━━━━━━━━━━━━━━━━━━━
📍 Location: ${supply.location || 'N/A'}
🏠 Type: ${supply.propertyType || 'N/A'}
💰 Price: ${supply.price ? formatPrice(parseFloat(String(supply.price))) : 'N/A'}
📐 Size: ${supply.size ? `${supply.size} m²` : 'N/A'}
🛏️ Bedrooms: ${supply.bedrooms || 'N/A'}

Match Scores:
• Location: ${result.locationScore}%
• Price: ${result.priceScore}%
• Specs: ${result.specsScore}%

Supply Contact: ${supply.contact || 'N/A'}
Demand Contact: ${demand.contact || 'N/A'}
`.trim();

  // Save notification to database
  await insertNotification({
    type: 'high_match',
    title,
    content,
    matchId,
    isRead: 0
  });

  // Broadcast high-confidence match to all connected clients via Socket.IO
  broadcastMatch("high_confidence_match", {
    matchId,
    matchScore: result.matchScore,
    locationScore: result.locationScore,
    priceScore: result.priceScore,
    specsScore: result.specsScore,
    supply: {
      id: supply.id,
      propertyType: supply.propertyType,
      location: supply.location,
      area: supply.area,
      city: supply.city,
      price: supply.price ? parseFloat(String(supply.price)) : null,
      size: supply.size,
      bedrooms: supply.bedrooms,
      purpose: supply.purpose,
      contactName: supply.contactName || 'Unknown',
      contactPhone: supply.contact || 'Unknown'
    },
    demand: {
      id: demand.id,
      propertyType: demand.propertyType,
      location: demand.location,
      area: demand.area,
      city: demand.city,
      priceMax: demand.priceMax ? parseFloat(String(demand.priceMax)) : null,
      bedrooms: demand.bedrooms,
      purpose: demand.purpose,
      contactName: demand.contactName || 'Unknown',
      contactPhone: demand.contact || 'Unknown'
    },
    timestamp: new Date().toISOString()
  });

  // Also broadcast as a notification event
  broadcastMatch("notification", {
    type: "high_confidence_match",
    title,
    message: `${result.matchScore}% match: ${supply.propertyType || 'Property'} in ${supply.location || 'N/A'} - Seller: ${supply.contactName || 'N/A'} / Buyer: ${demand.contactName || 'N/A'}`,
    matchId,
    score: result.matchScore
  });

  // Notify owner via Manus internal notification only (no WhatsApp outbound)
  try {
    await notifyOwner({
      title,
      content
    });
  } catch (error) {
    console.error("[Matching] Failed to notify owner:", error);
  }

  // Send Web Push notification to all subscribed devices
  if (isVapidReady()) {
    try {
      await sendPushToAll({
        title: `🎯 Match ${result.matchScore}% — MatchPro™`,
        body: `${supply.propertyType || 'Property'} in ${supply.location || 'N/A'} matched with buyer request`,
        icon: '/icon-192x192.png',
        badge: '/icon-72x72.png',
        data: {
          url: '/matches',
          matchId,
          matchScore: result.matchScore,
          location: supply.location,
          propertyType: supply.propertyType,
        },
        tag: `match-${matchId}`,
      });
      console.log(`[Matching] Web Push sent for match #${matchId} (${result.matchScore}%)`);
    } catch (pushError) {
      console.error("[Matching] Web Push failed:", pushError);
    }
  }

  console.log(`[Matching] High-confidence match #${matchId} (${result.matchScore}%) recorded to dashboard.`);
}

// formatPrice is now imported from matchSummaryGenerator

/**
 * Validate that a contact name is a real human name (not a phone number, placeholder, or junk)
 * Returns true if the name is valid enough to participate in matching
 */
function isValidContactName(name: string | null | undefined): boolean {
  if (!name || name.trim() === '') return false;
  const n = name.trim();
  // Reject known placeholder values
  const INVALID_NAMES = ['unknown', 'للتواصل', 'للبيع', 'للإيجار', 'مالك', 'وكيل', 'broker', 'agent', 'owner', 'seller', 'buyer', 'n/a', 'na'];
  if (INVALID_NAMES.includes(n.toLowerCase())) return false;
  // Reject pure phone numbers (10+ digits)
  if (/^[0-9+\s\-]{10,}$/.test(n)) return false;
  // Reject very short names (1-2 chars) that are not meaningful
  if (n.length <= 2) return false;
  // Must have at least one letter (Arabic or Latin)
  if (!/[\u0600-\u06FFa-zA-Z]/.test(n)) return false;
  return true;
}

/**
 * Run full matching cycle for all unmatched items
 */
export async function runFullMatchingCycle(): Promise<{
  newMatches: number;
  highConfidenceMatches: number;
  skippedSupply: number;
  skippedDemand: number;
}> {
  const unmatchedSupplies = await getUnmatchedSupply();
  const unmatchedDemands = await getUnmatchedDemand();
  
  let newMatches = 0;
  let highConfidenceMatches = 0;
  let skippedSupply = 0;
  let skippedDemand = 0;
  
  // Pre-filter demand to only valid contacts
  const validDemands = unmatchedDemands.filter(d => {
    if (!isValidContactName(d.contactName)) { skippedDemand++; return false; }
    return true;
  });

  for (const supply of unmatchedSupplies) {
    // Skip supply entries with no identified seller — prevents Unknown-seller false matches
    if (!isValidContactName(supply.contactName)) {
      skippedSupply++;
      continue;
    }
    for (const demand of validDemands) {
      const result = calculateMatchScore(supply, demand);
      
      if (result.matchScore >= MIN_MATCH_SCORE) {
        // Generate match summary and explanation
        const matchSummary = generateMatchSummary(supply, demand, result.matchScore);
        const matchExplanation = generateMatchExplanation(
          supply, demand, result.matchScore,
          result.locationScore, result.priceScore, result.specsScore
        );
        
        const matchId = await insertMatch({
          supplyId: result.supplyId,
          demandId: result.demandId,
          matchScore: result.matchScore.toString(),
          locationScore: result.locationScore.toString(),
          priceScore: result.priceScore.toString(),
          specsScore: result.specsScore.toString(),
          matchSummary,
          matchExplanation,
          supplyContactPhone: supply.contact || "Unknown",
          supplyContactName: supply.contactName || "Unknown",
          demandContactPhone: demand.contact || "Unknown",
          demandContactName: demand.contactName || "Unknown",
          transactionType: (supply.purpose as 'sale' | 'rent' | null) ?? null,
          status: 'new',
          notified: 0
        });
        
        newMatches++;
        
        if (result.matchScore >= HIGH_CONFIDENCE_THRESHOLD && matchId) {
          highConfidenceMatches++;
          await sendHighMatchNotification(matchId, result, supply, demand);
        }
      }
    }
  }
  
  console.log(`[Matching] Cycle complete: ${newMatches} new matches, ${highConfidenceMatches} high-confidence, ${skippedSupply} supply skipped (invalid name), ${skippedDemand} demand skipped (invalid name)`);
  return { newMatches, highConfidenceMatches, skippedSupply, skippedDemand };
}
