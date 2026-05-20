/**
 * Enhanced WhatsApp Message Parser
 * Handles Arabic/English mixed messages for Egyptian real estate
 * Extracts: name, phone, property type, location, price, bedrooms, bathrooms, area
 */

// Egyptian phone patterns - comprehensive coverage
const PHONE_PATTERNS = [
  /\b(010|011|012|015)\d{8}\b/,                    // Standard: 01012345678
  /\b(01[0125])\s*\d{4}\s*\d{4}\b/,               // With spaces: 010 1234 5678
  /\+20\s*(1[0125])\d{8}\b/,                       // International: +20 10 12345678
  /\b(010|011|012|015)[-\s]?\d{4}[-\s]?\d{4}\b/,  // With dashes: 010-1234-5678
  /٠١[٠١٢٥][٠-٩]{8}/,                             // Arabic numerals
];

// Name extraction patterns - Arabic and English
const NAME_PATTERNS_ARABIC = [
  /(?:اسمي|انا|معاك|معاكم|معكم|سلام\s+عليكم\s+انا)\s+([ء-ي\s]{2,40})/i,
  /(?:الاسم|اسم)\s*[:：]?\s*([ء-ي\s]{2,40})/i,
  /^([ء-ي]+(?:\s+[ء-ي]+){0,3})\s*(?:01|\+20)/m,  // Name before phone at start
  /([ء-ي]+(?:\s+[ء-ي]+){0,3})\s+(?:عندي|معايا|للبيع|للايجار|محتاج|عايز)/i,
];

const NAME_PATTERNS_ENGLISH = [
  /(?:my name is|i am|i'm|this is|name:|name\s+is|hi i'm|hello i'm)\s+([A-Za-z\s]{2,40})/i,
  /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})\s*(?:01|\+20)/m,  // Capitalized name before phone at start
  /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})\s+(?:selling|renting|looking|need|want)/i,
  /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\s+(?:01|\+20)/,  // Capitalized name before phone anywhere
];

// Property types - Arabic and English
const PROPERTY_TYPES: Record<string, string[]> = {
  'apartment': ['شقة', 'شقه', 'apartment', 'flat', 'unit', 'شقق'],
  'villa': ['فيلا', 'فيلات', 'villa', 'house', 'منزل'],
  'studio': ['ستوديو', 'استوديو', 'studio'],
  'duplex': ['دوبلكس', 'duplex', 'دوبلكسات'],
  'penthouse': ['بنتهاوس', 'penthouse', 'روف'],
  'land': ['ارض', 'أرض', 'land', 'plot', 'قطعة ارض'],
  'office': ['مكتب', 'مكاتب', 'office', 'offices'],
  'shop': ['محل', 'محلات', 'shop', 'store', 'تجاري'],
  'chalet': ['شاليه', 'شاليهات', 'chalet'],
  'townhouse': ['تاون هاوس', 'townhouse', 'تاونهاوس'],
  'twin house': ['توين هاوس', 'twin house', 'توينهاوس'],
};

