/**
 * Strict Arabic Real-Estate WhatsApp Parser for CRM Ingestion
 * Extracts only actionable real-estate intent from messages
 * Returns structured JSON with confidence scores and ingestion decisions
 */

import { invokeLLM } from "./_core/llm";

export interface ParserInput {
  message_text: string;
  sender_name: string;
  sender_phone: string;
  group_name: string;
  message_timestamp: Date;
}

export interface PropertyEntities {
  property_type: string; // apartment/villa/townhouse/duplex/studio/land/shop/office/chalet/building/unknown
  operation: string; // sale/rent/unknown
  location_text: string | null;
  price_min: number | null;
  price_max: number | null;
  currency: string; // EGP/USD/unknown
  beds: number | null;
  baths: number | null;
  area_m2: number | null;
}

export interface ParserOutput {
  reject: boolean;
  reject_reason: "none" | "non_real_estate" | "noise" | "insufficient_signal" | "spam";
  intent_label: "supply" | "demand" | "unknown";
  actor_type: "direct_buyer" | "broker_with_request" | "owner_seller" | "broker_listing" | "speculative" | "unknown";
  classification_confidence: number;
  extraction_confidence: number;
  entities: PropertyEntities;
  matched_signals: string[];
  conflict_detected: boolean;
  conflict_resolution: "none" | "demand_priority_client_request" | "supply_priority_listing_context";
  fingerprint_key: string;
  ingestion_decision: "accept_auto" | "send_review" | "reject";
  decision_reasons: string[];
}

const ARABIC_DEMAND_SIGNALS = [
  "عندي عميل",
  "معايا عميل",
  "عميل بيدور",
  "مطلوب",
  "محتاجة",
  "ابحث عن",
  "أبحث عن",
  "أريد",
  "أبغى",
  "أطلب",
  "بدي",
  "بدور",
  "أدور",
  "أشتري",
  "أستأجر",
  "أستأجر",
  "عايز",
  "عايزة",
  "بحاجة",
  "طالب",
  "طالبة",
  "مهتم",
  "مهتمة",
  "مهتمين",
  "مهتمات",
  "client wants",
  "looking for",
  "need",
  "want",
  "seeking",
];

const ARABIC_SUPPLY_SIGNALS = [
  "عندي شقة",
  "عندي فيلا",
  "عندي أرض",
  "للبيع",
  "للإيجار",
  "للايجار",
  "مالك مباشر",
  "صاحب العقار",
  "أملك",
  "أمتلك",
  "عرض",
  "عرض عقاري",
  "متوفر",
  "متاح",
  "جديد",
  "للتأجير",
  "للتأجير اليومي",
  "للتأجير الشهري",
  "شقة فندقية",
  "فيلا فندقية",
  "شاليه",
  "I have",
  "I own",
  "for sale",
  "for rent",
  "available",
  "listing",
];

const PROPERTY_TYPES = [
  "apartment",
  "villa",
  "townhouse",
  "duplex",
  "studio",
  "land",
  "shop",
  "office",
  "chalet",
  "building",
  "شقة",
  "فيلا",
  "أرض",
  "محل",
  "مكتب",
  "شاليه",
  "عمارة",
  "دوبلكس",
  "تاون هاوس",
  "استوديو",
];

const LOCATIONS = [
  "مدينتي",
  "التجمع الخامس",
  "الشيخ زايد",
  "المعادي",
  "الجيزة",
  "حلوان",
  "القاهرة الجديدة",
  "الرحاب",
  "مفيدا",
  "القاهرة الإسلامية",
  "6 أكتوبر",
  "الإسكندرية",
  "الساحل الشمالي",
  "الغردقة",
  "الأقصر",
  "أسوان",
  "شرم الشيخ",
  "طابا",
  "رأس سدر",
  "العين السخنة",
];

