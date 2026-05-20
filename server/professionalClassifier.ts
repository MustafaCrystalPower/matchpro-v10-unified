/**
 * Professional Supply/Demand Classifier
 * Based on the comprehensive guide: "How to Identify Supply vs Demand in Real Estate Data"
 * 
 * Rules:
 * - Supply = available property with unit details
 * - Demand = requested property with desired specs
 * - Special handling for "مطلوب": if followed by price → Supply, if followed by specs → Demand
 */

export type Classification = 'supply' | 'demand' | 'unknown';

interface ClassificationResult {
  classification: Classification;
  confidence: number;
  triggerWords: string[];
  reason: string;
}

// Strong Supply Indicators
const SUPPLY_KEYWORDS = [
  'متاح', 'للبيع', 'للإيجار', 'مفروشة للإيجار',
  'من المالك', 'من المالك مباشرة', 'استلام', 'تشطيب',
  'دوبلكس', 'شقة', 'فيلا', 'تاون هاوس', 'بنتهاوس', 'ستوديو',
  'دور', 'جاردن', 'فيو', 'ريسبشن', 'مساحة', 'السعر',
  'فرصة', 'for sale', 'for rent', 'available', 'unit',
  'furnished', 'finishing', 'delivery', 'owner', 'developer'
];

// Strong Demand Indicators
const DEMAND_KEYWORDS = [
  'مطلوب شقة', 'مطلوب فيلا', 'مطلوب تمليك', 'مطلوب ايجار', 'بدور على', 'بدور', 'عايز', 'محتاج',
  'عميل جاد', 'client looking', 'tenant looking', 'buyer looking',
  'budget', 'بادجت', 'لازم', 'preferably', 'يشترط', 'يرغب في',
  'ابحث عن', 'ابحث', 'أبحث', 'looking for', 'searching for',
  'need apartment', 'need villa', 'want apartment', 'want villa'
];

// Property detail indicators (suggest Supply if found with listing context)
const PROPERTY_DETAILS = [
  'متر', 'م²', 'غرف', 'نوم', 'حمام', 'دور', 'أول', 'ثاني', 'ثالث',
  'جاردن', 'فيو', 'ريسبشن', 'مطبخ', 'غسيل', 'تراس', 'روف',
  'مفروشة', 'مكيفة', 'مؤثثة', 'بدون', 'مع', 'بحديقة'
];

// Price indicators
const PRICE_KEYWORDS = [
  'ألف', 'الف', 'ألاف', 'الاف', 'مليون', 'مليونين', 'جنيه', 'ج.م', 'egp',
  'k', 'm', 'price', 'سعر', 'تمن', 'قيمة', 'بـ', 'ب'
];

function extractTriggerWords(text: string, keywords: string[]): string[] {
  const lowerText = text.toLowerCase();
  return keywords.filter(kw => lowerText.includes(kw.toLowerCase()));
}

function hasListingStructure(text: string): boolean {
  /**
   * Supply structure: Property type + location + size + rooms + price + source
   * Check if message contains multiple property details
   */
  const detailCount = extractTriggerWords(text, PROPERTY_DETAILS).length;
  const hasPrice = extractTriggerWords(text, PRICE_KEYWORDS).length > 0;
   // Check if has 3+ property details + price (but NOT if it has budget indicator)
  const hasBudget = /بادجت|budget/i.test(text);
  return detailCount >= 3 && hasPrice && !hasBudget;
}

function hasRequestStructure(text: string): boolean {
  /**
   * Demand structure: Need/request + preferred location + desired specs + budget
   * Check if message contains request keywords + budget
   */
  const demandKeywords = extractTriggerWords(text, DEMAND_KEYWORDS);
  const hasBudget = text.match(/بادجت|budget|بـ\s*\d+|ب\s*\d+/i);
  
  return demandKeywords.length > 0 && hasBudget !== null;
}

function handleMatlubAmbiguity(text: string): 'supply' | 'demand' | null {
  /**
   * Special handling for "مطلوب"
   * - If followed by DIRECT price (number + ألف/مليون) → Supply (asking price)
   * - If followed by property specs (شقة/فيلا + details) → Demand (desired property)
   * 
   * IMPORTANT: "مطلوب شقة 3 غرف بادجت 30" = DEMAND (budget is different from asking price)
   */
  const matlubPattern = /مطلوب\s+([^.]+)/i;
  const match = text.match(matlubPattern);
  
  if (!match) return null;
  
  const afterMatlub = match[1].toLowerCase();
  
  // Check if it's DIRECTLY followed by property specs (property type first)
  const propertyFirst = afterMatlub.match(/^(شقة|فيلا|تاون|ستوديو|أرض|دوبلكس|apartment|villa)/i);
  if (propertyFirst) {
    return 'demand'; // "مطلوب شقة 3 غرف" = desired property
  }
  
  // Check if it's DIRECTLY followed by price (number + ألف/مليون, NOT بادجت)
  // Pattern: "مطلوب 35 ألف" or "مطلوب 5 مليون"
  const directPrice = afterMatlub.match(/^\d+\s*(ألف|الف|مليون|جنيه|ج\.م|egp|k|m)\b/i);
  if (directPrice && !afterMatlub.includes('بادجت') && !afterMatlub.includes('budget')) {
    return 'supply'; // "مطلوب 35 ألف" = asking price
  }
  
  return null;
}

