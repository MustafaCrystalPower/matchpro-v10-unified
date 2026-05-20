/**
 * Improved Matching Algorithm - Priority 3
 * New Weights: Area 40%, Price 30%, Type 20%, Bedrooms 10%
 * Minimum threshold: 70%, Hot match alerts: 90%+
 */

interface PropertyDetails {
  area: string;
  price: number;
  type: string; // 'apartment', 'villa', 'duplex', 'studio', 'land', 'townhouse'
  bedrooms: number;
  location?: string;
}

interface MatchScore {
  totalScore: number;
  areaScore: number;
  priceScore: number;
  typeScore: number;
  bedroomScore: number;
  isQualified: boolean; // >= 70%
  isHotMatch: boolean; // >= 90%
  breakdown: string;
}

/**
 * Calculate area match score (40% weight)
 */
function calculateAreaScore(supplyArea: string, demandArea: string): number {
  // Exact match
  if (supplyArea.toLowerCase() === demandArea.toLowerCase()) {
    return 100;
  }
  
  // Partial match (same region)
  const regionMap: { [key: string]: string[] } = {
    'east_cairo': ['القاهرة الجديدة', 'التجمع الخامس', 'مدينة نصر', 'الرحاب'],
    'west_cairo': ['الجيزة', 'الشيخ زايد', '6 اكتوبر'],
    'south_cairo': ['المعادي', 'الساحل'],
    'madinaty': ['مدينتي', 'b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8', 'b9', 'b10', 'b11', 'b12', 'b13', 'b14', 'b15', 'b16']
  };
  
  for (const [region, areas] of Object.entries(regionMap)) {
    const supplyInRegion = areas.some(a => a.toLowerCase().includes(supplyArea.toLowerCase()) || supplyArea.toLowerCase().includes(a.toLowerCase()));
    const demandInRegion = areas.some(a => a.toLowerCase().includes(demandArea.toLowerCase()) || demandArea.toLowerCase().includes(a.toLowerCase()));
    
    if (supplyInRegion && demandInRegion) {
      return 70; // Partial match in same region
    }
  }
  
  return 20; // Different regions
}

/**
 * Calculate price match score (30% weight)
 */
function calculatePriceScore(supplyPrice: number, demandPrice: number): number {
  if (supplyPrice === 0 || demandPrice === 0) {
    return 50; // Unknown price
  }
  
  const ratio = Math.min(supplyPrice, demandPrice) / Math.max(supplyPrice, demandPrice);
  
  // Exact match (within 5%)
  if (ratio >= 0.95) {
    return 100;
  }
  
  // Within 10%
  if (ratio >= 0.90) {
    return 95;
  }
  
  // Within 20%
  if (ratio >= 0.80) {
    return 85;
  }
  
  // Within 30%
  if (ratio >= 0.70) {
    return 70;
  }
  
  // Within 50%
  if (ratio >= 0.50) {
    return 50;
  }
  
  // Too far
  return 20;
}

/**
 * Calculate property type match score (20% weight)
 */
function calculateTypeScore(supplyType: string, demandType: string): number {
  // Exact match
  if (supplyType.toLowerCase() === demandType.toLowerCase()) {
    return 100;
  }
  
  // Similar types
  const similarTypes: { [key: string]: string[] } = {
    'apartment': ['apartment', 'شقة', 'flat', 'studio'],
    'villa': ['villa', 'فيلا', 'townhouse', 'تاون'],
    'land': ['land', 'أرض', 'plot'],
    'duplex': ['duplex', 'دوبلكس']
  };
  
  for (const [type, variants] of Object.entries(similarTypes)) {
    const supplyMatch = variants.some(v => v.toLowerCase() === supplyType.toLowerCase());
    const demandMatch = variants.some(v => v.toLowerCase() === demandType.toLowerCase());
    
    if (supplyMatch && demandMatch) {
      return 80; // Similar type
    }
  }
  
  return 40; // Different types
}

/**
 * Calculate bedroom match score (10% weight)
 */
function calculateBedroomScore(supplyBedrooms: number, demandBedrooms: number): number {
  if (supplyBedrooms === 0 || demandBedrooms === 0) {
    return 50; // Unknown bedrooms
  }
  
  const diff = Math.abs(supplyBedrooms - demandBedrooms);
  
  // Exact match
  if (diff === 0) {
    return 100;
  }
  
  // Off by 1
  if (diff === 1) {
    return 85;
  }
  
  // Off by 2
  if (diff === 2) {
    return 70;
  }
  
  // Off by 3+
  return 40;
}

/**
 * Calculate overall match score
 */
export function calculateMatchScore(supply: PropertyDetails, demand: PropertyDetails): MatchScore {
  const areaScore = calculateAreaScore(supply.area, demand.area);
  const priceScore = calculatePriceScore(supply.price, demand.price);
  const typeScore = calculateTypeScore(supply.type, demand.type);
  const bedroomScore = calculateBedroomScore(supply.bedrooms, demand.bedrooms);
  
  // Weighted calculation: Area 40%, Price 30%, Type 20%, Bedrooms 10%
  const totalScore = (
    (areaScore * 0.40) +
    (priceScore * 0.30) +
    (typeScore * 0.20) +
    (bedroomScore * 0.10)
  );
  
  const isQualified = totalScore >= 70;
  const isHotMatch = totalScore >= 90;
  
  const breakdown = `Area: ${areaScore}% (40%) | Price: ${priceScore}% (30%) | Type: ${typeScore}% (20%) | Bedrooms: ${bedroomScore}% (10%)`;
  
  return {
    totalScore: Math.round(totalScore),
    areaScore,
    priceScore,
    typeScore,
    bedroomScore,
    isQualified,
    isHotMatch,
    breakdown
  };
}

/**
 * Filter matches by minimum threshold (70%)
 */
export function filterQualifiedMatches(matches: Array<{ score: MatchScore }>): Array<{ score: MatchScore }> {
  return matches.filter(m => m.score.isQualified);
}

/**
 * Get hot matches (90%+)
 */
export function getHotMatches(matches: Array<{ score: MatchScore }>): Array<{ score: MatchScore }> {
  return matches.filter(m => m.score.isHotMatch);
}
