import { invokeLLM } from "./_core/llm";

// Cairo/Egypt location keywords for fallback matching
const CAIRO_LOCATIONS = [
  'التجمع', 'التجمع الخامس', 'التجمع الاول', 'الشيخ زايد', 'المعادي', 'مدينة نصر',
  'الرحاب', 'هليوبوليس', 'المنيل', 'الزمالك', 'مصر الجديدة', 'العبور',
  'القاهرة الجديدة', '6 اكتوبر', 'الساحل الشمالي', 'العين السخنة', 'المقطم',
  'حدائق الاهرام', 'الشروق', 'بدر', 'العاشر من رمضان', 'المستقبل', 'العاصمة الادارية',
  'new cairo', 'sheikh zayed', 'maadi', 'nasr city', 'rehab', 'heliopolis',
  'zamalek', 'october', '5th settlement', '6th october', 'north coast', 'ain sokhna',
  'mokattam', 'shorouk', 'badr', '10th of ramadan', 'new capital', 'tagamoa'
];

// Property type mappings
const PROPERTY_TYPES: Record<string, string> = {
  'شقة': 'apartment', 'شقه': 'apartment', 'apartment': 'apartment', 'flat': 'apartment',
  'فيلا': 'villa', 'villa': 'villa',
  'دوبلكس': 'duplex', 'duplex': 'duplex',
  'استوديو': 'studio', 'studio': 'studio',
  'بنتهاوس': 'penthouse', 'penthouse': 'penthouse',
  'أرض': 'land', 'ارض': 'land', 'land': 'land',
  'محل': 'shop', 'shop': 'shop', 'store': 'shop',
  'مكتب': 'office', 'office': 'office',
  'عمارة': 'building', 'building': 'building',
  'شاليه': 'chalet', 'chalet': 'chalet',
  'تاون هاوس': 'townhouse', 'townhouse': 'townhouse',
  'توين هاوس': 'twin house', 'twin house': 'twin house'
};

// Supply/Demand keywords for fallback
const SUPPLY_KEYWORDS = ['للبيع', 'للإيجار', 'للايجار', 'متاح', 'متوفر', 'عرض', 'اعلان', 'for sale', 'for rent', 'available', 'offering', 'selling'];
const DEMAND_KEYWORDS = ['مطلوب', 'ابحث عن', 'ابحث', 'محتاج', 'عايز', 'بدور على', 'اريد', 'looking for', 'need', 'want', 'searching', 'required', 'seeking'];

export interface ParsedRealEstateData {
  classification: 'supply' | 'demand' | 'unknown';
  language: 'ar' | 'en' | 'mixed';
  propertyType: string | null;
  location: string | null;
  area: string | null;
  city: string;
  price: number | null;
  priceMin: number | null;
  priceMax: number | null;
  priceUnit: 'total' | 'per_sqm' | 'per_month';
  priceType: 'cash' | 'installment' | 'both' | null;
  cashPrice: number | null;
  downPayment: number | null;
  installmentAmount: number | null;
  installmentYears: number | null;
  size: number | null;
  sizeMin: number | null;
  sizeMax: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  floor: number | null;
  purpose: 'sale' | 'rent' | null;
  contact: string | null;
  contactName: string | null;
  features: string[];
  confidence: number;
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
 * Extract phone numbers from text (Egyptian mobile: 010, 011, 012, 015)
 */
function extractPhoneNumber(text: string): string | null {
  const patterns = [
    /(\+?2?0?1[0125][0-9]{8})/,
    /(01[0125][0-9]{8})/,
    /(\+20\s?1[0125]\s?\d{4}\s?\d{4})/
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      let phone = match[1].replace(/\s/g, '');
      // Normalize to 01XXXXXXXXX format
      phone = phone.replace(/^\+?20/, '0');
      if (!phone.startsWith('0')) phone = '0' + phone;
      return phone;
    }
  }
  return null;
}

/**
 * Extract contact name from Arabic/English messages
 */
