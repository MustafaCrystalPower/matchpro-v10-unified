/**
 * MatchPro Matching Accuracy Engine
 * Phase 1: Core Foundation
 * 
 * Features:
 * - Arabic/English mixed parsing
 * - Egyptian phone number extraction (all formats)
 * - Property detail extraction (type, location, price, bedrooms)
 * - Hard sale/rent gate (no cross-matching)
 * - Realistic scoring (no fake 100% matches)
 * - Contact quality validation
 */

// ─── Arabic/English Normalization ───────────────────────────────────────────

const ARABIC_TO_ENGLISH_NUMERALS: Record<string, string> = {
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
};

const FRANCO_ARABIC_MAP: Record<string, string> = {
  '2': 'ا', '3': 'ع', '4': 'د', '5': 'س', '6': 'ط', '7': 'ق', '8': 'ب', '9': 'ع',
  'a': 'ا', 'e': 'ع', 'i': 'ي', 'o': 'و', 'u': 'و',
};

export function normalizeArabicNumerals(text: string): string {
  return text.replace(/[٠-٩]/g, (match) => ARABIC_TO_ENGLISH_NUMERALS[match] || match);
}

export function normalizeFrancoArabic(text: string): string {
  // Convert Franco Arabic (e.g., "3ayn" → "عين")
  let result = text.toLowerCase();
  for (const [franco, arabic] of Object.entries(FRANCO_ARABIC_MAP)) {
    result = result.replace(new RegExp(franco, 'g'), arabic);
  }
  return result;
}

// ─── Egyptian Phone Number Extraction ───────────────────────────────────────

const EGYPTIAN_PHONE_PATTERNS = [
  /\+20\s?10\d{8}/g,           // +20 10xxxxxxxx
  /\+20\s?1\d{9}/g,            // +20 1xxxxxxxxx
  /002\s?10\d{8}/g,            // 002 10xxxxxxxx
  /002\s?1\d{9}/g,             // 002 1xxxxxxxxx
  /010\d{8}/g,                 // 010xxxxxxxx
  /01\d{9}/g,                  // 01xxxxxxxxx
  /\+20\d{10}/g,               // +20xxxxxxxxxx
  /002\d{10}/g,                // 002xxxxxxxxxx
];

export function extractEgyptianPhones(text: string): string[] {
  const phones = new Set<string>();
  
  for (const pattern of EGYPTIAN_PHONE_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach((phone) => {
        const normalized = normalizePhoneNumber(phone);
        if (normalized) phones.add(normalized);
      });
    }
  }
  
  return Array.from(phones);
}

export function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters except leading +
  let normalized = phone.replace(/\D/g, '');
  
  // Convert to standard Egyptian format: 20XXXXXXXXXX
  if (normalized.startsWith('20')) {
    // Already in +20 format (without +)
    return normalized;
  } else if (normalized.startsWith('2')) {
    // 002 format
    return normalized;
  } else if (normalized.startsWith('1')) {
    // 01xxxxxxxxx format
    return '20' + normalized;
  } else if (normalized.length === 10) {
    // 10xxxxxxxx format
    return '20' + normalized;
  }
  
  return normalized;
}

export function isValidEgyptianPhone(phone: string): boolean {
  const normalized = normalizePhoneNumber(phone);
  return /^20(10|11|12|15)\d{8}$/.test(normalized);
}

// ─── Property Type Extraction ───────────────────────────────────────────────

const PROPERTY_TYPES = {
  apartment: ['شقة', 'apartment', 'apt', 'flat', 'شقه'],
  villa: ['فيلا', 'villa', 'vill', 'فيلة'],
  townhouse: ['تاون هاوس', 'townhouse', 'town house'],
  studio: ['ستوديو', 'studio', 'استوديو'],
  commercial: ['تجاري', 'commercial', 'محل', 'shop', 'office', 'مكتب'],
  land: ['أرض', 'land', 'ارض', 'قطعة أرض'],
  penthouse: ['بنت هاوس', 'penthouse', 'pent house'],
  duplex: ['دوبلكس', 'duplex'],
};