export async function parseArabicRealEstateMessage(input: ParserInput): Promise<ParserOutput> {
  const { message_text, sender_name, sender_phone, group_name, message_timestamp } = input;

  // Step 1: Check if message is real-estate actionable
  const isRealEstate = checkRealEstateIntent(message_text);
  if (!isRealEstate) {
    return {
      reject: true,
      reject_reason: "non_real_estate",
      intent_label: "unknown",
      actor_type: "unknown",
      classification_confidence: 0,
      extraction_confidence: 0,
      entities: getEmptyEntities(),
      matched_signals: [],
      conflict_detected: false,
      conflict_resolution: "none",
      fingerprint_key: "",
      ingestion_decision: "reject",
      decision_reasons: ["Message does not contain real-estate intent"],
    };
  }

  // Step 2: Classify intent and actor type
  const { intent_label, actor_type, classification_confidence, matched_signals } = classifyIntent(message_text);

  // Step 3: Extract entities using LLM
  const { entities, extraction_confidence } = await extractEntities(message_text);

  // Step 4: Detect conflicts
  const { conflict_detected, conflict_resolution } = detectConflicts(intent_label, actor_type, matched_signals);

  // Step 5: Generate fingerprint for duplicate detection
  const fingerprint_key = generateFingerprint(entities, sender_phone);

  // Step 6: Make ingestion decision
  const { ingestion_decision, decision_reasons } = makeIngestionDecision(
    intent_label,
    classification_confidence,
    extraction_confidence,
    conflict_detected,
    entities
  );

  return {
    reject: ingestion_decision === "reject",
    reject_reason: ingestion_decision === "reject" ? "insufficient_signal" : "none",
    intent_label,
    actor_type,
    classification_confidence,
    extraction_confidence,
    entities,
    matched_signals,
    conflict_detected,
    conflict_resolution,
    fingerprint_key,
    ingestion_decision,
    decision_reasons,
  };
}

function checkRealEstateIntent(message: string): boolean {
  const normalized = message.toLowerCase();

  // Check for real-estate keywords
  const hasRealEstateKeywords = [...ARABIC_DEMAND_SIGNALS, ...ARABIC_SUPPLY_SIGNALS].some((signal) =>
    normalized.includes(signal.toLowerCase())
  );

  // Check for property types
  const hasPropertyType = PROPERTY_TYPES.some((type) => normalized.includes(type.toLowerCase()));

  // Check for locations
  const hasLocation = LOCATIONS.some((loc) => normalized.includes(loc.toLowerCase()));

  // Check for price patterns (EGP, million, etc)
  const hasPricePattern = /(\d+\s*(مليون|ألف|جنيه|egp|ج\.م|م)|\d+\s*\d{6,})/i.test(message);

  // Check for property specs (bedrooms, area, etc)
  const hasSpecs = /(\d+\s*(نوم|غرفة|حمام|متر|م2|sqm|br|bath))/i.test(message);

  return hasRealEstateKeywords || (hasPropertyType && (hasLocation || hasPricePattern || hasSpecs));
}

function classifyIntent(message: string): {
  intent_label: "supply" | "demand" | "unknown";
  actor_type: "direct_buyer" | "broker_with_request" | "owner_seller" | "broker_listing" | "speculative" | "unknown";
  classification_confidence: number;
  matched_signals: string[];
} {
  const normalized = message.toLowerCase();
  const matched_signals: string[] = [];

  // Count demand and supply signals
  let demandScore = 0;
  let supplyScore = 0;

  for (const signal of ARABIC_DEMAND_SIGNALS) {
    if (normalized.includes(signal.toLowerCase())) {
      demandScore += 2;
      matched_signals.push(`demand:${signal}`);
    }
  }

  for (const signal of ARABIC_SUPPLY_SIGNALS) {
    if (normalized.includes(signal.toLowerCase())) {
      supplyScore += 2;
      matched_signals.push(`supply:${signal}`);
    }
  }

  // Determine intent
  let intent_label: "supply" | "demand" | "unknown" = "unknown";
  let actor_type: "direct_buyer" | "broker_with_request" | "owner_seller" | "broker_listing" | "speculative" | "unknown" = "unknown";
  let classification_confidence = 0;

  if (demandScore > supplyScore && demandScore >= 2) {
    intent_label = "demand";
    classification_confidence = Math.min(demandScore / 10, 1);

    // Determine actor type for demand
    if (normalized.includes("عندي عميل") || normalized.includes("معايا عميل")) {
      actor_type = "broker_with_request";
      classification_confidence = Math.min(classification_confidence + 0.2, 1);
    } else {
      actor_type = "direct_buyer";
    }
  } else if (supplyScore > demandScore && supplyScore >= 2) {
    intent_label = "supply";
    classification_confidence = Math.min(supplyScore / 10, 1);

    // Determine actor type for supply
    if (normalized.includes("مالك مباشر") || normalized.includes("صاحب العقار")) {
      actor_type = "owner_seller";
      classification_confidence = Math.min(classification_confidence + 0.2, 1);
    } else {
      actor_type = "broker_listing";
    }
  }

  return {
    intent_label,
    actor_type,
    classification_confidence,
    matched_signals,
  };
}