function extractContactName(text: string, phone: string | null): string | null {
  // Common Arabic name patterns
  const arabicNamePatterns = [
    /(?:اسمي|انا|معاك|معاكم|سلام\s+عليكم\s+انا)\s+([\u0600-\u06FF\s]{2,30})/i,
    /^([\u0600-\u06FF]+(?:\s+[\u0600-\u06FF]+)?)\s+(?:01|\+20)/,  // Name before phone
    /([\u0600-\u06FF]+(?:\s+[\u0600-\u06FF]+)?)\s+(?:عندي|معايا|للبيع|للايجار)/i
  ];
  
  // Common English name patterns
  const englishNamePatterns = [
    /(?:my name is|i am|i'm|this is|hi i'm|hello i'm)\s+([A-Za-z\s]{2,30})/i,
    /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:01|\+20)/,  // Capitalized name before phone
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:selling|renting|looking|need)/i
  ];
  
  // Try Arabic patterns first
  for (const pattern of arabicNamePatterns) {
    const match = text.match(pattern);
    if (match) {
      const name = match[1].trim().replace(/\s+/g, ' ');
      // Validate: not too short, not numbers, not common words
      if (name.length >= 2 && !/\d/.test(name) && !isCommonWord(name)) {
        return name;
      }
    }
  }
  
  // Try English patterns
  for (const pattern of englishNamePatterns) {
    const match = text.match(pattern);
    if (match) {
      const name = match[1].trim().replace(/\s+/g, ' ');
      if (name.length >= 2 && !/\d/.test(name) && !isCommonWord(name)) {
        return name;
      }
    }
  }
  
  // Try to extract name near phone number
  if (phone) {
    const phoneEscaped = phone.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const nearPhonePattern = new RegExp(`([\\u0600-\\u06FFA-Za-z\\s]{2,25})\\s*${phoneEscaped}`, 'i');
    const match = text.match(nearPhonePattern);
    if (match) {
      const name = match[1].trim().replace(/\s+/g, ' ');
      if (name.length >= 2 && !/\d/.test(name) && !isCommonWord(name)) {
        return name;
      }
    }
  }
  
  return null;
}

/**
 * Check if a word is a common non-name word
 */
function isCommonWord(word: string): boolean {
  const commonWords = [
    'شقة', 'شقه', 'فيلا', 'للبيع', 'للايجار', 'مطلوب', 'متاح', 'عندي',
    'apartment', 'villa', 'for', 'sale', 'rent', 'looking', 'need', 'available',
    'the', 'a', 'an', 'in', 'at', 'to', 'من', 'في', 'على'
  ];
  return commonWords.some(w => word.toLowerCase().includes(w.toLowerCase()));
}

/**
 * Fallback regex-based parser for when LLM is unavailable
 */