// Egyptian locations - comprehensive list
const LOCATIONS = [
  // New Cairo cluster
  { name: 'التجمع الخامس', aliases: ['التجمع', 'التجمع الخامس', '5th settlement', 'fifth settlement', 'tagamoa', 'tagamo3', 'تجمع'] },
  { name: 'القاهرة الجديدة', aliases: ['القاهرة الجديدة', 'new cairo', 'cairo new', 'القاهره الجديده'] },
  { name: 'الرحاب', aliases: ['الرحاب', 'rehab', 'el rehab', 'رحاب'] },
  { name: 'مدينتي', aliases: ['مدينتي', 'madinaty', 'madinty', 'مدينتى'] },
  
  // 6th October cluster
  { name: 'الشيخ زايد', aliases: ['الشيخ زايد', 'sheikh zayed', 'zayed', 'شيخ زايد', 'زايد'] },
  { name: '6 اكتوبر', aliases: ['6 اكتوبر', '6 october', 'october', 'اكتوبر', '٦ اكتوبر', 'sixth october'] },
  { name: 'الحصري', aliases: ['الحصري', 'hosary', 'el hosary'] },
  
  // Heliopolis cluster
  { name: 'مصر الجديدة', aliases: ['مصر الجديدة', 'heliopolis', 'مصر الجديده'] },
  { name: 'مدينة نصر', aliases: ['مدينة نصر', 'nasr city', 'مدينه نصر', 'نصر'] },
  { name: 'العباسية', aliases: ['العباسية', 'abbasiya', 'عباسية'] },
  
  // Maadi cluster
  { name: 'المعادي', aliases: ['المعادي', 'maadi', 'معادي', 'المعادى'] },
  { name: 'دجلة', aliases: ['دجلة', 'degla', 'دجله'] },
  { name: 'الزهراء', aliases: ['الزهراء', 'zahraa', 'زهراء المعادي'] },
  
  // Downtown cluster
  { name: 'الزمالك', aliases: ['الزمالك', 'zamalek', 'زمالك'] },
  { name: 'وسط البلد', aliases: ['وسط البلد', 'downtown', 'داون تاون'] },
  { name: 'جاردن سيتي', aliases: ['جاردن سيتي', 'garden city'] },
  { name: 'المنيل', aliases: ['المنيل', 'manial', 'منيل'] },
  
  // Giza cluster
  { name: 'الجيزة', aliases: ['الجيزة', 'giza', 'جيزة'] },
  { name: 'الهرم', aliases: ['الهرم', 'haram', 'هرم'] },
  { name: 'فيصل', aliases: ['فيصل', 'faisal'] },
  { name: 'الدقي', aliases: ['الدقي', 'dokki', 'دقي'] },
  { name: 'المهندسين', aliases: ['المهندسين', 'mohandessin', 'مهندسين'] },
  
  // New cities
  { name: 'العاصمة الادارية', aliases: ['العاصمة الادارية', 'new capital', 'administrative capital', 'العاصمه الاداريه', 'العاصمة'] },
  { name: 'الشروق', aliases: ['الشروق', 'shorouk', 'el shorouk', 'شروق'] },
  { name: 'بدر', aliases: ['بدر', 'badr', 'badr city'] },
  { name: 'العبور', aliases: ['العبور', 'obour', 'el obour', 'عبور'] },
  { name: 'العاشر من رمضان', aliases: ['العاشر من رمضان', '10th of ramadan', 'عاشر رمضان', 'العاشر'] },
  { name: 'المستقبل', aliases: ['المستقبل', 'mostakbal', 'mustaqbal', 'مستقبل سيتي'] },
  
  // Coastal
  { name: 'الساحل الشمالي', aliases: ['الساحل الشمالي', 'north coast', 'sahel', 'الساحل', 'ساحل'] },
  { name: 'العين السخنة', aliases: ['العين السخنة', 'ain sokhna', 'sokhna', 'السخنة', 'عين السخنه'] },
  { name: 'الاسكندرية', aliases: ['الاسكندرية', 'alexandria', 'alex', 'اسكندرية', 'اسكندريه'] },
  
  // Other
  { name: 'المقطم', aliases: ['المقطم', 'mokattam', 'مقطم'] },
  { name: 'حدائق الاهرام', aliases: ['حدائق الاهرام', 'hadayek ahram', 'حدائق الأهرام'] },
  { name: 'حدائق اكتوبر', aliases: ['حدائق اكتوبر', 'hadayek october'] },
  { name: 'بريفادو', aliases: ['بريفادو', 'privado'] },
  { name: 'مفيدا', aliases: ['مفيدا', 'mivida', 'ميفيدا'] },
  { name: 'فيفث سكوير', aliases: ['fifth square', 'فيفث سكوير', '5th square'] },
  { name: 'أليجريا', aliases: ['أليجريا', 'اليجريا', 'allegria', 'sodic west'] },
  { name: 'ليك فيو', aliases: ['ليك فيو', 'lake view', 'lakeview'] },
  { name: 'علي بارك', aliases: ['علي بارك', 'ali park'] },
  { name: 'فوكا باي', aliases: ['فوكا باي', 'fouka bay', 'فوكا'] },
  { name: 'سيدي عبد الرحمن', aliases: ['سيدي عبد الرحمن', 'sidi abdel rahman', 'sidi abd el rahman'] },
  { name: 'بورتو', aliases: ['بورتو', 'porto', 'porto said', 'porto sokhna', 'porto october'] },
  { name: 'ماونتن فيو', aliases: ['ماونتن فيو', 'mountain view', 'mountainview'] },
  { name: 'هايد بارك', aliases: ['هايد بارك', 'hyde park', 'hydepark'] },
  { name: 'ميراكيا', aliases: ['ميراكيا', 'mirakya', 'mirakez'] },
  { name: 'كمبوند', aliases: ['كمبوند', 'compound'] },
  // New Cairo compounds
  { name: 'كاتاميا هايتس', aliases: ['katameya heights', 'كاتاميا', 'katameya'] },
  { name: 'إيستاون', aliases: ['eastown', 'إيستاون', 'east town'] },
  { name: 'ستون بارك', aliases: ['stone park', 'ستون بارك'] },
  { name: 'سيتي جيت', aliases: ['city gate', 'سيتي جيت'] },
  { name: 'ويستاون', aliases: ['ويستاون', 'westown', 'west town'] },
  { name: 'بادية', aliases: ['بادية', 'badya'] },
  { name: 'كازا', aliases: ['كازا', 'casa', 'casa sheikh zayed'] },
  { name: 'مدينة نور', aliases: ['مدينة نور', 'مدينه نور', 'madinaty nour', 'نور'] },
  { name: 'اللوتس', aliases: ['اللوتس', 'lotus', 'el lotus'] },
];

