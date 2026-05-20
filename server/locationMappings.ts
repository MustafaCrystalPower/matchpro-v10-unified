/**
 * Location Mapping Configuration
 * Maps Arabic/English keywords to standardized locations and broker groups
 */

export interface LocationMapping {
  sheetName: string;
  arabicKeywords: string[];
  englishKeywords: string[];
  compounds: string[];
  whatsappGroup: string;
  brokerRole: string;
}

export const LOCATION_MAPPINGS: Record<string, LocationMapping> = {
  FIFTH_SETTLEMENT: {
    sheetName: "Fifth_Settlement_Only",
    arabicKeywords: ["التجمع الخامس", "القاهرة الجديدة"],
    englishKeywords: ["Fifth Settlement", "New Cairo"],
    compounds: [
      "Hyde Park",
      "Mivida",
      "Marasem",
      "Galleria",
      "Villette",
      "Eastown",
      "Mountain View",
      "Taj Sultan",
      "Palm Hills NC",
      "Lake View",
      "Stone Residence",
      "Cairo Festival",
      "Gardenia",
      "Beit El Watan",
      "Banafseg",
      "Narges",
      "Koronfel",
      "Yasmin",
    ],
    whatsappGroup: "Fifth_Settlement_Brokers",
    brokerRole: "broker_fifth_settlement",
  },
  MADINATY: {
    sheetName: "Madinaty",
    arabicKeywords: ["مدينتي", "مجموعة"],
    englishKeywords: ["Madinaty", "Group"],
    compounds: [
      "B1",
      "B2",
      "B3",
      "B4",
      "B5",
      "B6",
      "B7",
      "B8",
      "B9",
      "B10",
      "B11",
      "B12",
      "B13",
      "B14",
      "B15",
      "Privado",
      "Open Air Mall",
      "East Hub",
      "Craft Zone",
    ],
    whatsappGroup: "Madinaty_Brokers",
    brokerRole: "broker_madinaty",
  },
  REHAB: {
    sheetName: "Rehab",
    arabicKeywords: ["الرحاب", "مرحلة"],
    englishKeywords: ["Rehab", "Phase"],
    compounds: [
      "Phase 1",
      "Phase 2",
      "Phase 3",
      "Phase 4",
      "Phase 5",
      "Phase 6",
      "Phase 7",
      "Phase 8",
      "Phase 9",
      "Phase 10",
      "Market areas",
    ],
    whatsappGroup: "Rehab_Brokers",
    brokerRole: "broker_rehab",
  },
  SHEIKH_ZAYED: {
    sheetName: "Sheikh_Zayed",
    arabicKeywords: ["زايد", "الشيخ زايد"],
    englishKeywords: ["Zayed", "Sheikh Zayed"],
    compounds: [
      "Zayed Dunes",
      "Beverly Hills",
      "Allegria",
      "Casa",
      "Sodic West",
      "Palm Hills October",
    ],
    whatsappGroup: "Zayed_Brokers",
    brokerRole: "broker_zayed",
  },
  NORTH_COAST: {
    sheetName: "North_Coast",
    arabicKeywords: ["ساحل", "مارينا", "راس الحكمة"],
    englishKeywords: ["Coast", "Marina", "Ras El Hekma"],
    compounds: [
      "Marina",
      "Hacienda",
      "Fouka Bay",
      "Marassi",
      "Telal",
      "Almaza Bay",
      "Jefaira",
    ],
    whatsappGroup: "NorthCoast_Brokers",
    brokerRole: "broker_north_coast",
  },
  NASR_CITY: {
    sheetName: "Nasr_City",
    arabicKeywords: ["مدينة نصر", "نصر"],
    englishKeywords: ["Nasr City", "Nasr"],
    compounds: [
      "Abbas El Akkad",
      "Makram Ebeid",
      "Mostafa El Nahas",
    ],
    whatsappGroup: "NasrCity_Brokers",
    brokerRole: "broker_nasr_city",
  },
  MADINET_NOUR: {
    sheetName: "Madinet_Nour",
    arabicKeywords: ["مدينة نور", "نور"],
    englishKeywords: ["Madinet Nour", "Noor"],
    compounds: [
      "Nour Phase 1",
      "Nour Phase 2",
      "Nour Phase 3",
      "Nour Phase 4",
      "Nour Phase 5",
    ],
    whatsappGroup: "MadinetNour_Brokers",
    brokerRole: "broker_madinet_nour",
  },
  ADMIN_CAPITAL: {
    sheetName: "Admin_Capital",
    arabicKeywords: ["العاصمة الإدارية", "العاصمة"],
    englishKeywords: ["Administrative Capital", "New Capital"],
    compounds: [
      "R5",
      "R7",
      "R8",
      "MU districts",
      "Downtown",
    ],
    whatsappGroup: "AdminCapital_Brokers",
    brokerRole: "broker_admin_capital",
  },
  NEW_CAIRO_OTHER: {
    sheetName: "New_Cairo_Other",
    arabicKeywords: ["القاهرة الجديدة"],
    englishKeywords: ["New Cairo"],
    compounds: ["All other New Cairo areas"],
    whatsappGroup: "NewCairo_Brokers",
    brokerRole: "broker_new_cairo",
  },
  OTHER_AREAS: {
    sheetName: "Other_Areas",
    arabicKeywords: ["أخرى"],
    englishKeywords: ["Other"],
    compounds: ["All remaining locations"],
    whatsappGroup: "General_Brokers",
    brokerRole: "broker_general",
  },
};

/**
 * Normalize location string to standardized location key
 */
export function normalizeLocationToKey(location: string): string {
  if (!location) return "OTHER_AREAS";

  const normalized = location.toLowerCase().trim();

  // Check each mapping
  for (const [key, mapping] of Object.entries(LOCATION_MAPPINGS)) {
    // Check Arabic keywords
    for (const keyword of mapping.arabicKeywords) {
      if (normalized.includes(keyword.toLowerCase())) {
        return key;
      }
    }

    // Check English keywords
    for (const keyword of mapping.englishKeywords) {
      if (normalized.includes(keyword.toLowerCase())) {
        return key;
      }
    }

    // Check compounds
    for (const compound of mapping.compounds) {
      if (normalized.includes(compound.toLowerCase())) {
        return key;
      }
    }
  }

  return "OTHER_AREAS";
}

/**
 * Get location display name (Arabic + English)
 */
export function getLocationDisplayName(locationKey: string): {
  arabic: string;
  english: string;
} {
  const mapping = LOCATION_MAPPINGS[locationKey];
  if (!mapping) {
    return { arabic: "مناطق أخرى", english: "Other Areas" };
  }

  return {
    arabic: mapping.arabicKeywords[0] || "مناطق أخرى",
    english: mapping.englishKeywords[0] || "Other Areas",
  };
}

/**
 * Get WhatsApp group for location
 */
export function getWhatsappGroupForLocation(locationKey: string): string {
  return LOCATION_MAPPINGS[locationKey]?.whatsappGroup || "General_Brokers";
}

/**
 * Get all location keys
 */
export function getAllLocationKeys(): string[] {
  return Object.keys(LOCATION_MAPPINGS);
}

/**
 * Get all WhatsApp groups
 */
export function getAllWhatsappGroups(): string[] {
  return Array.from(new Set(Object.values(LOCATION_MAPPINGS).map((m) => m.whatsappGroup)));
}
