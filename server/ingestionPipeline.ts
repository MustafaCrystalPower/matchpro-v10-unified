/**
 * MatchPro Auto-Ingestion Pipeline v2
 * 
 * Full 12-step pipeline:
 * 1. Raw message received
 * 2. Language detection
 * 3. Spam/irrelevant filter
 * 4. LLM classification (supply/demand/unknown)
 * 5. Structured data extraction
 * 6. Field normalization
 * 7. Confidence scoring
 * 8. Priority assignment
 * 9. Review routing (auto-approve vs pending)
 * 10. Record creation (supply or demand)
 * 11. Matching engine trigger
 * 12. WebSocket broadcast
 */

import { invokeLLM } from "./_core/llm";
import { insertSupply, insertDemand } from "./db";
import { findMatchesForSupply, findMatchesForDemand } from "./matchingEngine";
import { classifyBuyerIntent } from "./buyerIntentClassifier";

// ─── Constants ────────────────────────────────────────────────────────────────

const SPAM_PATTERNS = [
  /^(ok|okay|تمام|تمم|👍|🙏|شكرا|thanks|thank you|جزاكم|بارك الله|ماشي|ع|ع رسلك)/i,
  /^[^\w\u0600-\u06FF]+$/, // non-word, non-Arabic only (emoji/symbol messages)
  /^(صباح الخير|مساء الخير|good morning|good evening|السلام عليكم|وعليكم السلام)/i,
];

const MIN_MESSAGE_LENGTH = 15;

const LOCATION_CANONICAL: Record<string, string> = {
  'تجمع': 'التجمع الخامس', 'التجمع': 'التجمع الخامس', '5th settlement': 'التجمع الخامس',
  'fifth settlement': 'التجمع الخامس', 'tagamoa': 'التجمع الخامس',
  'زايد': 'الشيخ زايد', 'sheikh zayed': 'الشيخ زايد',
  'معادي': 'المعادي', 'maadi': 'المعادي',
  'نصر': 'مدينة نصر', 'nasr city': 'مدينة نصر', 'nasr': 'مدينة نصر',
  'رحاب': 'الرحاب', 'rehab': 'الرحاب',
  'هليوبوليس': 'هليوبوليس', 'heliopolis': 'هليوبوليس', 'مصر الجديدة': 'مصر الجديدة',
  'زمالك': 'الزمالك', 'zamalek': 'الزمالك',
  'اكتوبر': '6 أكتوبر', 'october': '6 أكتوبر', '6th october': '6 أكتوبر',
  'ساحل': 'الساحل الشمالي', 'north coast': 'الساحل الشمالي', 'sahel': 'الساحل الشمالي',
  'سخنة': 'العين السخنة', 'ain sokhna': 'العين السخنة', 'sokhna': 'العين السخنة',
  'عاصمة': 'العاصمة الإدارية', 'new capital': 'العاصمة الإدارية', 'capital': 'العاصمة الإدارية',
  'شروق': 'الشروق', 'shorouk': 'الشروق',
  'بدر': 'مدينة بدر', 'badr': 'مدينة بدر',
  'عبور': 'العبور', 'obour': 'العبور',
  'مقطم': 'المقطم', 'mokattam': 'المقطم',
  'مستقبل': 'مدينة المستقبل', 'mostakbal': 'مدينة المستقبل',
  'قاهرة الجديدة': 'القاهرة الجديدة', 'new cairo': 'القاهرة الجديدة',
  'حدائق': 'حدائق الأهرام', 'hadayek': 'حدائق الأهرام',
  'منيل': 'المنيل', 'manil': 'المنيل',
};

const PROPERTY_TYPE_CANONICAL: Record<string, string> = {
  'شقة': 'apartment', 'شقه': 'apartment', 'apartment': 'apartment', 'flat': 'apartment',
  'فيلا': 'villa', 'villa': 'villa', 'فيلل': 'villa',
  'دوبلكس': 'duplex', 'duplex': 'duplex', 'دبلوكس': 'duplex',
  'استوديو': 'studio', 'studio': 'studio',
  'بنتهاوس': 'penthouse', 'penthouse': 'penthouse', 'بنت هاوس': 'penthouse',
  'أرض': 'land', 'ارض': 'land', 'land': 'land', 'قطعة': 'land',
  'محل': 'shop', 'shop': 'shop', 'store': 'shop', 'محلات': 'shop',
  'مكتب': 'office', 'office': 'office', 'مكاتب': 'office',
  'عمارة': 'building', 'building': 'building', 'عقار': 'building',
  'شاليه': 'chalet', 'chalet': 'chalet',
  'تاون هاوس': 'townhouse', 'townhouse': 'townhouse', 'تاون': 'townhouse',
  'توين هاوس': 'twin house', 'twin house': 'twin house', 'توين': 'twin house',
  'روف': 'roof', 'roof': 'roof', 'روف توب': 'roof',
};

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface IngestionInput {
  messageText: string;
  messageId: string;
  chatId: string;
  groupName: string;
  sender: string;
  senderName: string;
  msgDbId: number;
}