export function extractPropertyType(text: string): string | null {
  const lowerText = text.toLowerCase();
  const normalizedText = normalizeArabicNumerals(normalizeFrancoArabic(lowerText));
  
  for (const [type, keywords] of Object.entries(PROPERTY_TYPES)) {
    for (const keyword of keywords) {
      if (normalizedText.includes(keyword.toLowerCase())) {
        return type;
      }
    }
  }
  
  return null;
}

// ─── Purpose Extraction (Sale vs Rent) ──────────────────────────────────────

const SALE_INDICATORS = ['للبيع', 'for sale', 'sale', 'بيع', 'للبيع', 'تمليك'];
const RENT_INDICATORS = ['للإيجار', 'for rent', 'rent', 'إيجار', 'ايجار', 'للايجار', 'تأجير'];

export function extractPurpose(text: string): 'sale' | 'rent' | null {
  const lowerText = text.toLowerCase();
  const normalizedText = normalizeArabicNumerals(normalizeFrancoArabic(lowerText));
  
  // Check for sale indicators
  for (const indicator of SALE_INDICATORS) {
    if (normalizedText.includes(indicator.toLowerCase())) {
      return 'sale';
    }
  }
  
  // Check for rent indicators
  for (const indicator of RENT_INDICATORS) {
    if (normalizedText.includes(indicator.toLowerCase())) {
      return 'rent';
    }
  }
  
  return null;
}

// ─── Bedroom Extraction ─────────────────────────────────────────────────────

export function extractBedrooms(text: string): number | null {
  const normalizedText = normalizeArabicNumerals(normalizeFrancoArabic(text));
  
  // Patterns: "2BR", "2 BR", "غرفتين", "3 غرف", "ثلاث غرف", etc.
  const patterns = [
    /(\d+)\s*br(?:edroom)?s?/i,           // 2BR, 2 BR, 2 Bedrooms
    /(\d+)\s*غرف/,                        // 3 غرف
    /غرفتين/,                              // غرفتين = 2 rooms
    /غرفة واحدة/,                          // غرفة واحدة = 1 room
    /(\d+)\s*rooms?/i,                    // 2 rooms
  ];
  
  for (const pattern of patterns) {
    const match = normalizedText.match(pattern);
    if (match) {
      if (match[1]) {
        return parseInt(match[1], 10);
      } else if (pattern.source.includes('غرفتين')) {
        return 2;
      } else if (pattern.source.includes('غرفة واحدة')) {
        return 1;
      }
    }
  }
  
  return null;
}

// ─── Location Extraction ────────────────────────────────────────────────────

const EGYPTIAN_LOCATIONS = [
  // Cairo
  'التجمع', 'التجمع الخامس', 'التجمع الاول', 'مدينتي', 'الشروق', 'العبور',
  'النوفارة', 'الشيخ زايد', 'الجيزة', 'الهرم', 'المهندسين', 'الدقي', 'الدوقي',
  'المعادي', 'الزمالك', 'الجزيرة', 'حلوان', 'مصر الجديدة', 'النزهة', 'المقطم',
  'عين شمس', 'القاهرة الجديدة', 'القاهرة', 'cairo', 'new cairo', 'heliopolis',
  'maadi', 'zamalek', 'giza', 'dokki', 'mohandessin', 'agouza', 'imbaba',
  'nasr city', 'helwan', 'sheikh zayed', '6th october', 'new administrative capital',
  // Other major cities
  'الإسكندرية', 'alexandria', 'الغردقة', 'hurghada', 'شرم الشيخ', 'sharm el-sheikh',
  'أسوان', 'aswan', 'الأقصر', 'luxor', 'المنصورة', 'mansoura', 'الإسماعيلية', 'ismailia',
];

export function extractLocation(text: string): string | null {
  const lowerText = text.toLowerCase();
  const normalizedText = normalizeArabicNumerals(normalizeFrancoArabic(lowerText));
  
  for (const location of EGYPTIAN_LOCATIONS) {
    if (normalizedText.includes(location.toLowerCase())) {
      return location;
    }
  }
  
  return null;
}

// ─── Price Extraction ──────────────────────────────────────────────────────

