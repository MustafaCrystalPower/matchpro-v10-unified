/**
 * MatchPro Buyer Intent Classifier
 * 
 * Classifies each demand message into one of three tiers:
 *   - direct_buyer    (score 80-100): First-person, specific budget, urgency, personal use
 *   - broker_with_request (score 40-79): Third-party language, represents a client
 *   - speculative     (score 0-39): Vague, no budget, no timeline, copy-paste
 * 
 * Scoring is additive/subtractive from a base of 50.
 */

export type BuyerTier = "direct_buyer" | "broker_with_request" | "speculative";

export interface IntentClassification {
  score: number;        // 0–100
  tier: BuyerTier;
  signals: string[];    // Human-readable explanation of what was detected
}

// ─── Signal Patterns ──────────────────────────────────────────────────────────

// Direct buyer signals (first-person language)
const DIRECT_BUYER_PATTERNS = [
  /\bأنا\s+(عايز|بحث|محتاج|أبحث|طالب|مهتم)\b/i,
  /\bبحث\s+عن\b/i,
  /\bأبحث\s+عن\b/i,
  /\bمحتاج\s+(شقة|فيلا|أرض|محل|مكتب|وحدة)\b/i,
  /\bi\s+(am\s+)?(looking|searching|need|want)\b/i,
  /\bi\s+want\s+to\s+buy\b/i,
  /\bi('m|\s+am)\s+interested\b/i,
  /\bfor\s+(my|our)\s+(family|use|home|residence)\b/i,
  /\bلأسكن\b/i,
  /\bللسكن\s+الشخصي\b/i,
  /\bلأسكنها\b/i,
  /\bلي\s+أنا\b/i,
  /\bمعايا\s+(ميزانية|مبلغ)\b/i,
  /\bميزانيتي\b/i,
  /\bmy\s+budget\s+is\b/i,
];

// Broker / third-party signals
const BROKER_PATTERNS = [
  /\bعندي\s+عميل\b/i,
  /\bلدي\s+عميل\b/i,
  /\bعميل\s+(محتاج|يريد|يبحث|عايز)\b/i,
  /\bعلى\s+طلب\s+عميل\b/i,
  /\bclient\s+(needs|wants|is\s+looking)\b/i,
  /\bmy\s+client\b/i,
  /\bعمولة\b/i,
  /\bcommission\b/i,
  /\bوكيل\s+عقاري\b/i,
  /\breal\s+estate\s+(agent|broker)\b/i,
  /\bمكتب\s+عقاري\b/i,
  /\bللتواصل\s+مع\s+(المكتب|الوكيل)\b/i,
  /\bطلب\s+من\s+(عميل|مشتري)\b/i,
  /\bعندنا\s+طلب\b/i,
];

// Urgency signals (boost score)
const URGENCY_PATTERNS = [
  /\bعاجل\b/i,
  /\bأسرع\b/i,
  /\burgent\b/i,
  /\bASAP\b/i,
  /\bجاهز\s+للتعاقد\b/i,
  /\bجاهز\s+للشراء\b/i,
  /\bready\s+to\s+(buy|sign|close)\b/i,
  /\bخلال\s+(أسبوع|شهر|أيام)\b/i,
  /\bفي\s+أقرب\s+وقت\b/i,
  /\bبسرعة\b/i,
];

// Speculative / low-intent signals
const SPECULATIVE_PATTERNS = [
  /\bابعت\s+(كل|ما)\s+عندك\b/i,
  /\bأي\s+(شقة|وحدة|عقار)\b/i,
  /\bany\s+(apartment|property|unit)\b/i,
  /\bجاست\s+تشيكينج\b/i,
  /\bjust\s+checking\b/i,
  /\bبدون\s+تفاصيل\b/i,
  /\bما\s+عندي\s+(ميزانية|بيانات)\b/i,
  /\bno\s+budget\b/i,
];

// Personal use signals
const PERSONAL_USE_PATTERNS = [
  /\bللسكن\b/i,
  /\bللاستخدام\s+الشخصي\b/i,
  /\bللعائلة\b/i,
  /\bfor\s+personal\s+use\b/i,
  /\bfor\s+my\s+family\b/i,
  /\bend[\s-]user\b/i,
  /\bنهائي\b/i,
  /\bمستخدم\s+نهائي\b/i,
];

// ─── Scoring Engine ───────────────────────────────────────────────────────────

export function classifyBuyerIntent(
  messageText: string,
  contactName?: string | null,
  hasBudget?: boolean,
  hasTimeline?: boolean
): IntentClassification {
  const text = messageText || "";
  const signals: string[] = [];
  let score = 50; // Neutral baseline

  // +30 Direct buyer language
  if (DIRECT_BUYER_PATTERNS.some(p => p.test(text))) {
    score += 30;
    signals.push("First-person buyer language detected");
  }

  // +20 Specific budget provided
  if (hasBudget) {
    score += 20;
    signals.push("Specific budget provided");
  } else if (/\b\d+[\s,.]?\d*\s*(مليون|ألف|k|m|million|EGP|جنيه)\b/i.test(text)) {
    score += 20;
    signals.push("Budget amount mentioned in message");
  }

  // +20 Urgency markers
  if (URGENCY_PATTERNS.some(p => p.test(text))) {
    score += 20;
    signals.push("Urgency signals detected");
  }

  // +15 Personal use language
  if (PERSONAL_USE_PATTERNS.some(p => p.test(text))) {
    score += 15;
    signals.push("Personal use / end-user language");
  }

  // +10 Timeline mentioned
  if (hasTimeline) {
    score += 10;
    signals.push("Timeline specified");
  }

  // -20 Broker language
  if (BROKER_PATTERNS.some(p => p.test(text))) {
    score -= 20;
    signals.push("Broker/intermediary language detected");
  }

  // -10 Speculative / vague
  if (SPECULATIVE_PATTERNS.some(p => p.test(text))) {
    score -= 10;
    signals.push("Vague/speculative request detected");
  }

  // -15 No budget AND no timeline
  if (!hasBudget && !hasTimeline && !/\d/.test(text.replace(/\s/g, ""))) {
    score -= 15;
    signals.push("No budget or timeline found");
  }

  // Clamp to 0–100
  score = Math.max(0, Math.min(100, score));

  // Determine tier
  let tier: BuyerTier;
  if (score >= 80) {
    tier = "direct_buyer";
  } else if (score >= 40) {
    tier = "broker_with_request";
  } else {
    tier = "speculative";
  }

  return { score, tier, signals };
}

/**
 * Get display label and color for a buyer tier
 */
export function getBuyerTierLabel(tier: BuyerTier): { label: string; color: string; emoji: string } {
  switch (tier) {
    case "direct_buyer":
      return { label: "Direct Buyer", color: "green", emoji: "🟢" };
    case "broker_with_request":
      return { label: "Broker Request", color: "yellow", emoji: "🟡" };
    case "speculative":
      return { label: "Speculative", color: "red", emoji: "🔴" };
  }
}