function fallbackParse(text: string): ParsedRealEstateData {
  const textLower = text.toLowerCase();
  const language = detectLanguage(text);
  
  // Classification
  const isSupply = SUPPLY_KEYWORDS.some(k => textLower.includes(k.toLowerCase()));
  const isDemand = DEMAND_KEYWORDS.some(k => textLower.includes(k.toLowerCase()));
  const classification = isDemand ? 'demand' : (isSupply ? 'supply' : 'unknown');
  
  // Property type
  let propertyType: string | null = null;
  for (const [key, value] of Object.entries(PROPERTY_TYPES)) {
    if (textLower.includes(key.toLowerCase())) {
      propertyType = value;
      break;
    }
  }
  
  // Location
  let location: string | null = null;
  for (const loc of CAIRO_LOCATIONS) {
    if (textLower.includes(loc.toLowerCase())) {
      location = loc;
      break;
    }
  }
  
  // Price extraction
  let price: number | null = null;
  const pricePatterns = [
    /(\d+(?:[,.]?\d+)?)\s*(مليون|million|m)/i,
    /(\d+(?:[,.]?\d+)?)\s*(الف|ألف|thousand|k)/i,
    /(\d+(?:[,.]?\d+)?)\s*(جنيه|egp|le|pound)/i
  ];
  
  for (const pattern of pricePatterns) {
    const match = text.match(pattern);
    if (match) {
      let num = parseFloat(match[1].replace(',', '.'));
      const unit = match[2].toLowerCase();
      if (unit.includes('مليون') || unit.includes('million') || unit === 'm') {
        num *= 1000000;
      } else if (unit.includes('الف') || unit.includes('ألف') || unit.includes('thousand') || unit === 'k') {
        num *= 1000;
      }
      price = num;
      break;
    }
  }
  
  // Size extraction
  let size: number | null = null;
  const sizeMatch = text.match(/(\d+)\s*(متر|م|sqm|m2|square|م²)/i);
  if (sizeMatch) {
    size = parseInt(sizeMatch[1]);
  }
  
  // Bedrooms
  let bedrooms: number | null = null;
  const bedroomMatch = text.match(/(\d+)\s*(غرف|غرفة|bedroom|bed|br|نوم)/i);
  if (bedroomMatch) {
    bedrooms = parseInt(bedroomMatch[1]);
  }
  
  // Purpose — includes لتمليك/تمليك (ownership/sale) and شهري/سنوي (monthly/yearly = rent)
  let purpose: 'sale' | 'rent' | null = null;
  const saleWords = ['للبيع', 'لتمليك', 'تمليك', 'بيع', 'for sale', 'selling', 'sale', 'ownership'];
  const rentWords = ['للإيجار', 'للايجار', 'ايجار', 'إيجار', 'for rent', 'renting', 'rent', 'شهري', 'سنوي', 'ايجاري'];
  if (saleWords.some(w => text.includes(w) || textLower.includes(w.toLowerCase()))) {
    purpose = 'sale';
  } else if (rentWords.some(w => text.includes(w) || textLower.includes(w.toLowerCase()))) {
    purpose = 'rent';
  }
  
  // Contact
  const contact = extractPhoneNumber(text);
  const contactName = extractContactName(text, contact);
  
  return {
    classification,
    language,
    propertyType,
    location,
    area: location,
    city: 'Cairo',
    price: classification === 'supply' ? price : null,
    priceMin: classification === 'demand' ? price : null,
    priceMax: classification === 'demand' ? price : null,
    priceUnit: purpose === 'rent' ? 'per_month' : 'total',
    priceType: null,
    cashPrice: null,
    downPayment: null,
    installmentAmount: null,
    installmentYears: null,
    size: classification === 'supply' ? size : null,
    sizeMin: classification === 'demand' ? size : null,
    sizeMax: classification === 'demand' ? size : null,
    bedrooms,
    bathrooms: null,
    floor: null,
    purpose,
    contact,
    contactName,
    features: [],
    confidence: classification !== 'unknown' ? 0.6 : 0.3
  };
}

/**
 * Parse real estate message using LLM for high accuracy
 */