// Supply keywords — weighted by signal strength
// HIGH weight (3pts): unambiguous offer signals
const SUPPLY_KEYWORDS_HIGH = [
  'للبيع', 'للإيجار', 'للايجار', 'للتمليك', 'لتمليك',
  'for sale', 'for rent', 'for lease',
  'من المالك', 'من المالك مباشرة', 'من المالك مباشر',
  'بيعت', 'اجرت', 'تأجير', 'تاجير',
  'selling', 'renting out', 'available for sale', 'available for rent',
];
// MEDIUM weight (2pts): strong supply context
const SUPPLY_KEYWORDS_MEDIUM = [
  'متاح', 'متوفر', 'عرض', 'فرصة', 'فرصه', 'عندي', 'معايا', 'معي',
  'available', 'offering', 'offer',
  'تشطيب', 'استلام', 'فوري', 'جاهز', 'سوبر لوكس', 'لوكس',
  'بدون اوفر', 'بدون مخالفات', 'مسجل', 'عقد',
  'تسليم', 'كاش', 'تقسيط', 'مقدم',
  'الدور', 'الطابق', 'مساحة', 'بي يو ايه', 'bua',
];
// LOW weight (1pt): weak supply signals
const SUPPLY_KEYWORDS_LOW = [
  'اعلان', 'إعلان', 'نموذج', 'كود', 'code', 'ref',
  'شقة', 'شقه', 'فيلا', 'تاون هاوس', 'ستوديو',
  'apartment', 'villa', 'studio', 'duplex', 'penthouse',
];

// Demand keywords — weighted by signal strength
// HIGH weight (3pts): unambiguous request signals
const DEMAND_KEYWORDS_HIGH = [
  'مطلوب', 'مطلوبة', 'مطلوبه',
  'ابحث عن', 'بدور على', 'بدور ع',
  'looking for', 'searching for', 'seeking',
  'محتاج شقة', 'محتاج فيلا', 'محتاج وحدة',
  'عايز اشتري', 'عايز استاجر', 'عاوز اشتري', 'عاوز استاجر',
  'want to buy', 'want to rent', 'looking to buy', 'looking to rent',
  'interested in buying', 'interested in renting',
];
// MEDIUM weight (2pts): strong demand context
const DEMAND_KEYWORDS_MEDIUM = [
  'محتاج', 'عايز', 'عاوز', 'اريد', 'أريد', 'نفسي في',
  'need', 'want', 'require', 'required',
  'ميزانية', 'budget', 'ميزانيتي',
  'عميل جاد', 'مشتري جاد', 'مستاجر جاد',
  'serious buyer', 'serious tenant',
];
// LOW weight (1pt): weak demand signals
const DEMAND_KEYWORDS_LOW = [
  'بحث', 'طلب', 'interested', 'searching',
  'اقصى', 'اقل', 'من', 'حتى',
];

// Common non-name words to filter out
const NON_NAME_WORDS = [
  'شقة', 'شقه', 'فيلا', 'للبيع', 'للايجار', 'مطلوب', 'متاح', 'عندي',
  'apartment', 'villa', 'for', 'sale', 'rent', 'looking', 'need', 'available',
  'the', 'a', 'an', 'in', 'at', 'to', 'من', 'في', 'على', 'غرف', 'غرفة',
  'متر', 'مليون', 'الف', 'جنيه', 'سعر', 'تشطيب', 'دور', 'طابق'
];

export interface ExtractedContact {
  name: string | null;
  phone: string | null;
  phoneFormatted: string | null;
  whatsappLink: string | null;
}

export interface ExtractedProperty {
  type: string | null;
  location: string | null;
  locationNormalized: string | null;
  price: number | null;
  priceFormatted: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  size: number | null;
  floor: number | null;
  purpose: 'sale' | 'rent' | null;
  features: string[];
}

export interface ParsedMessage {
  classification: 'supply' | 'demand' | 'unknown';
  confidence: number;
  language: 'ar' | 'en' | 'mixed';
  contact: ExtractedContact;
  property: ExtractedProperty;
  rawMessage: string;
}

/**
 * Convert Arabic numerals to Western numerals
 */
function arabicToWesternNumerals(text: string): string {
  const arabicNumerals = '٠١٢٣٤٥٦٧٨٩';
  const westernNumerals = '0123456789';
  let result = text;
  for (let i = 0; i < arabicNumerals.length; i++) {
    result = result.replace(new RegExp(arabicNumerals[i], 'g'), westernNumerals[i]);
  }
  return result;
}

/**
 * Clean and normalize text
 */