function classifyByDecisionTree(text: string): ClassificationResult {
  /**
   * Decision Tree from the guide:
   * Step 1: Does it mention an actual property unit?
   * Step 2: Does it contain listing details?
   * Step 3: Does it sound like an offer?
   * Step 4: Does it request a property?
   */
  
  const lowerText = text.toLowerCase();
  const triggerWords: string[] = [];
  let confidence = 0.5;
  
  // PRIORITY: Check for strong demand keywords FIRST (before property details)
  const strongDemandKeywords = extractTriggerWords(text, ['بدور على', 'بدور', 'مطلوب شقة', 'مطلوب فيلا', 'مطلوب تمليك', 'مطلوب ايجار', 'عايز', 'محتاج']);
  if (strongDemandKeywords.length > 0) {
    triggerWords.push(...strongDemandKeywords);
    return {
      classification: 'demand',
      confidence: 0.92,
      triggerWords,
      reason: 'Contains strong demand keyword (searching/requesting property)'
    };
  }
  
  // Step 1: Check for property unit mention
  const propertyMentioned = /شقة|فيلا|تاون|ستوديو|أرض|دوبلكس|villa|apartment|unit|property/i.test(text);
  
  if (!propertyMentioned) {
    // Step 4: Check for request keywords
    const requestKeywords = extractTriggerWords(text, DEMAND_KEYWORDS);
    if (requestKeywords.length > 0) {
      triggerWords.push(...requestKeywords);
      return {
        classification: 'demand',
        confidence: 0.75,
        triggerWords,
        reason: 'Contains request keywords without property mention'
      };
    }
    return {
      classification: 'unknown',
      confidence: 0.3,
      triggerWords: [],
      reason: 'No clear property mention or request'
    };
  }
  
  // Step 2: Check for listing details (but NOT if it contains budget indicators)
  const hasBudgetIndicator = /بادجت|budget/i.test(text);
  if (hasListingStructure(text) && !hasBudgetIndicator) {
    const supplyKeywords = extractTriggerWords(text, SUPPLY_KEYWORDS);
    triggerWords.push(...supplyKeywords);
    return {
      classification: 'supply',
      confidence: 0.95,
      triggerWords,
      reason: 'Contains multiple property details with price (listing structure)'
    };
  }
  
  // Step 3: Check for offer indicators
  const supplyKeywords = extractTriggerWords(text, SUPPLY_KEYWORDS);
  if (supplyKeywords.length > 0) {
    triggerWords.push(...supplyKeywords);
    return {
      classification: 'supply',
      confidence: 0.85,
      triggerWords,
      reason: 'Contains supply offer indicators'
    };
  }
  
  // Step 4: Check for request indicators (including budget)
  const requestKeywords = extractTriggerWords(text, DEMAND_KEYWORDS);
  const budgetKeywords = extractTriggerWords(text, ['بادجت', 'budget']);
  
  if (requestKeywords.length > 0 || budgetKeywords.length > 0) {
    triggerWords.push(...requestKeywords, ...budgetKeywords);
    return {
      classification: 'demand',
      confidence: 0.85,
      triggerWords,
      reason: 'Contains demand request indicators or budget specification'
    };
  }
  
  // Default: Check if it has property details but no clear classification
  const propertyDetails = extractTriggerWords(text, PROPERTY_DETAILS);
  if (propertyDetails.length >= 2) {
    return {
      classification: 'supply',
      confidence: 0.65,
      triggerWords: propertyDetails,
      reason: 'Contains property details (likely a listing)'
    };
  }
  
  // Default: Unknown
  return {
    classification: 'unknown',
    confidence: 0.4,
    triggerWords: [],
    reason: 'No clear supply or demand indicators'
  };
}

export function classifyMessage(text: string): ClassificationResult {
  if (!text || text.length < 5) {
    return {
      classification: 'unknown',
      confidence: 0.1,
      triggerWords: [],
      reason: 'Message too short'
    };
  }
  
  // Special handling for "مطلوب" ambiguity (BEFORE decision tree)
  const matlubResult = handleMatlubAmbiguity(text);
  if (matlubResult) {
    const triggerWords = extractTriggerWords(text, 
      matlubResult === 'supply' ? SUPPLY_KEYWORDS : DEMAND_KEYWORDS);
    return {
      classification: matlubResult,
      confidence: 0.92,
      triggerWords,
      reason: `"مطلوب" followed by ${matlubResult === 'supply' ? 'direct price (asking price)' : 'property specs (desired property)'}`
    };
  }
  
  // Use decision tree
  return classifyByDecisionTree(text);
}

/**
 * Batch classify messages
 */
export function classifyMessages(messages: string[]): ClassificationResult[] {
  return messages.map(msg => classifyMessage(msg));
}

/**
 * Get classification statistics
 */
export function getStatistics(results: ClassificationResult[]) {
  const stats = {
    total: results.length,
    supply: results.filter(r => r.classification === 'supply').length,
    demand: results.filter(r => r.classification === 'demand').length,
    unknown: results.filter(r => r.classification === 'unknown').length,
    avgConfidence: results.reduce((sum, r) => sum + r.confidence, 0) / results.length
  };
  
  return {
    ...stats,
    supplyPercent: ((stats.supply / stats.total) * 100).toFixed(1),
    demandPercent: ((stats.demand / stats.total) * 100).toFixed(1),
    unknownPercent: ((stats.unknown / stats.total) * 100).toFixed(1)
  };
}
