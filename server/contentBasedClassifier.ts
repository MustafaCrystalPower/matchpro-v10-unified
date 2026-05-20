/**
 * Content-Based Classifier for Supply vs Demand
 * Classifies each message by actual content, not by source or tab name
 * 
 * Rules:
 * - Supply = available property with unit details
 * - Demand = requested property with desired specs
 * - Special handling for "مطلوب" (price vs specs)
 */

export interface ClassificationResult {
  classification: 'supply' | 'demand' | 'manual_review';
  confidence: number; // 0-100
  triggerWords: string[];
  reason: string;
}

const STRONG_SUPPLY_INDICATORS = [
  'متاح',
  'للإيجار',
  'للبيع',
  'فرصة',
  'من المالك',
  'من المالك مباشرة',
  'استلام',
  'تشطيب',
  'فيو',
  'دور',
  'مساحة',
  'غرف',
  'حمام',
  'جاردن',
  'روف',
  'سعر',
  'مفروشة للإيجار',
  'دوبلكس',
  'شقة',
  'فيلا',
  'تاون هاوس',
  'بنتهاوس',
  'ستوديو',
  'ريسبشن',
];

const STRONG_DEMAND_INDICATORS = [
  'مطلوب شقة',
  'مطلوب فيلا',
  'بدور على',
  'عايز',
  'محتاج',
  'عميل جاد',
  'client looking',
  'tenant looking',
  'buyer looking',
  'budget',
  'بادجت',
  'لازم',
  'preferably',
  'يشترط',
  'يرغب في',
  'ابحث عن',
  'أبحث عن',
  'ابحث',
  'ابحث',
];

const PRICE_KEYWORDS = [
  'ألف',
  'مليون',
  'جنيه',
  'EGP',
  'LE',
  'جنيهات',
];

export function classifyByContent(message: string): ClassificationResult {
  if (!message || message.trim().length < 5) {
    return {
      classification: 'manual_review',
      confidence: 0,
      triggerWords: [],
      reason: 'Message too short or empty',
    };
  }

  const textLower = message.toLowerCase();
  const triggerWords: string[] = [];
  let supplyScore = 0;
  let demandScore = 0;

  // Step 1: Check for strong supply indicators
  for (const indicator of STRONG_SUPPLY_INDICATORS) {
    if (textLower.includes(indicator.toLowerCase())) {
      triggerWords.push(indicator);
      supplyScore += 10;
    }
  }

  // Step 2: Check for strong demand indicators
  for (const indicator of STRONG_DEMAND_INDICATORS) {
    if (textLower.includes(indicator.toLowerCase())) {
      triggerWords.push(indicator);
      demandScore += 10;
    }
  }

  // Step 3: Special handling for "مطلوب" (tricky word)
  if (textLower.includes('مطلوب')) {
    triggerWords.push('مطلوب');
    
    // Check if "مطلوب" is followed by price (Supply) or specs (Demand)
    const matlubIndex = message.toLowerCase().indexOf('مطلوب');
    const afterMatlub = message.substring(matlubIndex + 6, matlubIndex + 50).toLowerCase();
    
    let hasPrice = false;
    for (const priceKw of PRICE_KEYWORDS) {
      if (afterMatlub.includes(priceKw.toLowerCase())) {
        hasPrice = true;
        break;
      }
    }
    
    if (hasPrice) {
      // "مطلوب X ألف" = asking price = Supply
      supplyScore += 15;
    } else {
      // "مطلوب شقة" = request = Demand
      demandScore += 15;
    }
  }

  // Step 4: Check for property details (Supply indicator)
  const propertyDetails = ['متر', 'م²', 'غرفة', 'غرف', 'حمام', 'دور', 'floor', 'bedroom', 'bathroom'];
  let detailCount = 0;
  for (const detail of propertyDetails) {
    if (textLower.includes(detail.toLowerCase())) {
      detailCount++;
    }
  }
  
  if (detailCount >= 2) {
    supplyScore += 10; // Multiple property details suggest Supply
  }

  // Step 5: Check for budget/request language (Demand indicator)
  const budgetKeywords = ['بادجت', 'budget', 'ميزانية', 'في حدود', 'بحد أقصى'];
  for (const kw of budgetKeywords) {
    if (textLower.includes(kw.toLowerCase())) {
      demandScore += 10;
      triggerWords.push(kw);
    }
  }

  // Step 6: Check for compound/location names (Supply indicator)
  const compounds = ['هايد بارك', 'بالم هيلز', 'جاردينا', 'ماونتن فيو', 'كايرو فيستيفال', 'ستون بارك'];
  for (const compound of compounds) {
    if (textLower.includes(compound.toLowerCase())) {
      supplyScore += 5;
    }
  }

  // Determine classification
  let classification: 'supply' | 'demand' | 'manual_review' = 'manual_review';
  let confidence = 0;

  if (supplyScore > demandScore + 5) {
    classification = 'supply';
    confidence = Math.min(100, supplyScore * 5);
  } else if (demandScore > supplyScore + 5) {
    classification = 'demand';
    confidence = Math.min(100, demandScore * 5);
  } else if (supplyScore === demandScore && supplyScore > 0) {
    // Tie - need manual review
    classification = 'manual_review';
    confidence = 50;
  } else if (supplyScore + demandScore === 0) {
    // No indicators found
    classification = 'manual_review';
    confidence = 0;
  }

  const reason = generateReason(classification, triggerWords, supplyScore, demandScore);

  return {
    classification,
    confidence,
    triggerWords: Array.from(new Set(triggerWords)), // Remove duplicates
    reason,
  };
}

function generateReason(
  classification: string,
  triggerWords: string[],
  supplyScore: number,
  demandScore: number
): string {
  if (classification === 'supply') {
    return `Supply (Score: ${supplyScore}). Indicators: ${triggerWords.slice(0, 3).join(', ')}. Available property with unit details.`;
  } else if (classification === 'demand') {
    return `Demand (Score: ${demandScore}). Indicators: ${triggerWords.slice(0, 3).join(', ')}. Requested property with desired specs.`;
  } else {
    return `Manual Review needed. Supply Score: ${supplyScore}, Demand Score: ${demandScore}. Unclear indicators: ${triggerWords.join(', ')}`;
  }
}

// Test the classifier
export function testClassifier() {
  const testCases = [
    // Supply examples
    'متاح شقة مفروشة للإيجار في الرحاب 1، 136 متر، 2 غرفة، 2 حمام، مطلوب 35 ألف',
    'شقة 90 متر للإيجار... مطلوب 13 ألف',
    'فيلا للبيع في هايد بارك، 500 متر، 5 غرف، 4 حمام، سعر 5 مليون',
    
    // Demand examples
    'مطلوب شقة للإيجار في الرحاب 2، 3 غرف، بادجت 30 ألف',
    'محتاجة شقة فى التجمع ٣ نوم نص تشطيب بادجيت ٥.٥٠٠.٠٠٠ مليون',
    'بدور على فيلا في الشيخ زايد، 4 غرف، بادجت 3 مليون',
    
    // Ambiguous
    'مطلوب',
    'شقة',
  ];

  console.log('🧪 Classifier Test Results:\n');
  for (const testCase of testCases) {
    const result = classifyByContent(testCase);
    console.log(`📝 Message: "${testCase.substring(0, 50)}..."`);
    console.log(`   Classification: ${result.classification}`);
    console.log(`   Confidence: ${result.confidence}%`);
    console.log(`   Reason: ${result.reason}\n`);
  }
}