function cleanText(text: string): string {
  // Convert Arabic numerals
  text = arabicToWesternNumerals(text);
  // Normalize whitespace
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

/**
 * Detect language of text
 */
function detectLanguage(text: string): 'ar' | 'en' | 'mixed' {
  const arabicChars = (text.match(/[\u0600-\u06FF]/g) || []).length;
  const englishChars = (text.match(/[a-zA-Z]/g) || []).length;
  
  if (arabicChars > englishChars * 2) return 'ar';
  if (englishChars > arabicChars * 2) return 'en';
  return 'mixed';
}

/**
 * Extract Egyptian phone number
 */
export function extractPhone(text: string): string | null {
  const cleanedText = cleanText(text);
  
  for (const pattern of PHONE_PATTERNS) {
    const match = cleanedText.match(pattern);
    if (match) {
      let phone = match[0];
      // Clean phone number - remove spaces, dashes
      phone = phone.replace(/[\s\-]/g, '');
      // Convert international to local
      phone = phone.replace(/^\+20/, '0');
      // Ensure starts with 0
      if (!phone.startsWith('0') && phone.match(/^1[0125]/)) {
        phone = '0' + phone;
      }
      
      // Validate: 11 digits starting with 010/011/012/015
      if (/^(010|011|012|015)\d{8}$/.test(phone)) {
        return phone;
      }
    }
  }
  
  return null;
}

/**
 * Format phone for display
 */
export function formatPhone(phone: string | null): string | null {
  if (!phone) return null;
  // Format as 010-1234-5678
  return `${phone.slice(0, 3)}-${phone.slice(3, 7)}-${phone.slice(7)}`;
}

/**
 * Generate WhatsApp link
 */
export function generateWhatsAppLink(phone: string | null): string | null {
  if (!phone) return null;
  // Convert to international format for WhatsApp
  const intlPhone = '20' + phone.slice(1);
  return `https://wa.me/${intlPhone}`;
}

/**
 * Check if word is a common non-name word
 */
function isNonNameWord(word: string): boolean {
  const wordLower = word.toLowerCase().trim();
  // Split into individual words and check each
  const words = wordLower.split(/\s+/);
  // Only return true if ALL words are non-name words, or if the entire phrase matches
  const nonNameLower = NON_NAME_WORDS.map(w => w.toLowerCase());
  
  // Check if entire phrase is a non-name word
  if (nonNameLower.includes(wordLower)) return true;
  
  // Check if any single word is a standalone non-name word (exact match only)
  for (const w of words) {
    if (nonNameLower.includes(w) && w.length > 2) return true;
  }
  
  return false;
}

/**
 * Extract contact name from message
 */
export function extractName(text: string, phone: string | null): string | null {
  const cleanedText = cleanText(text);
  const language = detectLanguage(text);
  
  // Try Arabic patterns first if Arabic text
  if (language === 'ar' || language === 'mixed') {
    for (const pattern of NAME_PATTERNS_ARABIC) {
      const match = cleanedText.match(pattern);
      if (match) {
        let name = match[1].trim().replace(/\s+/g, ' ');
        // Validate name
        if (name.length >= 2 && name.length <= 40 && !/\d{4,}/.test(name) && !isNonNameWord(name)) {
          if (phone && name.includes(phone)) continue;
          return name;
        }
      }
    }
  }
  
  // Try English patterns
  for (const pattern of NAME_PATTERNS_ENGLISH) {
    const match = cleanedText.match(pattern);
    if (match) {
      let name = match[1].trim().replace(/\s+/g, ' ');
      if (name.length >= 2 && name.length <= 40 && !/\d{4,}/.test(name) && !isNonNameWord(name)) {
        if (phone && name.includes(phone)) continue;
        // Title case for English names
        return name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      }
    }
  }
  
  // Try to find name near phone number
  if (phone) {
    const phoneEscaped = phone.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Name before phone - more flexible pattern
    const beforePattern = new RegExp(`([\\u0600-\\u06FFA-Za-z][\\u0600-\\u06FFA-Za-z\\s]{1,29})\\s*[:\\-]?\\s*${phoneEscaped}`, 'i');
    const beforeMatch = cleanedText.match(beforePattern);
    if (beforeMatch) {
      let name = beforeMatch[1].trim().replace(/\s+/g, ' ');
      // Remove trailing non-name words
      const words = name.split(' ');
      while (words.length > 0 && isNonNameWord(words[words.length - 1])) {
        words.pop();
      }
      name = words.join(' ');
      if (name.length >= 2 && !isNonNameWord(name) && !/^\d+$/.test(name)) {
        // Title case for English names
        if (/^[A-Za-z\s]+$/.test(name)) {
          return name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
        }
        return name;
      }
    }
    
    // Name after phone
    const afterPattern = new RegExp(`${phoneEscaped}\\s*[:\\-]?\\s*([\\u0600-\\u06FFA-Za-z\\s]{2,30})`, 'i');
    const afterMatch = cleanedText.match(afterPattern);
    if (afterMatch) {
      const name = afterMatch[1].trim().replace(/\s+/g, ' ');
      if (name.length >= 2 && !isNonNameWord(name)) {
        return name;
      }
    }
  }
  
  return null;
}

/**
 * Extract property type
 */
export function extractPropertyType(text: string): string | null {
  const textLower = text.toLowerCase();
  
  for (const [type, keywords] of Object.entries(PROPERTY_TYPES)) {
    for (const keyword of keywords) {
      if (textLower.includes(keyword.toLowerCase())) {
        return type;
      }
    }
  }
  
  return 'apartment'; // Default
}

// Block codes that appear in Egyptian compound names (Madinaty B1-B15, Q1-Q2, etc.)
// These must NEVER be extracted as standalone location names.
const COMPOUND_BLOCK_CODES = new Set([
  'b1','b2','b3','b4','b5','b6','b7','b8','b9','b10','b11','b12','b13','b14','b15',
  'q1','q2','q3','a1','a2','c1','c2','c3','d1','d2','d3','d4','d5',
]);

/**
 * Extract location
 * Guards: block codes (B6, B12, Q1) are NOT locations.
 */
export function extractLocation(text: string): { raw: string | null; normalized: string | null } {
  const textLower = text.toLowerCase();
  
  // Sort by alias length descending so longer/more-specific aliases match first
  // (e.g. "التجمع الخامس" before "التجمع")
  const sortedLocations = LOCATIONS.map(loc => ({
    ...loc,
    aliases: [...loc.aliases].sort((a, b) => b.length - a.length),
  }));

  for (const loc of sortedLocations) {
    for (const alias of loc.aliases) {
      // Skip if the alias itself is a block code
      if (COMPOUND_BLOCK_CODES.has(alias.toLowerCase())) continue;
      if (textLower.includes(alias.toLowerCase())) {
        // Always return the canonical name — never the raw alias fragment
        return { raw: loc.name, normalized: loc.name };
      }
    }
  }
  
  // Try generic location patterns (last resort — only for very short clean strings)
  const locationPatterns = [
    /(?:في منطقة|area:|location:)\s*([\u0600-\u06FFa-zA-Z][\u0600-\u06FFa-zA-Z\s]{2,25})/i,
  ];
  
  for (const pattern of locationPatterns) {
    const match = text.match(pattern);
    if (match) {
      const candidate = match[1].trim();
      // Only accept if it's a clean short string (no emoji, no numbers, no asterisks)
      if (candidate.length >= 3 && candidate.length <= 30 && !/[\d\*\!\@\#\$\%\^\&\(\)\[\]\{\}]/.test(candidate)) {
        return { raw: candidate, normalized: candidate };
      }
    }
  }
  
  return { raw: null, normalized: null };
}

/**
 * Extract price
 */
export function extractPrice(text: string): number | null {
  const cleanedText = cleanText(text);
  
  const pricePatterns = [
    // Millions
    { pattern: /(\d+(?:[.,]\d+)?)\s*(?:مليون|million|m\b)/i, multiplier: 1_000_000 },
    // Thousands
    { pattern: /(\d+(?:[.,]\d+)?)\s*(?:الف|ألف|thousand|k\b)/i, multiplier: 1_000 },
    // With currency
    { pattern: /(?:السعر|سعر|price|cost)\s*[:：]?\s*(\d+(?:[.,]\d+)?)\s*(?:مليون|million|m)?/i, multiplier: null },
    // Raw large number (likely full price)
    { pattern: /(\d{6,})/, multiplier: 1 },
    // Small number likely millions
    { pattern: /(\d+(?:[.,]\d+)?)\s*(?:جنيه|egp|le|pound)/i, multiplier: null },
  ];
  
  for (const { pattern, multiplier } of pricePatterns) {
    const match = cleanedText.match(pattern);
    if (match) {
      let price = parseFloat(match[1].replace(',', '.'));
      
      if (multiplier) {
        price *= multiplier;
      } else {
        // Determine multiplier from context
        const context = match[0].toLowerCase();
        if (context.includes('مليون') || context.includes('million') || context.includes('m')) {
          price *= 1_000_000;
        } else if (context.includes('الف') || context.includes('ألف') || context.includes('thousand') || context.includes('k')) {
          price *= 1_000;
        } else if (price < 100) {
          // Small number, assume millions
          price *= 1_000_000;
        }
      }
      
      // Validate reasonable price range (10K - 500M EGP)
      if (price >= 10_000 && price <= 500_000_000) {
        return price;
      }
    }
  }
  
  return null;
}

/**
 * Format price for display
 */
export function formatPrice(price: number | null): string {
  if (!price) return 'Price negotiable';
  
  if (price >= 1_000_000) {
    const millions = price / 1_000_000;
    return `${millions.toFixed(millions % 1 === 0 ? 0 : 1)}M EGP`;
  } else if (price >= 1_000) {
    return `${Math.round(price / 1_000)}K EGP`;
  }
  return `${price.toLocaleString()} EGP`;
}

// Duration-related words that must NOT be confused with bedroom counts
const DURATION_WORDS = /(?:شهور|أشهر|اشهر|شهر|سنه|سنة|سنوات|يوم|أيام|ايام)/i;

// Block code patterns that must NOT be treated as sizes or locations
// Examples: B1, B2, B6, B12, B14, B15, Q1, Q2, A1, C3, D5 etc.
const BLOCK_CODE_PATTERN = /^[A-Z]\d{1,2}$/i;

/**
 * Check if a string is a Madinaty/compound block code (B1-B15, Q1-Q2, A1, etc.)
 * These codes must NEVER be treated as sizes or locations.
 */
function isBlockCode(str: string): boolean {
  return BLOCK_CODE_PATTERN.test(str.trim());
}

/**
 * Extract bedrooms
 * Guards against duration patterns like "6شهور" being parsed as 6 bedrooms
 */
export function extractBedrooms(text: string): number | null {
  const patterns = [
    /(\d+)\s*(?:غرف|غرفة|غرف نوم|bedroom|bedrooms|br|bed|نوم)/i,
    /(?:غرف|bedrooms|rooms)\s*[:：]?\s*(\d+)/i,
    // Arabic word forms: غرفتين (2 rooms), ثلاث غرف (3 rooms)
    /غرفتين/i,
    /ثلاث\s*(?:غرف|غرفة)/i,
    /أربع\s*(?:غرف|غرفة)/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      // Special Arabic word forms
      if (/غرفتين/i.test(match[0])) return 2;
      if (/ثلاث/i.test(match[0])) return 3;
      if (/أربع/i.test(match[0])) return 4;
      
      const numStr = match[1];
      if (!numStr) continue;
      
      // Guard: check if the number is immediately followed by a duration word
      // e.g. "6شهور" or "6 شهور" — these are NOT bedrooms
      const numIndex = match.index ?? 0;
      const afterNum = text.substring(numIndex + numStr.length, numIndex + numStr.length + 15);
      if (DURATION_WORDS.test(afterNum.trimStart())) continue;
      
      const bedrooms = parseInt(numStr);
      if (bedrooms >= 1 && bedrooms <= 10) {
        return bedrooms;
      }
    }
  }
  
  return null;
}

/**
 * Extract bathrooms
 */
export function extractBathrooms(text: string): number | null {
  const patterns = [
    /(\d+)\s*(?:حمام|حمامات|bathroom|bathrooms|bath)/i,
    /(?:حمام|bathrooms)\s*[:：]?\s*(\d+)/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const bathrooms = parseInt(match[1]);
      if (bathrooms >= 0 && bathrooms <= 10) {
        return bathrooms;
      }
    }
  }
  
  return null;
}

