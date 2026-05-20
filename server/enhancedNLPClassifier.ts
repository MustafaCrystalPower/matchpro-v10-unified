/**
 * Enhanced NLP Classifier - Priority 1
 * Targets: <3% unknown classification
 * Features: Arabic compound areas, price formats, improved accuracy
 */

// Comprehensive Arabic area keywords (compound names)
const AREA_KEYWORDS = {
  'مدينتي': ['مدينتي', 'b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8', 'b9', 'b10', 'b11', 'b12', 'b13', 'b14', 'b15', 'b16'],
  'التجمع الخامس': ['التجمع الخامس', 'التجمع 5', 'التجمع5', 'new cairo', 'new cairo', 'التجمع'],
  'القاهرة الجديدة': ['القاهرة الجديدة', 'new cairo', 'new cairo', 'nc'],
  'الرحاب': ['الرحاب', 'rehab', 'al rehab'],
  'الشيخ زايد': ['الشيخ زايد', 'sheikh zayed', 'zayed'],
  'مدينة نصر': ['مدينة نصر', 'nasr city', 'nasser'],
  'المعادي': ['المعادي', 'maadi', 'al maadi'],
  '6 اكتوبر': ['6 اكتوبر', 'october', '6th of october'],
  'الساحل الشمالي': ['الساحل الشمالي', 'north coast', 'nc', 'sahel'],
  'العاصمة الإدارية': ['العاصمة الإدارية', 'new capital', 'administrative capital'],
  'الجيزة': ['الجيزة', 'giza', 'جيزة'],
  'الإسماعيلية': ['الإسماعيلية', 'ismailia', 'ismailia'],
  'الإسكندرية': ['الإسكندرية', 'alexandria', 'alex'],
  'الساحل': ['الساحل', 'coast', 'coastal']
};

// Supply keywords (offering/selling/renting)
const SUPPLY_KEYWORDS = [
  'متاح', 'للبيع', 'للايجار', 'للإيجار', 'عندي', 'لدي', 'أملك',
  'للتمليك', 'للتأجير', 'أعرض', 'أبيع', 'أؤجر', 'بيع', 'إيجار',
  'وحدة متاحة', 'شقة متاحة', 'فيلا متاحة', 'متاحة الآن', 'جاهزة',
  'تسليم فوري', 'فرصة', 'عرض', 'available', 'for sale', 'for rent',
  'selling', 'renting', 'lease', 'listing', 'owner', 'landlord'
];

// Demand keywords (looking for/searching/requesting)
const DEMAND_KEYWORDS = [
  'مطلوب', 'محتاج', 'عايز', 'بدور على', 'بدور', 'ابحث', 'أبحث',
  'أريد', 'أرغب', 'يرغب', 'يشترط', 'لازم', 'ضروري', 'عاجل',
  'looking for', 'searching for', 'need', 'want', 'require', 'request',
  'budget', 'بادجت', 'في حدود', 'client', 'buyer', 'tenant'
];

// Price format patterns
const PRICE_PATTERNS = [
  /(\d+(?:[.,]\d+)?)\s*(مليون|million|m)/i,
  /(\d+(?:[.,]\d+)?)\s*(الف|ألف|thousand|k)/i,
  /(\d+(?:[.,]\d+)?)\s*(egp|le|جنيه)/i,
  /(\d+(?:[.,]\d+)?)\s*$/i  // Just number at end
];

interface ClassificationResult {
  classification: 'supply' | 'demand' | 'unknown';
  confidence: number;
  area: string;
  price: string;
  reason: string;
}

/**
 * Extract area from message
 */
function extractArea(text: string): string {
  const lowerText = text.toLowerCase();
  
  for (const [area, keywords] of Object.entries(AREA_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        return area;
      }
    }
  }
  
  return 'Unknown';
}

/**
 * Extract price from message
 */
