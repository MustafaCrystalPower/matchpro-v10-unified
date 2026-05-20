import type { Supply, Demand, Match } from "../drizzle/schema";

/**
 * Format price in human-readable format (millions/thousands)
 */
export function formatPrice(price: number | string | null | undefined): string {
  if (!price) return "price negotiable";
  
  const num = typeof price === 'string' ? parseFloat(price) : price;
  if (isNaN(num)) return "price negotiable";
  
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M EGP`;
  } else if (num >= 1_000) {
    return `${(num / 1_000).toFixed(0)}K EGP`;
  } else {
    return `${num.toFixed(0)} EGP`;
  }
}

/**
 * Format size in sqm
 */
export function formatSize(size: number | null | undefined): string {
  if (!size) return "";
  return `${size}sqm`;
}

interface SupplyData {
  id?: number;
  propertyType?: string | null;
  location?: string | null;
  area?: string | null;
  price?: string | number | null;
  size?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  purpose?: string | null;
  contact?: string | null;
  contactName?: string | null;
}

interface DemandData {
  id?: number;
  propertyType?: string | null;
  location?: string | null;
  area?: string | null;
  priceMin?: string | number | null;
  priceMax?: string | number | null;
  sizeMin?: number | null;
  sizeMax?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  purpose?: string | null;
  contact?: string | null;
  contactName?: string | null;
}

/**
 * Generate human-readable match summary
 * 
 * Example output:
 * "Ahmed (01022382328) looking for apartment in Sheikh Zayed, budget 2.5M EGP 
 *  → Matched (95%) with Soaad (01098765432) selling 2-bedroom apartment for 2.3M EGP"
 */
export function generateMatchSummary(
  supply: SupplyData,
  demand: DemandData,
  score: number
): string {
  // Buyer part
  const buyerName = demand.contactName || "Anonymous Buyer";
  const buyerPhone = demand.contact || "No phone";
  const buyerType = demand.propertyType || "property";
  const buyerLocation = demand.location || demand.area || "any location";
  const buyerBudget = demand.priceMax 
    ? formatPrice(demand.priceMax) 
    : (demand.priceMin ? `from ${formatPrice(demand.priceMin)}` : "flexible budget");
  
  // Seller part
  const sellerName = supply.contactName || "Anonymous Seller";
  const sellerPhone = supply.contact || "No phone";
  const sellerBedrooms = supply.bedrooms;
  const sellerType = supply.propertyType || "property";
  const sellerLocation = supply.location || supply.area || "location not specified";
  const sellerPrice = formatPrice(supply.price);
  const sellerSize = supply.size ? ` (${formatSize(supply.size)})` : "";
  
  // Build summary
  let summary = `${buyerName} (${buyerPhone}) looking for ${buyerType} in ${buyerLocation}, budget ${buyerBudget}`;
  summary += `\n→ Matched (${Math.min(100, Math.round(score))}%) with ${sellerName} (${sellerPhone})`;
  
  if (sellerBedrooms) {
    summary += ` selling ${sellerBedrooms}-bedroom ${sellerType}`;
  } else {
    summary += ` selling ${sellerType}`;
  }
  
  summary += ` in ${sellerLocation} for ${sellerPrice}${sellerSize}`;
  
  return summary;
}

/**
 * Generate detailed match explanation with checkmarks and warnings
 */
export function generateMatchExplanation(
  supply: SupplyData,
  demand: DemandData,
  score: number,
  locationScore?: number,
  priceScore?: number,
  specsScore?: number
): string {
  const explanations: string[] = [];
  
  // Location match
  if (supply.location && demand.location) {
    const supplyLoc = (supply.location || "").toLowerCase();
    const demandLoc = (demand.location || "").toLowerCase();
    
    if (supplyLoc === demandLoc) {
      explanations.push(`✓ Location match: Both in ${supply.location}`);
    } else if (supplyLoc.includes(demandLoc) || demandLoc.includes(supplyLoc)) {
      explanations.push(`✓ Location match: ${supply.location} is within ${demand.location} area`);
    } else {
      explanations.push(`⚠ Location difference: ${supply.location} vs ${demand.location} requested`);
    }
  } else if (supply.location) {
    explanations.push(`✓ Location: ${supply.location} (buyer flexible on location)`);
  }
  
  // Price match
  const supplyPrice = supply.price ? (typeof supply.price === 'string' ? parseFloat(supply.price) : supply.price) : null;
  const demandMaxPrice = demand.priceMax ? (typeof demand.priceMax === 'string' ? parseFloat(demand.priceMax) : demand.priceMax) : null;
  const demandMinPrice = demand.priceMin ? (typeof demand.priceMin === 'string' ? parseFloat(demand.priceMin) : demand.priceMin) : null;
  
  if (supplyPrice && demandMaxPrice) {
    if (supplyPrice <= demandMaxPrice) {
      const savings = demandMaxPrice - supplyPrice;
      if (savings > 0) {
        explanations.push(`✓ Price match: Asking ${formatPrice(supplyPrice)} fits budget of ${formatPrice(demandMaxPrice)} (potential savings: ${formatPrice(savings)})`);
      } else {
        explanations.push(`✓ Price match: Asking ${formatPrice(supplyPrice)} matches budget of ${formatPrice(demandMaxPrice)}`);
      }
    } else {
      const over = supplyPrice - demandMaxPrice;
      explanations.push(`⚠ Price over budget: Asking ${formatPrice(supplyPrice)} exceeds budget by ${formatPrice(over)}`);
    }
  } else if (supplyPrice && demandMinPrice) {
    if (supplyPrice >= demandMinPrice) {
      explanations.push(`✓ Price match: Asking ${formatPrice(supplyPrice)} meets minimum budget of ${formatPrice(demandMinPrice)}`);
    }
  } else if (supplyPrice) {
    explanations.push(`✓ Price: ${formatPrice(supplyPrice)} (buyer budget flexible)`);
  }
  
  // Property type match
  if (supply.propertyType && demand.propertyType) {
    const supplyType = (supply.propertyType || "").toLowerCase();
    const demandType = (demand.propertyType || "").toLowerCase();
    
    if (supplyType === demandType) {
      explanations.push(`✓ Property type: ${capitalizeFirst(supply.propertyType)} (as requested)`);
    } else {
      explanations.push(`⚠ Property type: ${capitalizeFirst(supply.propertyType)} vs ${capitalizeFirst(demand.propertyType)} requested`);
    }
  } else if (supply.propertyType) {
    explanations.push(`✓ Property type: ${capitalizeFirst(supply.propertyType)}`);
  }
  
  // Bedrooms match
  if (supply.bedrooms && demand.bedrooms) {
    if (supply.bedrooms === demand.bedrooms) {
      explanations.push(`✓ Bedrooms: ${supply.bedrooms} bedrooms (exact match)`);
    } else if (supply.bedrooms >= demand.bedrooms) {
      explanations.push(`✓ Bedrooms: ${supply.bedrooms} bedrooms (${supply.bedrooms - demand.bedrooms} extra)`);
    } else {
      explanations.push(`⚠ Bedrooms: ${supply.bedrooms} vs ${demand.bedrooms} requested`);
    }
  } else if (supply.bedrooms) {
    explanations.push(`✓ Bedrooms: ${supply.bedrooms} bedrooms`);
  }
  
  // Size match
  if (supply.size && demand.sizeMin) {
    if (supply.size >= demand.sizeMin) {
      explanations.push(`✓ Size: ${supply.size}sqm meets minimum requirement of ${demand.sizeMin}sqm`);
    } else {
      explanations.push(`⚠ Size: ${supply.size}sqm below minimum ${demand.sizeMin}sqm`);
    }
  } else if (supply.size) {
    explanations.push(`✓ Size: ${supply.size}sqm - great space`);
  }
  
  // Bathrooms match
  if (supply.bathrooms && demand.bathrooms) {
    if (supply.bathrooms >= demand.bathrooms) {
      explanations.push(`✓ Bathrooms: ${supply.bathrooms} bathrooms`);
    } else {
      explanations.push(`⚠ Bathrooms: ${supply.bathrooms} vs ${demand.bathrooms} requested`);
    }
  }
  
  // Purpose match
  if (supply.purpose && demand.purpose) {
    if (supply.purpose === demand.purpose) {
      explanations.push(`✓ Purpose: For ${supply.purpose} (as requested)`);
    } else {
      explanations.push(`⚠ Purpose mismatch: For ${supply.purpose} vs ${demand.purpose} requested`);
    }
  }
  
  // Score breakdown (if available)
  if (locationScore !== undefined || priceScore !== undefined || specsScore !== undefined) {
    explanations.push("");
    explanations.push("📊 Score Breakdown:");
    if (locationScore !== undefined) {
      explanations.push(`   Location: ${Math.min(100, Math.round(Number(locationScore)))}% (weight: 40%)`);
    }
    if (priceScore !== undefined) {
      explanations.push(`   Price: ${Math.min(100, Math.round(Number(priceScore)))}% (weight: 35%)`);
    }
    if (specsScore !== undefined) {
      explanations.push(`   Specs: ${Math.min(100, Math.round(Number(specsScore)))}% (weight: 25%)`);
    }
  }
  
  // Overall assessment
  explanations.push("");
  const cappedScore = Math.min(100, score);
  if (cappedScore >= 90) {
    explanations.push("🎯 Excellent match - Highly recommended");
  } else if (cappedScore >= 75) {
    explanations.push("👍 Good match - Worth exploring");
  } else if (cappedScore >= 60) {
    explanations.push("🤔 Moderate match - Some compromises needed");
  } else {
    explanations.push("⚠️ Weak match - Significant differences");
  }
  
  return explanations.join("\n");
}

/**
 * Capitalize first letter
 */
function capitalizeFirst(str: string | null | undefined): string {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Generate short match label for cards
 */
export function generateMatchLabel(score: number): { text: string; color: string } {
  if (score >= 90) {
    return { text: "Excellent Match", color: "emerald" };
  } else if (score >= 75) {
    return { text: "Good Match", color: "blue" };
  } else if (score >= 60) {
    return { text: "Moderate Match", color: "amber" };
  } else {
    return { text: "Weak Match", color: "red" };
  }
}

/**
 * Calculate potential savings
 */
export function calculateSavings(
  supplyPrice: number | string | null | undefined,
  demandMaxPrice: number | string | null | undefined
): number | null {
  if (!supplyPrice || !demandMaxPrice) return null;
  
  const supply = typeof supplyPrice === 'string' ? parseFloat(supplyPrice) : supplyPrice;
  const demand = typeof demandMaxPrice === 'string' ? parseFloat(demandMaxPrice) : demandMaxPrice;
  
  if (isNaN(supply) || isNaN(demand)) return null;
  
  const savings = demand - supply;
  return savings > 0 ? savings : null;
}
