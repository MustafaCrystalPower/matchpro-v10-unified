/**
 * Broker vs Real Client Detection Engine
 * Analyzes message patterns, contact behavior, and language to classify brokers vs genuine buyers/sellers
 */

interface BrokerDetectionInput {
  message: string;
  contactName?: string;
  contact?: string;
  messageCount?: number;
  uniquePropertiesCount?: number;
  messageFrequency?: 'high' | 'medium' | 'low';
  responseTime?: number; // in hours
  languagePattern?: 'formal' | 'casual' | 'mixed';
  propertyTypes?: string[];
}

interface BrokerDetectionResult {
  isBroker: boolean;
  brokerScore: number; // 0-100, higher = more likely to be broker
  confidence: number; // 0-100
  indicators: {
    name: string;
    score: number;
    reason: string;
  }[];
  classification: 'broker' | 'real_client' | 'uncertain';
}

// Broker indicators - patterns that suggest professional broker behavior
const BROKER_INDICATORS = {
  // Language patterns
  FORMAL_LANGUAGE: {
    patterns: [
      /^(السيد|السيدة|الأخ|الأخت)/i, // Formal titles
      /^(Dear|Hello|Good|Sir|Madam)/i,
      /بأفضل الأسعار|أفضل سعر|أقل سعر|تنافسية/i, // Competitive pricing language
      /متخصص|متخصصة|متخصصين/i, // "Specialist"
      /شركة|مكتب|مؤسسة/i, // "Company/Office/Institution"
    ],
    weight: 15,
  },

  // Volume-based indicators
  MULTIPLE_PROPERTIES: {
    threshold: 5, // If mentioning 5+ different properties
    weight: 25,
  },

  RAPID_MESSAGING: {
    threshold: 10, // Messages per day
    weight: 20,
  },

  // Business language
  BUSINESS_TERMS: {
    patterns: [
      /عمولة|commission|percentage/i,
      /عقد|contract|agreement/i,
      /تسويق|marketing|promotion/i,
      /عملاء|clients|customers/i,
      /محفظة|portfolio/i,
      /متخصص في|specialized in/i,
      /سنوات خبرة|years of experience/i,
    ],
    weight: 20,
  },

  // Contact pattern indicators
  MULTIPLE_CONTACTS: {
    threshold: 3, // Different phone numbers in messages
    weight: 15,
  },

  // Property type diversity
  DIVERSE_PROPERTY_TYPES: {
    threshold: 4, // Selling/buying 4+ different property types
    weight: 18,
  },

  // Timing patterns
  BUSINESS_HOURS_ONLY: {
    weight: 10,
  },

  // Message structure
  TEMPLATED_MESSAGES: {
    patterns: [
      /^(متوفر|available|للبيع|for sale|للإيجار|for rent)/i,
      /^(لدينا|we have|عندنا|we offer)/i,
    ],
    weight: 12,
  },
};

// Real client indicators
const REAL_CLIENT_INDICATORS = {
  // Casual language
  CASUAL_LANGUAGE: {
    patterns: [
      /^(محتاج|محتاجة|عايز|عايزة|ابغى|ابغا)/i, // Casual "need/want"
      /^(ياريت|لو سمحت|من فضلك)/i, // Polite casual requests
      /^(السلام عليكم|مرحبا|أهلا)/i, // Casual greetings
    ],
    weight: 20,
  },

  // Specific personal needs
  SPECIFIC_REQUIREMENTS: {
    patterns: [
      /للعائلة|for family/i,
      /قريب من المدرسة|near school/i,
      /قريب من العمل|near work/i,
      /الأطفال|children/i,
      /الزوجة|wife/i,
      /الأسرة|family/i,
    ],
    weight: 18,
  },

  // Emotional language
  EMOTIONAL_LANGUAGE: {
    patterns: [
      /أحتاج|I need/i,
      /أتمنى|I wish/i,
      /مهم جدا|very important/i,
      /ضروري|urgent/i,
      /مستعجل|urgent/i,
    ],
    weight: 15,
  },

  // Low message frequency
  LOW_MESSAGE_FREQUENCY: {
    threshold: 2, // Messages per week
    weight: 12,
  },

  // Single property focus
  SINGLE_PROPERTY_TYPE: {
    weight: 14,
  },

  // Informal structure
  INFORMAL_MESSAGES: {
    patterns: [
      /^(في|في عندي|عندي)/i, // Informal "I have"
      /^(شنو|كيف|إيش)/i, // Casual "what/how"
    ],
    weight: 10,
  },
};