function extractPrice(text: string): string {
  for (const pattern of PRICE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      let num = parseFloat(match[1].replace(',', '.'));
      const unit = match[2]?.toLowerCase() || '';
      
      if (unit.includes('مليون') || unit.includes('million') || unit === 'm') {
        num *= 1000000;
      } else if (unit.includes('الف') || unit.includes('ألف') || unit.includes('thousand') || unit === 'k') {
        num *= 1000;
      }
      
      return `${num.toLocaleString()} EGP`;
    }
  }
  
  return '-';
}

/**
 * Classify message with enhanced accuracy
 */
export function classifyMessageEnhanced(text: string): ClassificationResult {
  const lowerText = text.toLowerCase();
  
  // Filter non-real-estate
  if (text.trim().length < 5 || /^[\s.❤️👍🏻💬🔥✨⭐🎉😍🙏💯\s]*$/.test(text)) {
    return {
      classification: 'unknown',
      confidence: 0.95,
      area: 'Unknown',
      price: '-',
      reason: 'Non-real-estate message (too short or emoji only)'
    };
  }
  
  // Count supply and demand keywords
  let supplyCount = 0;
  let demandCount = 0;
  
  for (const keyword of SUPPLY_KEYWORDS) {
    if (lowerText.includes(keyword.toLowerCase())) {
      supplyCount++;
    }
  }
  
  for (const keyword of DEMAND_KEYWORDS) {
    if (lowerText.includes(keyword.toLowerCase())) {
      demandCount++;
    }
  }
  
  // Decision logic
  if (demandCount > supplyCount) {
    return {
      classification: 'demand',
      confidence: Math.min(0.98, 0.6 + (demandCount * 0.12)),
      area: extractArea(text),
      price: extractPrice(text),
      reason: `Found ${demandCount} demand keyword(s)`
    };
  }
  
  if (supplyCount > demandCount) {
    return {
      classification: 'supply',
      confidence: Math.min(0.98, 0.6 + (supplyCount * 0.12)),
      area: extractArea(text),
      price: extractPrice(text),
      reason: `Found ${supplyCount} supply keyword(s)`
    };
  }
  
  // Check for property mentions with price/budget
  const hasProperty = /شقة|فيلا|دوبلكس|استوديو|أرض|تاون|apartment|villa|studio|land|townhouse/i.test(text);
  
  if (hasProperty) {
    // Has price → likely supply
    if (/\d+\s*(مليون|الف|thousand|k|egp|le)/i.test(text)) {
      return {
        classification: 'supply',
        confidence: 0.75,
        area: extractArea(text),
        price: extractPrice(text),
        reason: 'Property mention with price (likely listing)'
      };
    }
    // Has budget → likely demand
    if (/بادجت|budget|في حدود|بـ\s*\d+/i.test(text)) {
      return {
        classification: 'demand',
        confidence: 0.75,
        area: extractArea(text),
        price: extractPrice(text),
        reason: 'Property mention with budget (likely request)'
      };
    }
  }
  
  // Default: unknown
  return {
    classification: 'unknown',
    confidence: 0.2,
    area: extractArea(text),
    price: extractPrice(text),
    reason: 'No clear supply or demand indicators'
  };
}

/**
 * Batch classify messages
 */
export function classifyMessagesEnhanced(messages: string[]): ClassificationResult[] {
  return messages.map(msg => classifyMessageEnhanced(msg));
}

/**
 * Get statistics
 */
export function getStatisticsEnhanced(results: ClassificationResult[]) {
  const supply = results.filter(r => r.classification === 'supply').length;
  const demand = results.filter(r => r.classification === 'demand').length;
  const unknown = results.filter(r => r.classification === 'unknown').length;
  const total = results.length;
  
  return {
    supply,
    demand,
    unknown,
    unknownPercent: total > 0 ? ((unknown / total) * 100).toFixed(2) : '0',
    avgConfidence: total > 0 ? (results.reduce((sum, r) => sum + r.confidence, 0) / total).toFixed(2) : '0'
  };
}