/**
 * Extract size in sqm
 * Rules:
 * - Valid range: 40–500m² (anything outside = null)
 * - Block codes (B6, B12, Q1) immediately before/after م/متر are NOT sizes
 */
export function extractSize(text: string): number | null {
  const patterns = [
    /(\d+)\s*(?:متر|م2|م²|sqm|m2|square|م\b)/i,
    /(?:المساحة|مساحة|area|size)\s*[:：]?\s*(\d+)/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;

    // Guard: check if the number is preceded by a block-code letter (e.g. "B6 متر" or "B12م")
    // In that case the digit is part of a block code, not a standalone size
    const matchStart = match.index ?? 0;
    const charBefore = matchStart > 0 ? text[matchStart - 1] : '';
    if (/[A-Za-z]/.test(charBefore)) continue; // e.g. "B" before "6م"

    const size = parseInt(match[1]);
    // Valid property size: 40–500m²
    if (size >= 40 && size <= 500) {
      return size;
    }
  }
  
  return null;
}

/**
 * Extract floor number
 */
export function extractFloor(text: string): number | null {
  const patterns = [
    /(?:الدور|دور|طابق|floor)\s*[:：]?\s*(\d+)/i,
    /(\d+)\s*(?:الدور|دور|طابق|floor)/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const floor = parseInt(match[1]);
      if (floor >= 0 && floor <= 50) {
        return floor;
      }
    }
  }
  
  return null;
}

