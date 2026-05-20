/**
 * Role Identification Service
 * Identifies sender role (Broker, End User, Seller, Buyer) based on message patterns
 * 
 * Rules:
 * - "عندي عميل", "بدور لعميل", "معايا وحدة", "لدى عميل" → Broker
 * - "محتاج", "محتاجة", "بدور على", "عايز", "عاوز", "طالب لنفسي" + specific requirement → End User
 * - Repeated posting of different units/prices from same sender → Broker
 * - One-off detailed search request → End User
 */

export type SenderRole = "broker" | "end_user" | "seller" | "buyer" | "unknown";

export interface RoleIdentificationResult {
  role: SenderRole;
  confidence: number; // 0-100
  indicators: string[];
  reasoning: string;
}

const BROKER_KEYWORDS = [
  "عندي عميل",
  "بدور لعميل",
  "معايا وحدة",
  "لدى عميل",
  "available units",
  "multiple listing",
  "عندي عملاء",
  "بدور عملاء",
  "لدينا عملاء",
  "عندنا عملاء",
  "وحدات متعددة",
  "وحدات مختلفة",
  "عمولة",
  "commission",
  "متخصص في",
  "specialized in",
  "سنوات خبرة",
  "years of experience",
  "مكتب عقاري",
  "real estate office",
  "شركة عقارات",
  "real estate company",
];

const END_USER_KEYWORDS = [
  "محتاج",
  "محتاجة",
  "بدور على",
  "عايز",
  "عاوز",
  "طالب لنفسي",
  "ابحث عن",
  "looking for",
  "need",
  "want",
  "أبحث عن",
  "أريد",
  "أتمنى",
  "أحتاج",
  "ضروري",
  "مستعجل",
  "للعائلة",
  "for family",
  "قريب من المدرسة",
  "near school",
  "قريب من العمل",
  "near work",
  "للأطفال",
  "for children",
];

const SUPPLY_KEYWORDS = [
  "للبيع",
  "for sale",
  "للإيجار",
  "for rent",
  "للتمليك",
  "متاح",
  "available",
  "متوفر",
  "عندي شقة",
  "عندي فيلا",
  "عندي أرض",
  "I have",
  "we have",
  "عندنا",
  "لدينا",
];

const DEMAND_KEYWORDS = [
  "محتاج شقة",
  "محتاج فيلا",
  "محتاج أرض",
  "محتاجة شقة",
  "محتاجة فيلا",
  "محتاجة أرض",
  "بدور شقة",
  "بدور فيلا",
  "بدور أرض",
  "طالب شقة",
  "طالب فيلا",
  "طالب أرض",
];

/**
 * Identify sender role based on message content and patterns
 */