export function extractPrice(text: string): { price: number; unit: 'EGP' | 'monthly' } | null {
  const normalizedText = normalizeArabicNumerals(text);
  
  // Pattern: number followed by optional K/M and optional currency
  const pricePattern = /(\d+(?:[.,]\d{3})*(?:[.,]\d{2})?)\s*([KkMm])?(?:\s*(?:egp|جنيه|ج\.م|jpy))?/;
  const match = normalizedText.match(pricePattern);
  
  if (match) {
    let price = parseFloat(match[1].replace(/[.,]/g, ''));
    const multiplier = match[2]?.toUpperCase();
    
    if (multiplier === 'K') price *= 1000;
    if (multiplier === 'M') price *= 1000000;
    
    // Determine if it's monthly rent or total sale price
    const isMonthly = /(?:شهر|month|monthly|\/month|\/شهر)/i.test(text);
    
    return {
      price,
      unit: isMonthly ? 'monthly' : 'EGP',
    };
  }
  
  return null;
}

// ─── Contact Quality Validation ────────────────────────────────────────────

export function isValidContactName(name: string | null | undefined): boolean {
  if (!name) return false;
  
  const trimmed = name.trim();
  
  // Reject generic/placeholder names
  const invalidNames = [
    'unknown', 'مجهول', 'اتصل', 'call', 'رقم', 'number',
    'مليون عميل جاد', 'عملاء', 'clients', 'buyer', 'seller',
  ];
  
  for (const invalid of invalidNames) {
    if (trimmed.toLowerCase().includes(invalid.toLowerCase())) {
      return false;
    }
  }
  
  // Must be at least 2 characters
  return trimmed.length >= 2;
}

// ─── Matching Score Calculation ────────────────────────────────────────────

export interface MatchScoreDetails {
  locationScore: number;
  purposeScore: number;
  priceScore: number;
  bedroomScore: number;
  contactQualityScore: number;
  totalScore: number;
  explanation: string;
}