/**
 * Extract purpose (sale or rent)
 */
export function extractPurpose(text: string): 'sale' | 'rent' | null {
  const textLower = text.toLowerCase();
  
  // Sale keywords: للبيع, بيع, تمليك, لتمليك, for sale, selling, sale
  const saleKeywords = ['للبيع', 'لتمليك', 'تمليك', 'بيع', 'for sale', 'selling', 'sale', 'ownership', 'ملكية'];
  // Rent keywords: للإيجار, للايجار, ايجار, إيجار, for rent, renting, rent
  const rentKeywords = ['للإيجار', 'للايجار', 'ايجار', 'إيجار', 'for rent', 'renting', 'rent', 'شهري', 'سنوي', 'ايجاري'];
  
  for (const keyword of saleKeywords) {
    if (text.includes(keyword) || textLower.includes(keyword.toLowerCase())) return 'sale';
  }
  
  for (const keyword of rentKeywords) {
    if (text.includes(keyword) || textLower.includes(keyword.toLowerCase())) return 'rent';
  }
  
  return null;
}

/**
 * Extract features/amenities
 */
export function extractFeatures(text: string): string[] {
  const features: string[] = [];
  const textLower = text.toLowerCase();
  
  const featureKeywords: Record<string, string[]> = {
    'pool': ['حمام سباحة', 'مسبح', 'pool', 'swimming'],
    'garden': ['حديقة', 'جاردن', 'garden'],
    'garage': ['جراج', 'garage', 'parking'],
    'elevator': ['اسانسير', 'مصعد', 'elevator', 'lift'],
    'security': ['امن', 'حراسة', 'security', 'guard'],
    'gym': ['جيم', 'gym', 'fitness'],
    'furnished': ['مفروش', 'furnished'],
    'semi-furnished': ['نص مفروش', 'semi furnished', 'semi-furnished'],
    'air conditioning': ['تكييف', 'ac', 'air conditioning'],
    'balcony': ['بلكونة', 'بلكونه', 'balcony', 'terrace'],
    'view': ['فيو', 'view', 'اطلالة'],
    'super lux': ['سوبر لوكس', 'super lux', 'super luxe'],
    'lux': ['لوكس', 'lux', 'luxe'],
  };
  
  for (const [feature, keywords] of Object.entries(featureKeywords)) {
    for (const keyword of keywords) {
      if (textLower.includes(keyword.toLowerCase())) {
        features.push(feature);
        break;
      }
    }
  }
  
  return features;
}

/**
 * Classify message as supply or demand using weighted multi-signal scoring.
 * Supply signals: explicit offer keywords, property details with price, "from owner" phrases.
 * Demand signals: request keywords, budget mentions, buyer/tenant intent phrases.
 * A HIGH-weight keyword (3pts) always beats multiple LOW-weight keywords (1pt each).
 * Tie-breaking: if both sides have equal score, supply wins (most messages in RE groups are listings).
 */