export function identifyRole(
  message: string,
  classification: "supply" | "demand" | "unknown",
  senderMessageCount: number = 1,
  senderUniqueProperties: number = 1
): RoleIdentificationResult {
  const text = message.toLowerCase();
  const indicators: string[] = [];
  let brokerScore = 0;
  let endUserScore = 0;

  // ─── Rule 1: Check for explicit broker keywords ───────────────────────────
  for (const keyword of BROKER_KEYWORDS) {
    if (text.includes(keyword.toLowerCase())) {
      indicators.push(`Broker keyword: "${keyword}"`);
      brokerScore += 40;
    }
  }

  // ─── Rule 2: Check for explicit end-user keywords ──────────────────────────
  for (const keyword of END_USER_KEYWORDS) {
    if (text.includes(keyword.toLowerCase())) {
      indicators.push(`End-user keyword: "${keyword}"`);
      endUserScore += 35;
    }
  }

  // ─── Rule 3: Repeated posting pattern (broker indicator) ────────────────────
  if (senderMessageCount > 10) {
    indicators.push(`High message frequency (${senderMessageCount} messages)`);
    brokerScore += 25;
  }

  if (senderUniqueProperties > 3) {
    indicators.push(`Multiple properties (${senderUniqueProperties} different units)`);
    brokerScore += 30;
  }

  // ─── Rule 4: Classification-based inference ──────────────────────────────────
  if (classification === "supply") {
    // Check if it's a seller or broker
    if (brokerScore > endUserScore) {
      // Already detected as broker
    } else if (senderMessageCount === 1 && senderUniqueProperties === 1) {
      // One-off supply message = seller
      indicators.push("Single property listing");
      endUserScore += 20;
    } else if (senderMessageCount > 5) {
      // Multiple supply messages = broker
      indicators.push("Multiple supply listings");
      brokerScore += 20;
    }
  } else if (classification === "demand") {
    // Check if it's a buyer or broker
    if (brokerScore > endUserScore) {
      // Already detected as broker
    } else if (senderMessageCount === 1) {
      // One-off demand message = buyer
      indicators.push("Single demand request");
      endUserScore += 20;
    } else if (senderMessageCount > 5) {
      // Multiple demand messages = broker
      indicators.push("Multiple demand requests");
      brokerScore += 20;
    }
  }

  // ─── Rule 5: Specific requirement detection ──────────────────────────────────
  const specificRequirements = [
    /(\d+)\s*(نوم|bedroom|غرفة)/i,
    /(\d+)\s*(حمام|bathroom|دورة)/i,
    /(\d+)\s*(متر|sqm|م)/i,
    /(\d+)\s*(مليون|million|مليار|billion)/i,
    /قريب من/i,
    /بالقرب من/i,
  ];

  let requirementCount = 0;
  for (const pattern of specificRequirements) {
    if (pattern.test(message)) {
      requirementCount++;
    }
  }

  if (requirementCount >= 2 && endUserScore > 0) {
    indicators.push(`Specific requirements (${requirementCount} criteria)`);
    endUserScore += 15;
  }

  // ─── Determine final role ────────────────────────────────────────────────────
  let role: SenderRole = "unknown";
  let confidence = 0;

  if (brokerScore > endUserScore + 10) {
    role = "broker";
    confidence = Math.min(100, brokerScore);
  } else if (endUserScore > brokerScore + 10) {
    role = "end_user";
    confidence = Math.min(100, endUserScore);
  } else if (classification === "supply" && endUserScore === 0 && brokerScore === 0) {
    role = "seller";
    confidence = 60;
    indicators.push("Default classification: seller (supply)");
  } else if (classification === "demand" && endUserScore === 0 && brokerScore === 0) {
    role = "buyer";
    confidence = 60;
    indicators.push("Default classification: buyer (demand)");
  } else if (brokerScore > 0 || endUserScore > 0) {
    // Uncertain - pick the higher score
    role = brokerScore > endUserScore ? "broker" : "end_user";
    confidence = Math.max(brokerScore, endUserScore);
  }

  // ─── Generate reasoning ──────────────────────────────────────────────────────
  let reasoning = "";
  if (role === "broker") {
    reasoning = `Identified as broker based on ${indicators.length} indicators: ${indicators.slice(0, 3).join(", ")}`;
  } else if (role === "end_user") {
    reasoning = `Identified as end-user based on ${indicators.length} indicators: ${indicators.slice(0, 3).join(", ")}`;
  } else if (role === "seller") {
    reasoning = "Identified as seller - single supply listing";
  } else if (role === "buyer") {
    reasoning = "Identified as buyer - single demand request";
  } else {
    reasoning = "Unable to determine role with confidence";
  }

  return {
    role,
    confidence,
    indicators,
    reasoning,
  };
}

/**
 * Batch identify roles for multiple messages
 */
export function identifyRolesBatch(
  messages: Array<{
    id: number;
    message: string;
    classification: "supply" | "demand" | "unknown";
    senderPhone: string;
  }>
): Map<
  number,
  RoleIdentificationResult & { messageId: number; senderPhone: string }
> {
  const results = new Map<
    number,
    RoleIdentificationResult & { messageId: number; senderPhone: string }
  >();

  // Group by sender phone to get message count and unique properties
  const senderStats = new Map<
    string,
    {
      messageCount: number;
      uniqueProperties: number;
      messages: typeof messages;
    }
  >();

  for (const msg of messages) {
    if (!senderStats.has(msg.senderPhone)) {
      senderStats.set(msg.senderPhone, {
        messageCount: 0,
        uniqueProperties: 0,
        messages: [],
      });
    }

    const stats = senderStats.get(msg.senderPhone)!;
    stats.messageCount++;
    stats.messages.push(msg);

    // Count unique properties (simplified: count different locations/types mentioned)
    if (msg.message.length > 20) {
      stats.uniqueProperties++;
    }
  }

  // Identify role for each message
  for (const msg of messages) {
    const stats = senderStats.get(msg.senderPhone)!;
    const roleResult = identifyRole(
      msg.message,
      msg.classification,
      stats.messageCount,
      stats.uniqueProperties
    );

    results.set(msg.id, {
      ...roleResult,
      messageId: msg.id,
      senderPhone: msg.senderPhone,
    });
  }

  return results;
}

/**
 * Get role display label
 */
export function getRoleLabel(role: SenderRole): string {
  const labels: Record<SenderRole, string> = {
    broker: "🏢 Broker",
    end_user: "👤 End User",
    seller: "🏠 Seller",
    buyer: "🔍 Buyer",
    unknown: "❓ Unknown",
  };
  return labels[role] || "Unknown";
}

/**
 * Get role color for UI
 */
export function getRoleColor(role: SenderRole): string {
  const colors: Record<SenderRole, string> = {
    broker: "#f59e0b", // amber
    end_user: "#3b82f6", // blue
    seller: "#10b981", // emerald
    buyer: "#8b5cf6", // purple
    unknown: "#6b7280", // gray
  };
  return colors[role] || "#6b7280";
}
