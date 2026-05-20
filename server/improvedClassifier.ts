/**
 * Improved Real Estate Message Classifier
 * Fixes the 64.5% "unknown" classification issue
 */

// Enhanced supply keywords (offering/selling/renting OUT)
const SUPPLY_KEYWORDS = [
  // Arabic - selling
  'للبيع', 'للـبيع', 'للـــبيع', 'للبيع بـ', 'بيع', 'بيعة', 'عندي للبيع', 'عندي بيع', 'اعلان بيع',
  'لتمليك', 'للتمليك', 'تمليك', 'عرض تمليك',
  // Arabic - renting out
  'للإيجار', 'للايجار', 'للـايجار', 'للـــايجار', 'ايجار', 'إيجار', 'عندي ايجار', 'عندي إيجار',
  'للايجار الشهري', 'للايجار السنوي', 'ايجاري',
  // Arabic - available/offered
  'متاح', 'متوفر', 'متاح قانون', 'قانون', 'عرض', 'اعلان',
  // English
  'for sale', 'for rent', 'selling', 'renting', 'available', 'offering',
  'to sell', 'to rent', 'property for', 'apartment for', 'villa for'
];

// Enhanced demand keywords (looking for/wanting/seeking)
const DEMAND_KEYWORDS = [
  // Arabic - buying/renting
  'مطلوب', 'مطلوبة', 'محتاج', 'محتاجة', 'عايز', 'عايزة', 'بدور على', 'بدور',
  'ابحث عن', 'ابحث', 'أبحث', 'اريد', 'أريد', 'بحاجة', 'بحاجه',
  'لو في', 'لو فيه', 'لو فى', 'هل عندك', 'هل عندكم', 'هل لديك',
  'مطلوب للتمليك', 'مطلوب تمليك', 'مطلوب شراء',
  'مطلوب للايجار', 'مطلوب إيجار', 'مطلوب ايجار',
  'محتاج شقة', 'محتاج فيلا', 'محتاج شراء',
  'عايز شقة', 'عايز فيلا', 'عايز شراء',
  'مطلوب ٨٠م', 'مطلوب 80م', 'مطلوب 70م', // Common patterns with sizes
  // English
  'looking for', 'need', 'want', 'seeking', 'required', 'searching for',
  'i need', 'i want', 'we need', 'we want', 'looking to buy', 'looking to rent',
  'interested in', 'can you help', 'do you have'
];

// Property type keywords
const PROPERTY_KEYWORDS = [
  'شقة', 'شقه', 'apartment', 'flat',
  'فيلا', 'villa',
  'دوبلكس', 'duplex',
  'استوديو', 'studio',
  'أرض', 'ارض', 'land',
  'محل', 'shop', 'store',
  'مكتب', 'office',
  'عمارة', 'building',
  'شاليه', 'chalet',
  'تاون هاوس', 'townhouse'
];

// Location keywords (to detect it's about real estate)
const LOCATION_KEYWORDS = [
  'التجمع', 'الشيخ زايد', 'المعادي', 'مدينة نصر', 'الرحاب',
  'القاهرة الجديدة', '6 اكتوبر', 'الساحل الشمالي', 'العاصمة الادارية',
  'مدينتي', 'madinaty', // Madinaty
  'new cairo', 'sheikh zayed', 'maadi', 'nasr city', 'rehab',
  'october', 'north coast', 'new capital',
  // Madinaty B-series (all are Madinaty)
  'b10', 'b11', 'b12', 'b13', 'b14', 'b15', 'b16', 'b17', 'b18',
  'B10', 'B11', 'B12', 'B13', 'B14', 'B15', 'B16', 'B17', 'B18'
];

// Price keywords (to confirm real estate context)
const PRICE_KEYWORDS = [
  'مليون', 'الف', 'ألف', 'جنيه', 'ج.م', 'egp', 'le',
  'million', 'thousand', 'pound', 'egp', 'le'
];

// Size keywords (to confirm real estate context)
const SIZE_KEYWORDS = [
  'متر', 'م', 'sqm', 'm2', 'square', 'م²',
  'غرفة', 'غرف', 'bedroom', 'bed', 'br'
];

export interface ClassificationResult {
  classification: 'supply' | 'demand' | 'unknown';
  confidence: number;
  reason: string;
  hasPropertyKeywords: boolean;
  hasLocationKeywords: boolean;
  hasPriceKeywords: boolean;
  hasSizeKeywords: boolean;
}

/**
 * Improved classification logic
 */
/**
 * Map B-series to Madinaty area
 */
function extractArea(text: string): string | null {
  const bSeriesMatch = text.match(/[bB](\d{1,2})/i);
  if (bSeriesMatch) {
    return 'مدينتي'; // All B-series are in Madinaty
  }
  
  // Check for explicit location keywords
  const locations = [
    'التجمع', 'الشيخ زايد', 'المعادي', 'مدينة نصر', 'الرحاب',
    'القاهرة الجديدة', '6 اكتوبر', 'الساحل الشمالي', 'العاصمة الادارية',
    'مدينتي'
  ];
  
  for (const loc of locations) {
    if (text.includes(loc)) {
      return loc;
    }
  }
  
  return null;
}