export function calculateMatchScore(
  supply: {
    type?: string;
    purpose?: 'sale' | 'rent';
    location?: string;
    price?: number;
    priceUnit?: 'EGP' | 'monthly';
    bedrooms?: number;
    contactName?: string;
    contactPhone?: string;
  },
  demand: {
    type?: string;
    purpose?: 'sale' | 'rent';
    location?: string;
    minPrice?: number;
    maxPrice?: number;
    bedrooms?: number;
    contactName?: string;
    contactPhone?: string;
  }
): MatchScoreDetails {
  const details: MatchScoreDetails = {
    locationScore: 0,
    purposeScore: 0,
    priceScore: 0,
    bedroomScore: 0,
    contactQualityScore: 0,
    totalScore: 0,
    explanation: '',
  };
  
  const issues: string[] = [];
  
  // 1. Purpose Hard Gate (sale vs rent)
  if (supply.purpose && demand.purpose && supply.purpose !== demand.purpose) {
    details.purposeScore = 0;
    issues.push(`Purpose mismatch: supply is ${supply.purpose}, demand is ${demand.purpose}`);
  } else if (supply.purpose && demand.purpose) {
    details.purposeScore = 100;
  } else {
    details.purposeScore = 50; // Unknown purpose
  }
  
  // 2. Location Match (40% weight)
  if (supply.location && demand.location) {
    const supplyLoc = supply.location.toLowerCase();
    const demandLoc = demand.location.toLowerCase();
    
    if (supplyLoc === demandLoc) {
      details.locationScore = 100;
    } else if (supplyLoc.includes(demandLoc) || demandLoc.includes(supplyLoc)) {
      details.locationScore = 75;
    } else {
      details.locationScore = 20;
      issues.push(`Location mismatch: ${supply.location} vs ${demand.location}`);
    }
  } else {
    details.locationScore = 40; // Unknown location
  }
  
  // 3. Price Match (35% weight)
  if (supply.price && demand.minPrice && demand.maxPrice) {
    // Only compare if same unit (both monthly or both total)
    if (supply.priceUnit === "EGP" && demand.minPrice && demand.maxPrice) {
      if (supply.price >= demand.minPrice && supply.price <= demand.maxPrice) {
        details.priceScore = 100;
      } else if (supply.price >= demand.minPrice * 0.8 && supply.price <= demand.maxPrice * 1.2) {
        details.priceScore = 75;
      } else if (supply.price >= demand.minPrice * 0.5 && supply.price <= demand.maxPrice * 1.5) {
        details.priceScore = 50;
      } else {
        details.priceScore = 10;
        issues.push(`Price out of range: ${supply.price} vs ${demand.minPrice}-${demand.maxPrice}`);
      }
    } else {
      details.priceScore = 30; // Can't compare different units
      issues.push('Price unit mismatch (monthly vs total)');
    }
  } else {
    details.priceScore = 40; // Unknown price
  }
  
  // 4. Bedroom Match (25% weight)
  if (supply.bedrooms && demand.bedrooms) {
    if (supply.bedrooms === demand.bedrooms) {
      details.bedroomScore = 100;
    } else if (Math.abs(supply.bedrooms - demand.bedrooms) === 1) {
      details.bedroomScore = 75;
    } else if (Math.abs(supply.bedrooms - demand.bedrooms) <= 2) {
      details.bedroomScore = 50;
    } else {
      details.bedroomScore = 20;
      issues.push(`Bedroom mismatch: ${supply.bedrooms} vs ${demand.bedrooms}`);
    }
  } else {
    details.bedroomScore = 50; // Unknown bedrooms
  }
  
  // 5. Contact Quality (bonus/penalty)
  const supplyContactValid = isValidContactName(supply.contactName) && supply.contactPhone;
  const demandContactValid = isValidContactName(demand.contactName) && demand.contactPhone;
  
  if (supplyContactValid && demandContactValid) {
    details.contactQualityScore = 100;
  } else if (!supplyContactValid || !demandContactValid) {
    details.contactQualityScore = 0;
    issues.push('Invalid contact information');
  }
  
  // Calculate weighted total
  if (details.purposeScore === 0) {
    // Hard gate: if purpose doesn't match, score is 0
    details.totalScore = 0;
    details.explanation = 'REJECTED: Purpose mismatch (sale vs rent)';
  } else if (details.contactQualityScore === 0) {
    // Hard gate: invalid contacts
    details.totalScore = 0;
    details.explanation = 'REJECTED: Invalid contact information';
  } else {
    details.totalScore = Math.round(
      details.locationScore * 0.40 +
      details.priceScore * 0.35 +
      details.bedroomScore * 0.25
    );
    
    if (issues.length === 0) {
      details.explanation = `MATCH: Perfect alignment on location, price, and bedrooms`;
    } else {
      details.explanation = `MATCH (${details.totalScore}%): ${issues.join('; ')}`;
    }
  }
  
  return details;
}

// ─── Batch Processing ──────────────────────────────────────────────────────

export interface ExtractedMessage {
  type?: string;
  purpose?: 'sale' | 'rent';
  location?: string;
  price?: number;
  priceUnit?: 'EGP' | 'monthly';
  bedrooms?: number;
  phones: string[];
  contactName?: string;
  confidence: number;
  issues: string[];
}

export function extractMessageDetails(text: string, contactName?: string): ExtractedMessage {
  const issues: string[] = [];
  const phones = extractEgyptianPhones(text);
  
  if (phones.length === 0) {
    issues.push('No Egyptian phone numbers found');
  }
  
  const type = extractPropertyType(text);
  const purpose = extractPurpose(text);
  const location = extractLocation(text);
  const priceData = extractPrice(text);
  const bedrooms = extractBedrooms(text);
  
  let confidence = 0;
  
  // Calculate confidence based on extracted fields
  if (type) confidence += 20;
  if (purpose) confidence += 25;
  if (location) confidence += 20;
  if (priceData) confidence += 20;
  if (bedrooms) confidence += 15;
  
  if (!isValidContactName(contactName || null)) {
    issues.push('Invalid or missing contact name');
    confidence -= 10;
  }
  
  confidence = Math.max(0, Math.min(100, confidence));
  
  return {
    type: type || undefined,
    purpose: purpose || undefined,
    location: location || undefined,
    price: priceData?.price,
    priceUnit: priceData?.unit,
    bedrooms: bedrooms || undefined,
    phones,
    contactName: contactName || undefined,
    confidence,
    issues,
  };
}