export async function parseRealEstateMessage(text: string): Promise<ParsedRealEstateData> {
  const language = detectLanguage(text);
  
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are an expert real estate message parser for the Egyptian market. Extract structured data from Arabic and English WhatsApp messages about properties.

IMPORTANT RULES:
1. Classify as "supply" if someone is OFFERING/SELLING/RENTING OUT a property
2. Classify as "demand" if someone is LOOKING FOR/WANTING/SEEKING a property
3. Classify as "unknown" if the message is not about real estate
4. CRITICAL: If message contains ONLY a person's name without property details, classify as "unknown" - NOT demand
5. Extract all available property details accurately
6. Normalize locations to standard names (e.g., "5th settlement" = "التجمع الخامس")
7. Convert all prices to EGP (Egyptian Pounds)
8. For demand messages, extract price ranges if mentioned (min/max)
9. Confidence should be 0.0-1.0 based on how clear the message is

Common Egyptian locations: التجمع الخامس, الشيخ زايد, المعادي, مدينة نصر, الرحاب, هليوبوليس, الزمالك, مصر الجديدة, 6 اكتوبر, الساحل الشمالي, العاصمة الادارية, العين السخنة

Property types: apartment/شقة, villa/فيلا, duplex/دوبلكس, studio/استوديو, penthouse/بنتهاوس, land/أرض, shop/محل, office/مكتب, chalet/شاليه, townhouse/تاون هاوس`
        },
        {
          role: "user",
          content: `Parse this real estate message:\n\n"${text}"`
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "real_estate_data",
          strict: true,
          schema: {
            type: "object",
            properties: {
              classification: { type: "string", enum: ["supply", "demand", "unknown"], description: "Message type" },
              propertyType: { type: ["string", "null"], description: "Type of property in English" },
              location: { type: ["string", "null"], description: "Specific area/neighborhood" },
              area: { type: ["string", "null"], description: "Broader area name" },
              city: { type: "string", description: "City name, default Cairo" },
              price: { type: ["number", "null"], description: "Price in EGP for supply" },
              priceMin: { type: ["number", "null"], description: "Min budget for demand" },
              priceMax: { type: ["number", "null"], description: "Max budget for demand" },
              priceUnit: { type: "string", enum: ["total", "per_sqm", "per_month"], description: "Price unit" },
              priceType: { type: ["string", "null"], enum: ["cash", "installment", "both", null], description: "Payment type: cash, installment, or both" },
              cashPrice: { type: ["number", "null"], description: "Cash asking price in EGP" },
              downPayment: { type: ["number", "null"], description: "Down payment for installment in EGP" },
              installmentAmount: { type: ["number", "null"], description: "Monthly or annual installment amount in EGP" },
              installmentYears: { type: ["integer", "null"], description: "Number of years for installment plan" },
              size: { type: ["integer", "null"], description: "Size in sqm for supply" },
              sizeMin: { type: ["integer", "null"], description: "Min size for demand" },
              sizeMax: { type: ["integer", "null"], description: "Max size for demand" },
              bedrooms: { type: ["integer", "null"], description: "Number of bedrooms" },
              bathrooms: { type: ["integer", "null"], description: "Number of bathrooms" },
              floor: { type: ["integer", "null"], description: "Floor number" },
              purpose: { type: ["string", "null"], enum: ["sale", "rent", null], description: "Sale or rent" },
              contact: { type: ["string", "null"], description: "Phone number" },
              contactName: { type: ["string", "null"], description: "Contact person name" },
              features: { type: "array", items: { type: "string" }, description: "Property features" },
              confidence: { type: "number", description: "Extraction confidence 0-1" }
            },
            required: ["classification", "propertyType", "location", "area", "city", "price", "priceMin", "priceMax", "priceUnit", "priceType", "cashPrice", "downPayment", "installmentAmount", "installmentYears", "size", "sizeMin", "sizeMax", "bedrooms", "bathrooms", "floor", "purpose", "contact", "contactName", "features", "confidence"],
            additionalProperties: false
          }
        }
      }
    });

    const messageContent = response.choices[0]?.message?.content;
    if (!messageContent) {
      console.warn("[NLP] Empty LLM response, using fallback");
      return fallbackParse(text);
    }

    const contentStr = typeof messageContent === 'string' ? messageContent : JSON.stringify(messageContent);
    const parsed = JSON.parse(contentStr);
    
    // Add language detection
    return {
      ...parsed,
      language
    };
  } catch (error) {
    console.error("[NLP] LLM parsing failed, using fallback:", error);
    return fallbackParse(text);
  }
}

/**
 * Batch parse multiple messages
 */
export async function parseMultipleMessages(texts: string[]): Promise<ParsedRealEstateData[]> {
  const results: ParsedRealEstateData[] = [];
  
  for (const text of texts) {
    const parsed = await parseRealEstateMessage(text);
    results.push(parsed);
  }
  
  return results;
}

/**
 * Quick classification without full parsing
 */
export function quickClassify(text: string): 'supply' | 'demand' | 'unknown' {
  const textLower = text.toLowerCase();
  
  const isDemand = DEMAND_KEYWORDS.some(k => textLower.includes(k.toLowerCase()));
  if (isDemand) return 'demand';
  
  const isSupply = SUPPLY_KEYWORDS.some(k => textLower.includes(k.toLowerCase()));
  if (isSupply) return 'supply';
  
  return 'unknown';
}