export function classifyMessage(text: string): ClassificationResult {
  const textLower = text.toLowerCase();
  const textArabic = text;
  
  // Check for property-related keywords
  const hasPropertyKeywords = PROPERTY_KEYWORDS.some(k => 
    textLower.includes(k.toLowerCase()) || textArabic.includes(k)
  );
  
  const hasLocationKeywords = LOCATION_KEYWORDS.some(k =>
    textLower.includes(k.toLowerCase()) || textArabic.includes(k)
  );
  
  const hasPriceKeywords = PRICE_KEYWORDS.some(k =>
    textLower.includes(k.toLowerCase()) || textArabic.includes(k)
  );
  
  const hasSizeKeywords = SIZE_KEYWORDS.some(k =>
    textLower.includes(k.toLowerCase()) || textArabic.includes(k)
  );
  
  // Check for supply keywords
  const hasSupplyKeywords = SUPPLY_KEYWORDS.some(k =>
    textLower.includes(k.toLowerCase()) || textArabic.includes(k)
  );
  
  // Check for demand keywords
  const hasDemandKeywords = DEMAND_KEYWORDS.some(k =>
    textLower.includes(k.toLowerCase()) || textArabic.includes(k)
  );
  
  // Determine classification
  let classification: 'supply' | 'demand' | 'unknown' = 'unknown';
  let confidence = 0;
  let reason = '';
  
  // If has demand keywords
  if (hasDemandKeywords) {
    classification = 'demand';
    confidence = 0.9;
    reason = 'Contains demand keywords (مطلوب, محتاج, عايز, etc.)';
    
    // Boost confidence if also has property/location/price keywords
    if (hasPropertyKeywords || hasLocationKeywords || hasPriceKeywords) {
      confidence = 0.95;
      reason += ' + property/location/price context';
    }
  }
  // If has supply keywords
  else if (hasSupplyKeywords) {
    classification = 'supply';
    confidence = 0.9;
    reason = 'Contains supply keywords (للبيع, للايجار, متاح, etc.)';
    
    // Boost confidence if also has property/location/price keywords
    if (hasPropertyKeywords || hasLocationKeywords || hasPriceKeywords) {
      confidence = 0.95;
      reason += ' + property/location/price context';
    }
  }
  // If no explicit keywords but has property context
  else if (hasPropertyKeywords && (hasLocationKeywords || hasPriceKeywords || hasSizeKeywords)) {
    // Try to infer from context
    // If message mentions property + location/price/size but no explicit buy/sell keyword,
    // it's likely a demand (someone describing what they want)
    classification = 'demand';
    confidence = 0.7;
    reason = 'Property context detected (property + location/price/size) - likely demand';
  }
  // If has only property keywords
  else if (hasPropertyKeywords) {
    classification = 'demand';
    confidence = 0.6;
    reason = 'Property keywords detected - likely demand';
  }
  // If has price/size keywords (real estate context)
  else if (hasPriceKeywords || hasSizeKeywords) {
    classification = 'demand';
    confidence = 0.5;
    reason = 'Price/size keywords detected - likely real estate related';
  }
  
  return {
    classification,
    confidence,
    reason,
    hasPropertyKeywords,
    hasLocationKeywords,
    hasPriceKeywords,
    hasSizeKeywords
  };
}

/**
 * Batch reclassify messages
 */
export async function reclassifyMessages(messages: Array<{ id: number; messageText: string }>) {
  const results = [];
  
  for (const msg of messages) {
    const result = classifyMessage(msg.messageText);
    results.push({
      id: msg.id,
      oldClassification: 'unknown',
      newClassification: result.classification,
      confidence: result.confidence,
      reason: result.reason
    });
  }
  
  return results;
}

/**
 * Test the classifier with sample messages
 */
export function testClassifier() {
  const testMessages = [
    'مطلوب للتمليك بمدينتي 74م 78م دور متكرر مقدم 3مليون عميل جاد',
    'مطلوب ايجار قانون غرفتين B12 فقط اي جروب ماعدا 124 أسرة فلسطينية فردين',
    'مطلوب 70م كاش دور متكرر بالفرش والأجهزة عميل جاد',
    'مطلوب تمليك في مدينتي اي مرحله ماعدا b11 اي دور ما عدا اخير مساحه فوق 130 متر',
    'Apartment for rent in ZED Fully furnished BUA 100m 4th floor 2 bedrooms',
    'الأوفر 3.500.000',
    'استعمل هذا الرابط للانضمام إلى مجموعتي في واتساب',
    'عندي شقة للبيع في التجمع الخامس 150م بـ 5 مليون',
    'فيلا للايجار الشهري 3 غرف 250م بـ 15 الف شهري'
  ];
  
  console.log('\n🧪 Testing Improved Classifier:\n');
  for (const msg of testMessages) {
    const result = classifyMessage(msg);
    console.log(`📱 "${msg.substring(0, 60)}..."`);
    console.log(`   Classification: ${result.classification} (${(result.confidence * 100).toFixed(0)}%)`);
    console.log(`   Reason: ${result.reason}`);
    console.log('');
  }
}