export interface IngestionResult {
  classification: 'supply' | 'demand' | 'unknown' | 'spam';
  recordId: number | null;
  matchCount: number;
  confidence: number;
  priority: 'high' | 'medium' | 'low';
  reviewStatus: 'auto_approved' | 'pending_review';
  extractedData: ExtractedPropertyData | null;
  processingTimeMs: number;
}

export interface ExtractedPropertyData {
  classification: 'supply' | 'demand' | 'unknown';
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
  contact: string;
  contactName: string;
  features: string[];
  language: 'ar' | 'en' | 'mixed';
  confidence: number;
  rawNotes: string | null;
}

// ─── Step 1: Spam Detection ────────────────────────────────────────────────────

export function isSpamMessage(text: string): boolean {
  if (text.trim().length < MIN_MESSAGE_LENGTH) return true;
  return SPAM_PATTERNS.some(p => p.test(text.trim()));
}

// ─── Step 2: Language Detection ───────────────────────────────────────────────

export function detectLanguage(text: string): 'ar' | 'en' | 'mixed' {
  const arabicChars = (text.match(/[\u0600-\u06FF]/g) || []).length;
  const englishChars = (text.match(/[a-zA-Z]/g) || []).length;
  if (arabicChars > englishChars * 2) return 'ar';
  if (englishChars > arabicChars * 2) return 'en';
  return 'mixed';
}

// ─── Step 3: Phone Extraction ─────────────────────────────────────────────────

export function extractPhone(text: string): string | null {
  const patterns = [
    /(\+?2?0?1[0125][0-9]{8})/,
    /(01[0125][0-9]{8})/,
    /(\+20\s?1[0125]\s?\d{4}\s?\d{4})/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      let phone = m[1].replace(/\s/g, '');
      phone = phone.replace(/^\+?20/, '0');
      if (!phone.startsWith('0')) phone = '0' + phone;
      return phone;
    }
  }
  return null;
}

// ─── Step 4: Field Normalization ──────────────────────────────────────────────

export function normalizeLocation(raw: string | null): string | null {
  if (!raw) return null;
  const lower = raw.toLowerCase().trim();
  for (const [key, canonical] of Object.entries(LOCATION_CANONICAL)) {
    if (lower.includes(key.toLowerCase())) return canonical;
  }
  // Return as-is if no canonical match (still useful)
  return raw.trim();
}

export function normalizePropertyType(raw: string | null): string | null {
  if (!raw) return null;
  const lower = raw.toLowerCase().trim();
  for (const [key, canonical] of Object.entries(PROPERTY_TYPE_CANONICAL)) {
    if (lower.includes(key.toLowerCase())) return canonical;
  }
  return raw.toLowerCase().trim();
}

// ─── Step 5: Priority Scoring ─────────────────────────────────────────────────

export function calculatePriority(
  confidence: number,
  hasPrice: boolean,
  hasLocation: boolean,
  hasContact: boolean,
  hasPropertyType: boolean
): 'high' | 'medium' | 'low' {
  let score = 0;
  if (confidence >= 0.8) score += 3;
  else if (confidence >= 0.6) score += 2;
  else score += 1;
  
  if (hasPrice) score += 2;
  if (hasLocation) score += 2;
  if (hasContact) score += 2;
  if (hasPropertyType) score += 1;
  
  if (score >= 8) return 'high';
  if (score >= 5) return 'medium';
  return 'low';
}

// ─── Step 6: Review Routing ───────────────────────────────────────────────────

export function determineReviewStatus(
  confidence: number,
  hasContact: boolean
): 'auto_approved' | 'pending_review' {
  // Auto-approve: high confidence + has contact
  if (confidence >= 0.7 && hasContact) return 'auto_approved';
  // Pending review: low confidence or missing contact
  return 'pending_review';
}

// ─── Step 7: LLM Extraction ───────────────────────────────────────────────────

