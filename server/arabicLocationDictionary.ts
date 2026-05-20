/**
 * Arabic Real Estate Location Dictionary
 * Maps Arabic location codes and compound names to standardized locations
 */

export const ARABIC_LOCATION_PATTERNS = {
  // Madinaty compounds
  madinaty: {
    names: ["مدينتي", "madinaty", "madinati"],
    buildingCodes: ["B1", "B2", "B3", "B4", "B5", "B6", "B7", "B8", "B9", "B10", "B11", "B12", "B13", "B14", "B15"],
    villaCodes: ["V1", "V2", "V3", "V4", "V5", "V6", "V7", "V8", "V9", "V10"],
    normalizedArea: "مدينتي",
    englishName: "Madinaty"
  },
  
  // Fifth Settlement (التجمع الخامس)
  fifthSettlement: {
    names: ["التجمع الخامس", "التجمع 5", "الخامس", "fifth settlement", "5th settlement"],
    buildingCodes: ["B1", "B2", "B3", "B4", "B5", "B6", "B7", "B8", "B9", "B10"],
    normalizedArea: "التجمع الخامس",
    englishName: "Fifth Settlement"
  },
  
  // Al-Rehab
  rehab: {
    names: ["الرحاب", "rehab", "al-rehab"],
    buildingCodes: ["B1", "B2", "B3", "B4", "B5"],
    normalizedArea: "الرحاب",
    englishName: "Al-Rehab"
  },
  
  // New Cairo
  newCairo: {
    names: ["القاهرة الجديدة", "new cairo", "القاهرة الجديده", "التجمع الأول"],
    buildingCodes: ["B1", "B2", "B3"],
    normalizedArea: "القاهرة الجديدة",
    englishName: "New Cairo"
  },
  
  // Al-Shorouk
  shorouk: {
    names: ["الشروق", "shorouk", "al-shorouk"],
    buildingCodes: ["B1", "B2", "B3"],
    normalizedArea: "الشروق",
    englishName: "Al-Shorouk"
  },
  
  // North Coast
  northCoast: {
    names: ["الساحل الشمالي", "north coast", "الساحل", "north coast egypt"],
    normalizedArea: "الساحل الشمالي",
    englishName: "North Coast"
  },
  
  // Sheikh Zayed
  sheikhZayed: {
    names: ["الشيخ زايد", "sheikh zayed", "الشيخ زايد city"],
    normalizedArea: "الشيخ زايد",
    englishName: "Sheikh Zayed"
  },
  
  // 6th of October
  sixthOctober: {
    names: ["السادس من أكتوبر", "6 october", "october 6", "السادس اكتوبر"],
    normalizedArea: "السادس من أكتوبر",
    englishName: "6th of October"
  },
  
  // Helwan
  helwan: {
    names: ["حلوان", "helwan", "helwan cairo"],
    normalizedArea: "حلوان",
    englishName: "Helwan"
  },
  
  // Nasr City
  nasrCity: {
    names: ["مدينة نصر", "nasr city", "nasr city cairo"],
    normalizedArea: "مدينة نصر",
    englishName: "Nasr City"
  }
};

/**
 * Extract location from Arabic message
 * Looks for compound names and building codes
 */
export function extractLocationFromArabicMessage(message: string): {
  area: string | null;
  buildingCode: string | null;
  confidence: number;
} {
  const lowerMessage = message.toLowerCase();
  const arabicMessage = message;

  // Check each location pattern
  for (const [key, location] of Object.entries(ARABIC_LOCATION_PATTERNS)) {
    // Check Arabic names
    for (const name of location.names) {
      if (arabicMessage.includes(name) || lowerMessage.includes(name.toLowerCase())) {
        // Check for building codes
        let buildingCode = null;
        let confidence = 0.7; // Base confidence for compound name match

        if ('buildingCodes' in location && location.buildingCodes) {
          for (const code of location.buildingCodes) {
            if (message.includes(code)) {
              buildingCode = code;
              confidence = 0.95; // High confidence with building code
              break;
            }
          }
        }

        if ('villaCodes' in location && location.villaCodes) {
          for (const code of location.villaCodes) {
            if (message.includes(code)) {
              buildingCode = code;
              confidence = 0.95; // High confidence with villa code
              break;
            }
          }
        }

        return {
          area: location.normalizedArea,
          buildingCode,
          confidence
        };
      }
    }
  }

  // If no location found
  return {
    area: null,
    buildingCode: null,
    confidence: 0
  };
}

/**
 * Normalize location string to standard format
 */
export function normalizeLocation(location: string | null): string {
  if (!location) return "Unknown";

  const lowerLocation = location.toLowerCase();

  for (const [key, locationData] of Object.entries(ARABIC_LOCATION_PATTERNS)) {
    for (const name of locationData.names) {
      if (lowerLocation.includes(name.toLowerCase())) {
        return locationData.normalizedArea;
      }
    }
  }

  return location; // Return as-is if no match
}

/**
 * Get all available locations
 */
export function getAllLocations(): string[] {
  return Object.values(ARABIC_LOCATION_PATTERNS).map(loc => loc.normalizedArea);
}

/**
 * Get location by English name
 */
export function getLocationByEnglishName(englishName: string): string | null {
  for (const location of Object.values(ARABIC_LOCATION_PATTERNS)) {
    if (location.englishName.toLowerCase() === englishName.toLowerCase()) {
      return location.normalizedArea;
    }
  }
  return null;
}