async function extractEntities(message: string): Promise<{ entities: PropertyEntities; extraction_confidence: number }> {
  const prompt = `Extract real-estate entities from this Arabic/English message. Return ONLY valid JSON.

Message: "${message}"

Extract ONLY if explicitly present:
- property_type: apartment/villa/townhouse/duplex/studio/land/shop/office/chalet/building/unknown
- operation: sale/rent/unknown
- location_text: raw location name or null
- price_min: minimum price in EGP or null
- price_max: maximum price in EGP or null
- currency: EGP/USD/unknown
- beds: number of bedrooms or null
- baths: number of bathrooms or null
- area_m2: area in square meters or null
- confidence: 0.0 to 1.0

Return JSON:
{
  "property_type": "string",
  "operation": "string",
  "location_text": "string|null",
  "price_min": "number|null",
  "price_max": "number|null",
  "currency": "string",
  "beds": "number|null",
  "baths": "number|null",
  "area_m2": "number|null",
  "confidence": "number"
}`;

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "You are a strict Arabic real-estate data extractor. Extract ONLY explicitly present information. Return valid JSON only.",
        },
        {
          role: "user",
          content: prompt as any,
        },
      ],
    });

    const content = (response.choices[0]?.message?.content as string) || "{}";
    const parsed = JSON.parse(content);

    const entities: PropertyEntities = {
      property_type: parsed.property_type || "unknown",
      operation: parsed.operation || "unknown",
      location_text: parsed.location_text || null,
      price_min: parsed.price_min || null,
      price_max: parsed.price_max || null,
      currency: parsed.currency || "unknown",
      beds: parsed.beds || null,
      baths: parsed.baths || null,
      area_m2: parsed.area_m2 || null,
    };

    return {
      entities,
      extraction_confidence: parsed.confidence || 0.5,
    };
  } catch (error) {
    return {
      entities: getEmptyEntities(),
      extraction_confidence: 0,
    };
  }
}

function detectConflicts(
  intent_label: string,
  actor_type: string,
  matched_signals: string[]
): { conflict_detected: boolean; conflict_resolution: "none" | "demand_priority_client_request" | "supply_priority_listing_context" } {
  const hasDemandSignals = matched_signals.some((s) => s.startsWith("demand:"));
  const hasSupplySignals = matched_signals.some((s) => s.startsWith("supply:"));

  if (hasDemandSignals && hasSupplySignals) {
    // Conflict detected - prioritize demand if client request is explicit
    const hasClientRequest = matched_signals.some((s) => s.includes("عندي عميل") || s.includes("معايا عميل"));
    return {
      conflict_detected: true,
      conflict_resolution: hasClientRequest ? "demand_priority_client_request" : "supply_priority_listing_context",
    };
  }

  return {
    conflict_detected: false,
    conflict_resolution: "none",
  };
}

function generateFingerprint(entities: PropertyEntities, sender_phone: string): string {
  const key = [
    entities.property_type,
    entities.operation,
    entities.location_text || "unknown",
    entities.price_min || "unknown",
    entities.beds || "unknown",
    sender_phone,
  ]
    .join("|")
    .toLowerCase();

  // Simple hash
  return Buffer.from(key).toString("base64").substring(0, 32);
}

function makeIngestionDecision(
  intent_label: string,
  classification_confidence: number,
  extraction_confidence: number,
  conflict_detected: boolean,
  entities: PropertyEntities
): { ingestion_decision: "accept_auto" | "send_review" | "reject"; decision_reasons: string[] } {
  const reasons: string[] = [];

  // High confidence - auto accept
  if (classification_confidence >= 0.9 && extraction_confidence >= 0.85) {
    return {
      ingestion_decision: "accept_auto",
      decision_reasons: ["High confidence classification and extraction"],
    };
  }

  // Medium confidence - send for review
  if (classification_confidence >= 0.6 && extraction_confidence >= 0.5) {
    reasons.push(`Classification confidence: ${classification_confidence.toFixed(2)}`);
    reasons.push(`Extraction confidence: ${extraction_confidence.toFixed(2)}`);

    if (conflict_detected) {
      reasons.push("Conflict detected between signals");
    }

    if (!entities.location_text) {
      reasons.push("Location not clearly specified");
    }

    if (!entities.price_min && !entities.price_max) {
      reasons.push("Price information missing");
    }

    return {
      ingestion_decision: "send_review",
      decision_reasons: reasons,
    };
  }

  // Low confidence - reject
  reasons.push(`Low classification confidence: ${classification_confidence.toFixed(2)}`);
  reasons.push(`Low extraction confidence: ${extraction_confidence.toFixed(2)}`);

  return {
    ingestion_decision: "reject",
    decision_reasons: reasons,
  };
}

function getEmptyEntities(): PropertyEntities {
  return {
    property_type: "unknown",
    operation: "unknown",
    location_text: null,
    price_min: null,
    price_max: null,
    currency: "unknown",
    beds: null,
    baths: null,
    area_m2: null,
  };
}