export async function extractWithLLM(
  text: string,
  senderPhone: string,
  senderName: string
): Promise<ExtractedPropertyData> {
  const language = detectLanguage(text);
  
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are an expert real estate data extractor for the Egyptian market. Extract structured property data from Arabic/English WhatsApp messages.

CLASSIFICATION RULES:
- "supply": someone OFFERING/SELLING/RENTING OUT a property
  Arabic supply signals: للبيع للايجار للإيجار متاح متوفر عندي عندنا معايا لدي عرض موجود يوجد لتمليك لتأجير بيع وحدة وحدات
  English supply signals: for sale, for rent, available, offering, selling, renting out, to let, to sell, for lease, listed, listing
- "demand": someone LOOKING FOR/WANTING a property (buyer or broker with a client)
  Arabic demand signals: مطلوب ابحث بحث بدور بدوّر محتاج عايز اريد نريد عاجل ميزانية عميل عميلي طلب عميل عندي عميل عايز يشتري
  English demand signals: looking for, need, want, searching, required, seeking, wanted, request, my client, client needs, buyer looking, interested in
- "unknown": not real estate related

IMPORTANT: If a broker says 'my client wants' or 'عميلي عايز' or 'عندي عميل' → that is DEMAND.
If someone says 'عندي شقة' or 'I have a property' → that is SUPPLY.

EXTRACTION RULES:
- Extract ALL numeric values (price, size, bedrooms, bathrooms, floor)
- For prices: convert to EGP (1M = 1,000,000 / 1K = 1,000)
- For demand: extract price RANGE (min/max) if mentioned
- Normalize locations to standard Egyptian area names
- purpose: "sale" for ownership/تمليك, "rent" for rental/ايجار
- confidence: 0.0-1.0 based on message clarity and completeness
- contact: use the sender's WhatsApp number as primary (provided below)
- Extract features as array: ["furnished", "pool", "parking", "balcony", "garden", "elevator", "security", "gym", "ac", "sea_view", "compound"]

Sender WhatsApp: ${senderPhone}
Sender Name: ${senderName || senderPhone}`
        },
        {
          role: "user",
          content: `Extract real estate data from this message:\n\n"${text}"`
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "property_extraction",
          strict: true,
          schema: {
            type: "object",
            properties: {
              classification: { type: "string", enum: ["supply", "demand", "unknown"] },
              propertyType: { type: ["string", "null"] },
              location: { type: ["string", "null"] },
              area: { type: ["string", "null"] },
              city: { type: "string" },
              price: { type: ["number", "null"] },
              priceMin: { type: ["number", "null"] },
              priceMax: { type: ["number", "null"] },
              priceUnit: { type: "string", enum: ["total", "per_sqm", "per_month"] },
              size: { type: ["number", "null"] },
              sizeMin: { type: ["number", "null"] },
              sizeMax: { type: ["number", "null"] },
              bedrooms: { type: ["number", "null"] },
              bathrooms: { type: ["number", "null"] },
              floor: { type: ["number", "null"] },
              purpose: { type: ["string", "null"], enum: ["sale", "rent", null] },
              contactPhone: { type: ["string", "null"] },
              contactName: { type: ["string", "null"] },
              features: { type: "array", items: { type: "string" } },
              confidence: { type: "number" },
              rawNotes: { type: ["string", "null"] }
            },
            required: ["classification", "propertyType", "location", "area", "city", "price", "priceMin", "priceMax", "priceUnit", "size", "sizeMin", "sizeMax", "bedrooms", "bathrooms", "floor", "purpose", "contactPhone", "contactName", "features", "confidence", "rawNotes"],
            additionalProperties: false
          }
        }
      }
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty LLM response");
    
    const parsed = typeof content === 'string' ? JSON.parse(content) : content;
    
    // Normalize extracted data
    const normalizedLocation = normalizeLocation(parsed.location);
    const normalizedType = normalizePropertyType(parsed.propertyType);
    
    // Contact resolution: WhatsApp sender is always primary
    const finalContact = senderPhone || parsed.contactPhone || 'Unknown';
    const finalName = (senderName && senderName !== 'Unknown' && senderName.trim().length >= 2)
      ? senderName
      : (parsed.contactName || senderPhone);
    
    // Guard against invalid bedroom counts (compound codes like B8, B12)
    const rawBedrooms = parsed.bedrooms;
    const finalBedrooms = (rawBedrooms !== null && rawBedrooms > 10) ? null : rawBedrooms;
    
    return {
      classification: parsed.classification || 'unknown',
      propertyType: normalizedType,
      location: normalizedLocation,
      area: parsed.area || normalizedLocation,
      city: parsed.city || 'Cairo',
      price: parsed.price,
      priceMin: parsed.priceMin,
      priceMax: parsed.priceMax,
      priceUnit: parsed.priceUnit || 'total',
      priceType: (parsed as any).priceType || null,
      cashPrice: (parsed as any).cashPrice || null,
      downPayment: (parsed as any).downPayment || null,
      installmentAmount: (parsed as any).installmentAmount || null,
      installmentYears: (parsed as any).installmentYears || null,
      size: parsed.size,
      sizeMin: parsed.sizeMin,
      sizeMax: parsed.sizeMax,
      bedrooms: finalBedrooms,
      bathrooms: parsed.bathrooms,
      floor: parsed.floor,
      purpose: parsed.purpose,
      contact: finalContact,
      contactName: finalName,
      features: Array.isArray(parsed.features) ? parsed.features : [],
      language,
      confidence: Math.min(1, Math.max(0, parsed.confidence || 0.5)),
      rawNotes: parsed.rawNotes,
    };
  } catch (err) {
    console.error("[Ingestion] LLM extraction failed, using fallback:", err);
    return fallbackExtract(text, senderPhone, senderName, language);
  }
}

// ─── Fallback Extraction (no LLM) ─────────────────────────────────────────────

function fallbackExtract(
  text: string,
  senderPhone: string,
  senderName: string,
  language: 'ar' | 'en' | 'mixed'
): ExtractedPropertyData {
  const textLower = text.toLowerCase();
  
  // Classification
  const supplyKw = ['للبيع', 'للإيجار', 'للايجار', 'متاح', 'متوفر', 'عرض', 'for sale', 'for rent', 'available', 'offering'];
  const demandKw = ['مطلوب', 'ابحث', 'محتاج', 'عايز', 'بدور', 'اريد', 'looking for', 'need', 'want', 'searching', 'required'];
  
  const isSupply = supplyKw.some(k => textLower.includes(k));
  const isDemand = demandKw.some(k => textLower.includes(k));
  
  // Property type
  let propertyType: string | null = null;
  for (const [key, val] of Object.entries(PROPERTY_TYPE_CANONICAL)) {
    if (textLower.includes(key.toLowerCase())) { propertyType = val; break; }
  }
  
  // Location
  let location: string | null = null;
  const allLocations = Object.values(LOCATION_CANONICAL);
  for (const loc of allLocations) {
    if (textLower.includes(loc.toLowerCase())) { location = loc; break; }
  }
  if (!location) {
    for (const [key, canonical] of Object.entries(LOCATION_CANONICAL)) {
      if (textLower.includes(key.toLowerCase())) { location = canonical; break; }
    }
  }
  
  // Price
  let price: number | null = null;
  const pricePatterns = [
    /(\d+(?:[,.]?\d+)?)\s*(مليون|million|m\b)/i,
    /(\d+(?:[,.]?\d+)?)\s*(الف|ألف|thousand|k\b)/i,
    /(\d+(?:[,.]?\d+)?)\s*(جنيه|egp|le\b)/i,
  ];
  for (const p of pricePatterns) {
    const m = text.match(p);
    if (m) {
      let num = parseFloat(m[1].replace(',', '.'));
      const unit = m[2].toLowerCase();
      if (unit.includes('مليون') || unit.includes('million') || unit === 'm') num *= 1_000_000;
      else if (unit.includes('الف') || unit.includes('ألف') || unit.includes('thousand') || unit === 'k') num *= 1_000;
      price = num;
      break;
    }
  }
  
  // Size
  const sizeM = text.match(/(\d+)\s*(متر|م\b|sqm|m2|م²)/i);
  const size = sizeM ? parseInt(sizeM[1]) : null;
  
  // Bedrooms
  const bedM = text.match(/(\d+)\s*(غرف|غرفة|bedroom|bed\b|br\b|نوم)/i);
  const rawBedrooms = bedM ? parseInt(bedM[1]) : null;
  const bedrooms = (rawBedrooms !== null && rawBedrooms > 10) ? null : rawBedrooms;
  
  // Purpose
  const saleWords = ['للبيع', 'لتمليك', 'تمليك', 'for sale', 'selling', 'sale'];
  const rentWords = ['للإيجار', 'للايجار', 'ايجار', 'for rent', 'renting', 'rent', 'شهري', 'سنوي'];
  let purpose: 'sale' | 'rent' | null = null;
  if (saleWords.some(w => text.includes(w) || textLower.includes(w.toLowerCase()))) purpose = 'sale';
  else if (rentWords.some(w => text.includes(w) || textLower.includes(w.toLowerCase()))) purpose = 'rent';
  
  const confidence = (isSupply || isDemand) ? 0.55 : 0.25;
  const classification = isSupply ? 'supply' : (isDemand ? 'demand' : 'unknown');
  
  return {
    classification,
    propertyType,
    location,
    area: location,
    city: 'Cairo',
    price: isSupply ? price : null,
    priceMin: isDemand ? price : null,
    priceMax: isDemand ? price : null,
    priceUnit: purpose === 'rent' ? 'per_month' : 'total',
    priceType: null,
    cashPrice: null,
    downPayment: null,
    installmentAmount: null,
    installmentYears: null,
    size: isSupply ? size : null,
    sizeMin: isDemand ? size : null,
    sizeMax: isDemand ? size : null,
    bedrooms,
    bathrooms: null,
    floor: null,
    purpose,
    contact: senderPhone || 'Unknown',
    contactName: (senderName && senderName !== 'Unknown') ? senderName : (senderPhone || 'Unknown'),
    features: [],
    language,
    confidence,
    rawNotes: null,
  };
}

// ─── Comprehensive Weighted Keyword Vocabulary ────────────────────────────────
// Each entry: [keyword, weight] — higher weight = stronger signal
// Covers Egyptian broker slang, formal Arabic, and English variants

const SUPPLY_SIGNALS: [string, number][] = [
  // ── Explicit sale/rent offer (weight 10 = definitive) ──
  ['للبيع', 10], ['للإيجار', 10], ['للايجار', 10], ['للتأجير', 10], ['للتاجير', 10],
  ['لتمليك', 10], ['لتأجير', 10], ['لبيع', 9], ['بيع', 8],
  // ── Availability signals ──
  ['متاح', 8], ['متوفر', 8], ['متوفره', 8], ['متاحة', 8], ['متاحه', 8],
  ['موجود', 7], ['موجوده', 7], ['موجودة', 7],
  // ── Ownership/offering signals ──
  ['عندي', 8], ['عندنا', 8], ['معايا', 8], ['معانا', 7], ['لدي', 8], ['لدينا', 7],
  ['عرض', 7], ['عروض', 6], ['اعلان', 6], ['إعلان', 6],
  ['نقدم', 6], ['نعرض', 6], ['يقدم', 6], ['تقدم', 6],
  // ── Broker supply signals ──
  ['وحدة', 6], ['وحدات', 6], ['يوجد', 7], ['تجد', 6],
  ['مساحة', 5], ['دور', 5], ['طابق', 5],
  // ── English supply signals ──
  ['for sale', 10], ['for rent', 10], ['available', 8], ['offering', 8],
  ['selling', 9], ['renting out', 9], ['to let', 9], ['to sell', 9],
  ['on sale', 8], ['on rent', 8], ['for lease', 9], ['lease', 7],
  ['listed', 7], ['listing', 7], ['asking price', 8], ['price:', 6],
  ['sqm', 5], ['sq.m', 5], ['m2', 5], ['bua', 5], ['bua:', 6],
  // ── Standalone rent/sale English (common in Egyptian broker messages) ──
  ['rent:', 9], ['rent_', 8], ['sale:', 9], ['sale_', 8],
  // Match "Rent ___" at start of message or after newline
  // ── Price/spec signals that imply supply ──
  ['سعر', 5], ['السعر', 5], ['بسعر', 5], ['تقدر', 5], ['يتفاوض', 5],
  ['قابل للتفاوض', 6], ['نهائي', 5], ['اخر سعر', 6],
  // ── Egyptian broker offer patterns (from real messages) ──
  ['اعرض', 9], ['أعرض', 9], ['نعرض', 9], ['اقدم', 8], ['أقدم', 8],
  ['مدفوع', 7], ['اجمالي', 6], ['إجمالي', 6], ['اوفر', 6], ['أوفر', 6],
  ['تمليك', 8], ['تأجير', 8], ['تاجير', 8],
  ['شقة للبيع', 10], ['شقه للبيع', 10], ['فيلا للبيع', 10], ['شاليه للبيع', 10],
  ['hotel studio for sale', 10], ['hotel apartment for sale', 10],
  ['twinhouse for sale', 10], ['villa for sale', 10], ['apartment for sale', 10],
  ['apartment for rent', 10], ['villa for rent', 10], ['studio for sale', 10],
  ['fully furnished', 7], ['semi furnished', 7], ['fully finished', 7], ['core and shell', 8],
  ['first use', 7], ['first floor', 5], ['ground floor', 5],
  ['asking price', 9], ['lowest price', 8], ['best price', 7],
];

const DEMAND_SIGNALS: [string, number][] = [
  // ── Explicit request signals (weight 10 = definitive) ──
  ['مطلوب', 10], ['مطلوبة', 10], ['مطلوبه', 10],
  ['ابحث عن', 10], ['بحث عن', 9], ['ابحث', 8], ['نبحث', 8],
  ['بدور على', 10], ['بدور', 8], ['بدوّر', 8], ['بدور ع', 9],
  // ── Need/want signals ──
  ['محتاج', 9], ['محتاجة', 9], ['محتاجه', 9], ['محتاجين', 9],
  ['عايز', 9], ['عايزة', 9], ['عايزه', 9], ['عايزين', 9],
  ['اريد', 9], ['أريد', 9], ['نريد', 9], ['نريد', 9],
  ['اطلب', 8], ['أطلب', 8], ['نطلب', 8], ['طلب', 7],
  // ── Urgency signals ──
  ['عاجل', 7], ['urgent', 7], ['urgently', 7], ['asap', 7],
  ['بسرعة', 6], ['ضروري', 7], ['ضرورى', 7],
  // ── Budget/range signals ──
  ['ميزانية', 7], ['budget', 7], ['ميزانيتي', 7], ['الميزانية', 7],
  ['حد اقصى', 7], ['حد أقصى', 7], ['max budget', 7], ['up to', 6],
  ['في حدود', 6], ['لا يتجاوز', 6], ['not more than', 6],
  // ── Preference signals ──
  ['يفضل', 6], ['يفضّل', 6], ['تفضيل', 6], ['preferred', 6],
  ['مناسب', 5], ['مناسبة', 5], ['يناسب', 5],
  // ── English demand signals ──
  ['looking for', 10], ['need', 8], ['want', 8], ['searching', 9],
  ['required', 9], ['seeking', 9], ['wanted', 9], ['request', 8],
  ['i need', 9], ['we need', 9], ['client needs', 9], ['client looking', 9],
  ['buyer looking', 9], ['buyer needs', 9], ['my client', 8],
  ['require', 8], ['in search of', 9], ['interested in', 7],
  // ── Broker demand signals ──
  ['عميل', 7], ['عميلي', 8], ['عميلنا', 8], ['client', 7],
  ['طلب عميل', 9], ['عندي عميل', 9], ['معايا عميل', 9],
  ['عايز يشتري', 9], ['عايز يستأجر', 9], ['يريد شراء', 9], ['يريد ايجار', 9],
  // ── Egyptian demand patterns (from real messages) ──
  ['بادجت', 9], ['بادجيت', 9], ['بدجت', 9],
  ['مطلوب تمليك', 10], ['مطلوب ايجار', 10], ['مطلوب شقة', 10],
  ['مطلوب فيلا', 10], ['مطلوب استديو', 10], ['مطلوب دوبلكس', 10],
  ['مطلوب بنتهاوس', 10], ['مطلوب تونهاوس', 10],
  ['جوه كمباوند', 7], ['جوه كمبوند', 7],
  ['ارجو ارسال', 8], ['ارجو الارسال', 8],
  ['نص تشطيب', 7], ['تشطيب خاص', 6],
  // ── CRITICAL: Property type keywords (when combined with budget = DEMAND) ──
  ['شقة', 8], ['فيلا', 8], ['استديو', 8], ['دوبلكس', 8], ['بنتهاوس', 8], ['تونهاوس', 8],
  ['شقه', 8], ['فيلة', 8], ['استوديو', 8],
  ['apartment', 8], ['villa', 8], ['studio', 8], ['duplex', 8], ['penthouse', 8],
  // ── Room/bathroom keywords (indicates searching for property) ──
  ['نوم', 7], ['غرفة', 7], ['حمام', 7], ['مساحة', 6], ['م2', 6], ['sqm', 6],
  ['bedroom', 7], ['bathroom', 6], ['room', 5], ['area', 5],
  // ── Finish type (indicates buyer preference) ──
  ['تشطيب', 7], ['فارغ', 7], ['مفروش', 7], ['بدون تشطيب', 8],
  ['finished', 7], ['unfurnished', 7], ['furnished', 7],
  // ── Location keywords (when combined with property type = DEMAND) ──
  ['التجمع', 6], ['مدينتي', 6], ['الشيخ زايد', 6], ['الرحاب', 6], ['المعادي', 6],
  ['new cairo', 6], ['madinaty', 6], ['sheikh zayed', 6], ['rehab', 6],
];

// ─── Step 8: Quick Classification (for pre-LLM routing) ───────────────────────

// Enhanced quickClassify with better fallback logic
export function quickClassify(text: string): 'supply' | 'demand' | 'unknown' {
  const lower = text.toLowerCase();
  const trimmed = text.trim();
  
  let supplyScore = 0;
  let demandScore = 0;
  
  // Primary signal matching
  for (const [kw, weight] of SUPPLY_SIGNALS) {
    if (lower.includes(kw.toLowerCase())) supplyScore += weight;
  }
  for (const [kw, weight] of DEMAND_SIGNALS) {
    if (lower.includes(kw.toLowerCase())) demandScore += weight;
  }
  
  // Contextual boosts for supply
  if (/^rent[\s_:*]/i.test(trimmed)) supplyScore += 9;
  if (/^sale[\s_:*]/i.test(trimmed)) supplyScore += 9;
  if (/^for\s+(rent|sale|lease)/i.test(trimmed)) supplyScore += 10;
  if (/bua[:\s]*\d+/i.test(lower)) supplyScore += 8;
  if (/\d[,.]\d{3}[,.]\d{3}/.test(text) && demandScore < supplyScore + 5) supplyScore += 5;
  
  // Contextual boosts for demand
  if (/^\s*مطلوب/.test(trimmed)) demandScore += 5;
  if (/محتاج|عايز|ابحث|بدور/.test(lower) && /شقة|فيلا|استديو|دوبلكس|عقار|property|apartment|villa/.test(lower)) demandScore += 3;
  if (/ميزانية|budget|حد اقصى/.test(lower) && /\d{6,}/.test(text)) demandScore += 4;
  
  // Strong demand patterns (broker with client)
  if (/عميل|client|my client|عندي عميل|معايا عميل/.test(lower) && /عايز|محتاج|looking|need/.test(lower)) demandScore += 8;
  
  // Decision logic with higher confidence thresholds
  if (demandScore > supplyScore && demandScore >= 7) return 'demand';
  if (supplyScore > demandScore && supplyScore >= 7) return 'supply';
  if (demandScore >= 10) return 'demand';
  if (supplyScore >= 10) return 'supply';
  if (demandScore >= 6 && demandScore > supplyScore) return 'demand';
  if (supplyScore >= 6 && supplyScore > demandScore) return 'supply';
  
  // Fallback: if text has property details + price, likely supply
  if (/شقة|فيلا|apartment|villa|studio/.test(lower) && /\d{6,}|مليون|million/.test(text) && supplyScore > 0) return 'supply';
  // Fallback: if text has property request + budget, likely demand
  if (/شقة|فيلا|apartment|villa|studio/.test(lower) && /محتاج|عايز|need|want|looking|budget|ميزانية/.test(lower)) return 'demand';
  
  return 'unknown';
}


// ─── Main Pipeline Function ────────────────────────────────────────────────────

export async function runIngestionPipeline(input: IngestionInput): Promise<IngestionResult> {
  const startTime = Date.now();
  
  const { messageText, sender, senderName, groupName, msgDbId } = input;
  
  // Format sender phone
  const senderPhone = sender.replace(/@c\.us$/, '');
  const senderPhoneFormatted = senderPhone.startsWith('20') ? '0' + senderPhone.slice(2) : senderPhone;
  
  // Step 1: Spam check
  if (isSpamMessage(messageText)) {
    return {
      classification: 'spam',
      recordId: null,
      matchCount: 0,
      confidence: 0,
      priority: 'low',
      reviewStatus: 'auto_approved',
      extractedData: null,
      processingTimeMs: Date.now() - startTime,
    };
  }
  
  // Step 2: Quick pre-classification (skip LLM for obvious unknowns)
  const quickClass = quickClassify(messageText);
  
  // Step 3: LLM extraction (always run for supply/demand, skip for obvious unknowns)
  let extracted: ExtractedPropertyData;
  let llmClassification: 'supply' | 'demand' | 'unknown' = quickClass;
  
  if (quickClass !== 'unknown') {
    extracted = await extractWithLLM(messageText, senderPhoneFormatted, senderName);
    // Use LLM classification as authoritative
    llmClassification = extracted.classification as 'supply' | 'demand' | 'unknown';
  } else {
    // Still try LLM for borderline cases
    extracted = await extractWithLLM(messageText, senderPhoneFormatted, senderName);
    llmClassification = extracted.classification as 'supply' | 'demand' | 'unknown';
    // Determine final classification from LLM confidence
    if (extracted.confidence < 0.4) {
      return {
        classification: 'unknown',
        recordId: null,
        matchCount: 0,
        confidence: extracted.confidence,
        priority: 'low',
        reviewStatus: 'auto_approved',
        extractedData: null,
        processingTimeMs: Date.now() - startTime,
      };
    }
  }
  
  // Step 4: Determine final classification
  // Re-classify based on extracted data
  const finalClassification = determineClassification(messageText, extracted);
  
  if (finalClassification === 'unknown') {
    return {
      classification: 'unknown',
      recordId: null,
      matchCount: 0,
      confidence: extracted.confidence,
      priority: 'low',
      reviewStatus: 'auto_approved',
      extractedData: null,
      processingTimeMs: Date.now() - startTime,
    };
  }
  
  // Step 5: Priority scoring
  const priority = calculatePriority(
    extracted.confidence,
    extracted.price !== null || extracted.priceMin !== null || extracted.priceMax !== null,
    extracted.location !== null,
    extracted.contact !== 'Unknown',
    extracted.propertyType !== null
  );
  
  // Step 6: Review routing
  const reviewStatus = determineReviewStatus(extracted.confidence, extracted.contact !== 'Unknown');
  
  // Step 7: Create record
  let recordId: number | null = null;
  let matchCount = 0;
  
  try {
    if (finalClassification === 'supply') {
      recordId = await insertSupply({
        messageId: msgDbId,
        propertyType: extracted.propertyType,
        location: extracted.location,
        area: extracted.area,
        city: extracted.city,
        price: extracted.price?.toString() || null,
        priceUnit: extracted.priceUnit,
        priceType: extracted.priceType || 'cash',
        cashPrice: extracted.cashPrice?.toString() || null,
        downPayment: extracted.downPayment?.toString() || null,
        installmentAmount: extracted.installmentAmount?.toString() || null,
        installmentYears: extracted.installmentYears || null,
        size: extracted.size,
        bedrooms: extracted.bedrooms,
        bathrooms: extracted.bathrooms,
        floor: extracted.floor,
        purpose: extracted.purpose,
        contact: extracted.contact,
        contactName: extracted.contactName,
        features: extracted.features,
        confidence: extracted.confidence.toString(),
        matched: 0,
        priority,
        reviewStatus,
        sourceGroup: groupName,
        nlpVersion: 'v2',
        rawMessageText: messageText,
      } as any);
      
      if (recordId) {
        const matches = await findMatchesForSupply(recordId);
        matchCount = matches.length;
      }
    } else if (finalClassification === 'demand') {
      // Classify buyer intent
      const intentResult = classifyBuyerIntent(
        messageText,
        extracted.contactName,
        !!(extracted.priceMin || extracted.priceMax),
        false
      );
      recordId = await insertDemand({
        messageId: msgDbId,
        propertyType: extracted.propertyType,
        location: extracted.location,
        area: extracted.area,
        city: extracted.city,
        priceMin: extracted.priceMin?.toString() || null,
        priceMax: extracted.priceMax?.toString() || null,
        sizeMin: extracted.sizeMin,
        sizeMax: extracted.sizeMax,
        bedrooms: extracted.bedrooms,
        bathrooms: extracted.bathrooms,
        purpose: extracted.purpose,
        contact: extracted.contact,
        contactName: extracted.contactName,
        requirements: extracted.features,
        confidence: extracted.confidence.toString(),
        matched: 0,
        priority,
        reviewStatus,
        sourceGroup: groupName,
        nlpVersion: 'v2',
        rawMessageText: messageText,
        buyerIntentScore: intentResult.score,
        buyerTier: intentResult.tier,
      } as any);
      
      if (recordId) {
        const matches = await findMatchesForDemand(recordId);
        matchCount = matches.length;
      }
    }
  } catch (err) {
    console.error("[Ingestion] Record creation failed:", err);
  }
  
  return {
    classification: finalClassification,
    recordId,
    matchCount,
    confidence: extracted.confidence,
    priority,
    reviewStatus,
    extractedData: extracted,
    processingTimeMs: Date.now() - startTime,
  };
}

// ─── Helper: Final Classification ─────────────────────────────────────────────

function determineClassification(
  text: string,
  extracted: ExtractedPropertyData
): 'supply' | 'demand' | 'unknown' {
  const lower = text.toLowerCase();
  
  // SPECIAL CASE: Broker with client request (عندي عميل + demand keywords)
  // This should ALWAYS be classified as DEMAND, not SUPPLY
  const brokerClientPatterns = [
    /عندي\s+عميل/i,
    /لدي\s+عميل/i,
    /عميل\s+(يريد|عايز|يبحث|محتاج)/i,
    /my\s+client\s+(needs|wants|is\s+looking)/i,
    /client\s+(needs|wants|looking)/i,
  ];
  
  const isBrokerWithClient = brokerClientPatterns.some(p => p.test(text));
  
  // Use the comprehensive weighted vocabulary
  let supplyScore = 0;
  let demandScore = 0;
  
  for (const [kw, weight] of SUPPLY_SIGNALS) {
    if (lower.includes(kw.toLowerCase())) supplyScore += weight;
  }
  for (const [kw, weight] of DEMAND_SIGNALS) {
    if (lower.includes(kw.toLowerCase())) demandScore += weight;
  }
  
  // BROKER CLIENT OVERRIDE: If broker with client pattern detected, boost demand
  if (isBrokerWithClient) {
    supplyScore = Math.max(0, supplyScore - 10);
    demandScore += 15;
  }
  
  // Clear winner by score (LOWERED THRESHOLD FROM 6 TO 3)
  if (demandScore > supplyScore && demandScore >= 3) return 'demand';
  if (supplyScore > demandScore && supplyScore >= 3) return 'supply';
  
  // Tie-break: use extracted data signals
  if (extracted.confidence >= 0.5) {
    // If has price range (min/max) -> likely demand
    if (extracted.priceMin !== null && extracted.priceMax !== null) return 'demand';
    // If has exact price -> likely supply
    if (extracted.price !== null) return 'supply';
  }
  
  // Low-score but has any signal (AGGRESSIVE FALLBACK)
  if (demandScore > 0 && demandScore >= supplyScore) return 'demand';
  if (supplyScore > 0 && !isBrokerWithClient) return 'supply';
  
  // If broker with client but low scores, still classify as demand
  if (isBrokerWithClient && demandScore > 0) return 'demand';
  
  // FINAL FALLBACK: If ANY score exists, classify (NO UNKNOWN)
  if (demandScore > supplyScore) return 'demand';
  if (supplyScore > demandScore) return 'supply';
  
  // LAST RESORT: Classify based on message context
  if (extracted.propertyType && extracted.price === null) return 'demand';
  if (extracted.price !== null) return 'supply';
  
  // ABSOLUTE FALLBACK: Default to demand (more common)
  return 'demand';
}