export function detectBroker(input: BrokerDetectionInput): BrokerDetectionResult {
  const indicators: BrokerDetectionResult['indicators'] = [];
  let brokerScore = 0;
  let realClientScore = 0;

  const message = input.message || '';
  const contactName = input.contactName || '';

  // 1. Check formal language patterns
  const formalMatches = BROKER_INDICATORS.FORMAL_LANGUAGE.patterns.filter(p =>
    p.test(message) || p.test(contactName)
  ).length;
  if (formalMatches > 0) {
    const score = Math.min(20, formalMatches * 8);
    brokerScore += score;
    indicators.push({
      name: 'Formal Language',
      score,
      reason: `Found ${formalMatches} formal language patterns`,
    });
  }

  // 2. Check casual language patterns
  const casualMatches = REAL_CLIENT_INDICATORS.CASUAL_LANGUAGE.patterns.filter(p =>
    p.test(message)
  ).length;
  if (casualMatches > 0) {
    const score = Math.min(20, casualMatches * 8);
    realClientScore += score;
    indicators.push({
      name: 'Casual Language',
      score: -score,
      reason: `Found ${casualMatches} casual language patterns`,
    });
  }

  // 3. Multiple properties indicator
  if ((input.uniquePropertiesCount || 0) >= BROKER_INDICATORS.MULTIPLE_PROPERTIES.threshold) {
    const score = BROKER_INDICATORS.MULTIPLE_PROPERTIES.weight;
    brokerScore += score;
    indicators.push({
      name: 'Multiple Properties',
      score,
      reason: `Mentioning ${input.uniquePropertiesCount} different properties`,
    });
  }

  // 4. Message frequency
  if (input.messageFrequency === 'high') {
    const score = BROKER_INDICATORS.RAPID_MESSAGING.weight;
    brokerScore += score;
    indicators.push({
      name: 'High Message Frequency',
      score,
      reason: 'Sending messages frequently (>10/day)',
    });
  } else if (input.messageFrequency === 'low') {
    const score = REAL_CLIENT_INDICATORS.LOW_MESSAGE_FREQUENCY.weight;
    realClientScore += score;
    indicators.push({
      name: 'Low Message Frequency',
      score: -score,
      reason: 'Low messaging frequency (<2/week)',
    });
  }

  // 5. Business terminology
  const businessTermMatches = BROKER_INDICATORS.BUSINESS_TERMS.patterns.filter(p =>
    p.test(message)
  ).length;
  if (businessTermMatches > 0) {
    const score = Math.min(20, businessTermMatches * 6);
    brokerScore += score;
    indicators.push({
      name: 'Business Terminology',
      score,
      reason: `Found ${businessTermMatches} business-related terms`,
    });
  }

  // 6. Personal/family needs
  const personalMatches = REAL_CLIENT_INDICATORS.SPECIFIC_REQUIREMENTS.patterns.filter(p =>
    p.test(message)
  ).length;
  if (personalMatches > 0) {
    const score = Math.min(18, personalMatches * 8);
    realClientScore += score;
    indicators.push({
      name: 'Personal Requirements',
      score: -score,
      reason: `Found ${personalMatches} personal/family-related requirements`,
    });
  }

  // 7. Emotional language
  const emotionalMatches = REAL_CLIENT_INDICATORS.EMOTIONAL_LANGUAGE.patterns.filter(p =>
    p.test(message)
  ).length;
  if (emotionalMatches > 0) {
    const score = Math.min(15, emotionalMatches * 7);
    realClientScore += score;
    indicators.push({
      name: 'Emotional Language',
      score: -score,
      reason: `Found ${emotionalMatches} emotional expressions`,
    });
  }

  // 8. Property type diversity
  if ((input.propertyTypes?.length || 0) >= BROKER_INDICATORS.DIVERSE_PROPERTY_TYPES.threshold) {
    const score = BROKER_INDICATORS.DIVERSE_PROPERTY_TYPES.weight;
    brokerScore += score;
    indicators.push({
      name: 'Diverse Property Types',
      score,
      reason: `Handling ${input.propertyTypes?.length} different property types`,
    });
  } else if ((input.propertyTypes?.length || 0) === 1) {
    const score = REAL_CLIENT_INDICATORS.SINGLE_PROPERTY_TYPE.weight;
    realClientScore += score;
    indicators.push({
      name: 'Single Property Type',
      score: -score,
      reason: 'Only interested in one property type',
    });
  }

  // 9. Contact name analysis
  const brokerNamePatterns = /^(السيد|السيدة|Mr|Mrs|Ms|Dr|Eng|مهندس|محامي|دكتور)/i;
  if (brokerNamePatterns.test(contactName)) {
    brokerScore += 8;
    indicators.push({
      name: 'Professional Title in Name',
      score: 8,
      reason: 'Contact name includes professional title',
    });
  }

  // Calculate final scores
  const totalScore = brokerScore + realClientScore;
  const normalizedBrokerScore = totalScore > 0 ? (brokerScore / totalScore) * 100 : 50;
  
  // Determine classification
  let classification: 'broker' | 'real_client' | 'uncertain';
  if (normalizedBrokerScore > 65) {
    classification = 'broker';
  } else if (normalizedBrokerScore < 35) {
    classification = 'real_client';
  } else {
    classification = 'uncertain';
  }

  // Calculate confidence
  const confidence = Math.min(100, Math.abs(normalizedBrokerScore - 50) * 2);

  return {
    isBroker: classification === 'broker',
    brokerScore: Math.round(normalizedBrokerScore),
    confidence: Math.round(confidence),
    indicators: indicators.sort((a, b) => Math.abs(b.score) - Math.abs(a.score)),
    classification,
  };
}

