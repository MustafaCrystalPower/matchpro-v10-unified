/**
 * General Keyword Classifier for Supply vs Demand
 * Simple, robust classification based on general keywords
 */

// Supply Keywords (offering/selling/renting)
const SUPPLY_KEYWORDS = [
  // Arabic
  'متاح', 'للبيع', 'للايجار', 'للإيجار', 'عندي', 'لدي', 'أملك', 'أملكها',
  'للتمليك', 'للتأجير', 'أعرض', 'أبيع', 'أؤجر', 'أؤجرها', 'بيع', 'إيجار',
  'وحدة متاحة', 'شقة متاحة', 'فيلا متاحة', 'متاحة الآن', 'جاهزة للتسليم',
  'تسليم فوري', 'فرصة', 'فرصة استثمارية', 'عرض', 'عرض خاص',
  // English
  'available', 'for sale', 'for rent', 'selling', 'renting', 'lease',
  'offer', 'listing', 'property', 'unit', 'apartment', 'villa',
  'i have', 'i own', 'owner', 'landlord', 'broker'
];

// Demand Keywords (looking for/searching/requesting)
const DEMAND_KEYWORDS = [
  // Arabic
  'مطلوب', 'محتاج', 'عايز', 'بدور على', 'بدور', 'ابحث', 'ابحث عن', 'أبحث',
  'أبحث عن', 'أريد', 'أرغب', 'يرغب', 'يشترط', 'لازم', 'ضروري', 'عاجل',
  'urgent', 'looking for', 'searching for', 'need', 'want', 'require',
  'client looking', 'buyer looking', 'tenant looking', 'request',
  'budget', 'بادجت', 'بـ', 'ب', 'في حدود', 'في حدود السعر'
];

export interface ClassificationResult {
  classification: 'supply' | 'demand' | 'non_real_estate';
  confidence: number;
  reason: string;
}

/**
 * Filter out non-real-estate messages
 */
function isNonRealEstate(text: string): boolean {
  // Too short (likely emoji or reaction)
  if (text.trim().length < 5) return true;
  
  // Only emojis/dots
  if (/^[\s.❤️👍🏻👏💬🔥✨⭐🎉😍🙏💯🔔📍🏠🏡🏢🏘️👌🎊💪🚀💎⚡🌟💝🎁🎈🎀🎯🎪🎭🎬🎤🎧🎮🎲🎰🃏🎴🀄🎴🎯🎪🎭🎬🎤🎧🎮🎲🎰🃏🎴🀄\s]*$/.test(text)) {
    return true;
  }
  
  // Very common non-real-estate keywords
  const nonRealEstateKeywords = [
    'مرحبا', 'السلام', 'صباح', 'مساء', 'شكرا', 'شكراً', 'من فضلك',
    'hello', 'hi', 'thanks', 'thank you', 'please', 'good morning',
    'good evening', 'good night', 'welcome', 'welcome to'
  ];
  
  const lowerText = text.toLowerCase();
  return nonRealEstateKeywords.some(keyword => lowerText.includes(keyword));
}

/**
 * Classify message as supply or demand using general keywords
 */
export function classifyMessage(text: string): ClassificationResult {
  const lowerText = text.toLowerCase();
  
  // Filter non-real-estate
  if (isNonRealEstate(text)) {
    return {
      classification: 'non_real_estate',
      confidence: 0.9,
      reason: 'Non-real-estate message (too short, emoji only, or greeting)'
    };
  }
  
  // Count supply and demand keywords
  let supplyCount = 0;
  let demandCount = 0;
  
  for (const keyword of SUPPLY_KEYWORDS) {
    if (lowerText.includes(keyword)) {
      supplyCount++;
    }
  }
  
  for (const keyword of DEMAND_KEYWORDS) {
    if (lowerText.includes(keyword)) {
      demandCount++;
    }
  }
  
  // Decision logic
  if (supplyCount > 0 && demandCount === 0) {
    return {
      classification: 'supply',
      confidence: Math.min(0.95, 0.5 + (supplyCount * 0.15)),
      reason: `Found ${supplyCount} supply keyword(s)`
    };
  }
  
  if (demandCount > 0 && supplyCount === 0) {
    return {
      classification: 'demand',
      confidence: Math.min(0.95, 0.5 + (demandCount * 0.15)),
      reason: `Found ${demandCount} demand keyword(s)`
    };
  }
  
  // Both keywords present - use context
  if (supplyCount > 0 && demandCount > 0) {
    // If demand keywords are more, it's demand
    if (demandCount > supplyCount) {
      return {
        classification: 'demand',
        confidence: 0.7,
        reason: `More demand keywords (${demandCount}) than supply (${supplyCount})`
      };
    }
    // If supply keywords are more, it's supply
    if (supplyCount > demandCount) {
      return {
        classification: 'supply',
        confidence: 0.7,
        reason: `More supply keywords (${supplyCount}) than demand (${demandCount})`
      };
    }
    // Equal - check for specific patterns
    if (lowerText.includes('مطلوب') && !lowerText.includes('متاح')) {
      return {
        classification: 'demand',
        confidence: 0.75,
        reason: 'Contains "مطلوب" without "متاح" - likely demand'
      };
    }
  }
  
  // No keywords found - check for property mentions
  const propertyKeywords = ['شقة', 'فيلا', 'دوبلكس', 'ستوديو', 'أرض', 'تاون', 'apartment', 'villa', 'studio', 'land'];
  const hasProperty = propertyKeywords.some(keyword => lowerText.includes(keyword));
  
  if (hasProperty) {
    // If mentions property with price, likely supply
    if (/\d+\s*(مليون|الف|thousand|k|egp|le)/i.test(text)) {
      return {
        classification: 'supply',
        confidence: 0.65,
        reason: 'Contains property mention with price (likely listing)'
      };
    }
    // If mentions property with budget, likely demand
    if (/بادجت|budget|في حدود|بـ\s*\d+/i.test(text)) {
      return {
        classification: 'demand',
        confidence: 0.65,
        reason: 'Contains property mention with budget (likely request)'
      };
    }
  }
  
  // Default: unknown
  return {
    classification: 'non_real_estate',
    confidence: 0.3,
    reason: 'No clear supply or demand indicators'
  };
}

/**
 * Batch classify multiple messages
 */
export function classifyMessages(messages: string[]): ClassificationResult[] {
  return messages.map(msg => classifyMessage(msg));
}

/**
 * Get statistics from classification results
 */
export function getStatistics(results: ClassificationResult[]) {
  const supply = results.filter(r => r.classification === 'supply').length;
  const demand = results.filter(r => r.classification === 'demand').length;
  const nonRealEstate = results.filter(r => r.classification === 'non_real_estate').length;
  const total = results.length;
  
  return {
    supply,
    demand,
    nonRealEstate,
    total,
    supplyPercent: total > 0 ? ((supply / total) * 100).toFixed(1) : '0',
    demandPercent: total > 0 ? ((demand / total) * 100).toFixed(1) : '0',
    nonRealEstatePercent: total > 0 ? ((nonRealEstate / total) * 100).toFixed(1) : '0',
    avgConfidence: total > 0 ? (results.reduce((sum, r) => sum + r.confidence, 0) / total).toFixed(2) : '0'
  };
}