export function classifyMessage(text: string): { classification: 'supply' | 'demand' | 'unknown'; confidence: number } {
  const textLower = text.toLowerCase();
  
  let supplyScore = 0;
  let demandScore = 0;
  let supplyHighHit = false;
  let demandHighHit = false;

  // Score supply
  for (const kw of SUPPLY_KEYWORDS_HIGH) {
    if (textLower.includes(kw.toLowerCase())) { supplyScore += 3; supplyHighHit = true; }
  }
  for (const kw of SUPPLY_KEYWORDS_MEDIUM) {
    if (textLower.includes(kw.toLowerCase())) supplyScore += 2;
  }
  for (const kw of SUPPLY_KEYWORDS_LOW) {
    if (textLower.includes(kw.toLowerCase())) supplyScore += 1;
  }

  // Score demand
  for (const kw of DEMAND_KEYWORDS_HIGH) {
    if (textLower.includes(kw.toLowerCase())) { demandScore += 3; demandHighHit = true; }
  }
  for (const kw of DEMAND_KEYWORDS_MEDIUM) {
    if (textLower.includes(kw.toLowerCase())) demandScore += 2;
  }
  for (const kw of DEMAND_KEYWORDS_LOW) {
    if (textLower.includes(kw.toLowerCase())) demandScore += 1;
  }

  // If a HIGH-weight supply keyword exists AND no HIGH-weight demand keyword → supply
  if (supplyHighHit && !demandHighHit) {
    const conf = Math.min(0.95, 0.70 + (supplyScore - demandScore) * 0.02);
    return { classification: 'supply', confidence: conf };
  }
  // If a HIGH-weight demand keyword exists AND no HIGH-weight supply keyword → demand
  if (demandHighHit && !supplyHighHit) {
    const conf = Math.min(0.95, 0.70 + (demandScore - supplyScore) * 0.02);
    return { classification: 'demand', confidence: conf };
  }

  // Both or neither have high-weight hits — use total score
  if (supplyScore > demandScore) {
    const conf = Math.min(0.90, 0.55 + (supplyScore - demandScore) * 0.03);
    return { classification: 'supply', confidence: conf };
  }
  if (demandScore > supplyScore) {
    const conf = Math.min(0.90, 0.55 + (demandScore - supplyScore) * 0.03);
    return { classification: 'demand', confidence: conf };
  }

  // Equal scores — use structural signals
  const hasPrice = extractPrice(text) !== null;
  const hasSize = extractSize(text) !== null;
  const hasBedrooms = extractBedrooms(text) !== null;
  const hasPropertyType = extractPropertyType(text) !== null;
  
  // Property with price + size/bedrooms = supply listing
  if (hasPrice && (hasSize || hasBedrooms) && hasPropertyType) {
    return { classification: 'supply', confidence: 0.72 };
  }
  // Price alone with property type = likely supply
  if (hasPrice && hasPropertyType) {
    return { classification: 'supply', confidence: 0.62 };
  }
  // Size/bedrooms without price = ambiguous, lean supply
  if ((hasSize || hasBedrooms) && hasPropertyType) {
    return { classification: 'supply', confidence: 0.55 };
  }

  return { classification: 'unknown', confidence: 0.30 };
}

/**
 * Parse a complete WhatsApp message
 */
export function parseWhatsAppMessage(text: string): ParsedMessage {
  const cleanedText = cleanText(text);
  const language = detectLanguage(text);
  const { classification, confidence } = classifyMessage(text);
  
  const phone = extractPhone(text);
  const name = extractName(text, phone);
  const location = extractLocation(text);
  const price = extractPrice(text);
  
  return {
    classification,
    confidence,
    language,
    contact: {
      name,
      phone,
      phoneFormatted: formatPhone(phone),
      whatsappLink: generateWhatsAppLink(phone),
    },
    property: {
      type: extractPropertyType(text),
      location: location.raw,
      locationNormalized: location.normalized,
      price,
      priceFormatted: formatPrice(price),
      bedrooms: extractBedrooms(text),
      bathrooms: extractBathrooms(text),
      size: extractSize(text),
      floor: extractFloor(text),
      purpose: extractPurpose(text),
      features: extractFeatures(text),
    },
    rawMessage: cleanedText,
  };
}

/**
 * Generate human-readable match summary
 * Format: "Ahmed (01022382328) looking for apartment in Sheikh Zayed, budget 2.5M EGP 
 *          → Matched (95%) with Soaad (01098765432) selling 2-bedroom apartment for 2.3M EGP"
 */