/**
 * Batch analyze multiple messages and aggregate broker score
 */
export function aggregateBrokerDetection(
  messages: BrokerDetectionInput[]
): BrokerDetectionResult {
  if (messages.length === 0) {
    return {
      isBroker: false,
      brokerScore: 50,
      confidence: 0,
      indicators: [],
      classification: 'uncertain',
    };
  }

  const results = messages.map(msg => detectBroker(msg));
  
  // Average the scores
  const avgBrokerScore = Math.round(
    results.reduce((sum, r) => sum + r.brokerScore, 0) / results.length
  );
  const avgConfidence = Math.round(
    results.reduce((sum, r) => sum + r.confidence, 0) / results.length
  );

  // Aggregate indicators
  const indicatorMap = new Map<string, { score: number; count: number }>();
  results.forEach(r => {
    r.indicators.forEach(ind => {
      const existing = indicatorMap.get(ind.name) || { score: 0, count: 0 };
      indicatorMap.set(ind.name, {
        score: existing.score + ind.score,
        count: existing.count + 1,
      });
    });
  });

  const aggregatedIndicators = Array.from(indicatorMap.entries())
    .map(([name, data]) => ({
      name,
      score: Math.round(data.score / data.count),
      reason: `Consistent across ${data.count} messages`,
    }))
    .sort((a, b) => Math.abs(b.score) - Math.abs(a.score));

  let classification: 'broker' | 'real_client' | 'uncertain';
  if (avgBrokerScore > 65) {
    classification = 'broker';
  } else if (avgBrokerScore < 35) {
    classification = 'real_client';
  } else {
    classification = 'uncertain';
  }

  return {
    isBroker: classification === 'broker',
    brokerScore: avgBrokerScore,
    confidence: avgConfidence,
    indicators: aggregatedIndicators,
    classification,
  };
}