export function generateMatchSummaryText(
  buyerName: string | null,
  buyerPhone: string | null,
  buyerPropertyType: string | null,
  buyerLocation: string | null,
  buyerBudget: number | null,
  sellerName: string | null,
  sellerPhone: string | null,
  sellerPropertyType: string | null,
  sellerLocation: string | null,
  sellerPrice: number | null,
  sellerBedrooms: number | null,
  sellerSize: number | null,
  matchScore: number
): string {
  // Buyer part
  const buyer = buyerName || 'Anonymous Buyer';
  const buyerPhoneDisplay = buyerPhone ? `(${formatPhone(buyerPhone)})` : '';
  const buyerType = buyerPropertyType || 'property';
  const buyerLoc = buyerLocation || 'any location';
  const budget = buyerBudget ? `budget ${formatPrice(buyerBudget)}` : 'flexible budget';
  
  // Seller part
  const seller = sellerName || 'Anonymous Seller';
  const sellerPhoneDisplay = sellerPhone ? `(${formatPhone(sellerPhone)})` : '';
  const bedroomText = sellerBedrooms ? `${sellerBedrooms}-bedroom ` : '';
  const sellerType = sellerPropertyType || 'property';
  const sellerLoc = sellerLocation || '';
  const priceText = formatPrice(sellerPrice);
  const sizeText = sellerSize ? ` (${sellerSize}sqm)` : '';
  
  // Build summary
  let summary = `${buyer} ${buyerPhoneDisplay} looking for ${buyerType} in ${buyerLoc}, ${budget}`;
  summary += `\n→ Matched (${Math.round(matchScore)}%) with ${seller} ${sellerPhoneDisplay}`;
  summary += ` selling ${bedroomText}${sellerType}`;
  if (sellerLoc) summary += ` in ${sellerLoc}`;
  summary += ` for ${priceText}${sizeText}`;
  
  return summary;
}

/**
 * Generate match explanation with checkmarks
 */
export function generateMatchExplanationText(
  supplyLocation: string | null,
  demandLocation: string | null,
  supplyPrice: number | null,
  demandBudget: number | null,
  supplyType: string | null,
  demandType: string | null,
  supplyBedrooms: number | null,
  demandBedrooms: number | null,
  supplySize: number | null,
  locationScore: number,
  priceScore: number,
  specsScore: number,
  totalScore: number
): string {
  const lines: string[] = [];
  
  // Location
  if (supplyLocation && demandLocation) {
    if (supplyLocation.toLowerCase() === demandLocation.toLowerCase()) {
      lines.push(`✓ Location match: Both in ${supplyLocation}`);
    } else {
      lines.push(`⚠ Location difference: ${supplyLocation} vs ${demandLocation} requested`);
    }
  } else if (supplyLocation) {
    lines.push(`✓ Location: ${supplyLocation} (buyer flexible)`);
  }
  
  // Price
  if (supplyPrice && demandBudget) {
    if (supplyPrice <= demandBudget) {
      const savings = demandBudget - supplyPrice;
      if (savings > 0) {
        lines.push(`✓ Price match: Asking ${formatPrice(supplyPrice)} fits budget of ${formatPrice(demandBudget)} (potential savings: ${formatPrice(savings)})`);
      } else {
        lines.push(`✓ Price match: Asking ${formatPrice(supplyPrice)} matches budget`);
      }
    } else {
      const over = supplyPrice - demandBudget;
      lines.push(`⚠ Price over budget: Asking ${formatPrice(supplyPrice)} exceeds budget by ${formatPrice(over)}`);
    }
  } else if (supplyPrice) {
    lines.push(`✓ Price: ${formatPrice(supplyPrice)} (buyer budget flexible)`);
  }
  
  // Property type
  if (supplyType && demandType) {
    if (supplyType.toLowerCase() === demandType.toLowerCase()) {
      lines.push(`✓ Property type: ${supplyType.charAt(0).toUpperCase() + supplyType.slice(1)} (as requested)`);
    } else {
      lines.push(`⚠ Property type: ${supplyType} vs ${demandType} requested`);
    }
  } else if (supplyType) {
    lines.push(`✓ Property type: ${supplyType.charAt(0).toUpperCase() + supplyType.slice(1)}`);
  }
  
  // Bedrooms
  if (supplyBedrooms !== null && demandBedrooms !== null) {
    if (supplyBedrooms === demandBedrooms) {
      lines.push(`✓ Bedrooms: ${supplyBedrooms} bedrooms (exact match)`);
    } else if (supplyBedrooms > demandBedrooms) {
      lines.push(`✓ Bedrooms: ${supplyBedrooms} bedrooms (${supplyBedrooms - demandBedrooms} extra)`);
    } else {
      lines.push(`⚠ Bedrooms: ${supplyBedrooms} vs ${demandBedrooms} requested`);
    }
  } else if (supplyBedrooms !== null) {
    lines.push(`✓ Bedrooms: ${supplyBedrooms} bedrooms`);
  }
  
  // Size
  if (supplySize) {
    lines.push(`✓ Size: ${supplySize}sqm - great space`);
  }
  
  // Score breakdown
  lines.push('');
  lines.push('📊 Score Breakdown:');
  lines.push(`   Location: ${Math.round(locationScore)}% (weight: 40%)`);
  lines.push(`   Price: ${Math.round(priceScore)}% (weight: 35%)`);
  lines.push(`   Specs: ${Math.round(specsScore)}% (weight: 25%)`);
  
  // Overall assessment
  lines.push('');
  if (totalScore >= 90) {
    lines.push('🎯 Excellent match - Highly recommended');
  } else if (totalScore >= 75) {
    lines.push('👍 Good match - Worth exploring');
  } else if (totalScore >= 60) {
    lines.push('🤔 Moderate match - Some compromises needed');
  } else {
    lines.push('⚠️ Weak match - Significant differences');
  }
  
  return lines.join('\n');
}
