/**
 * Excel Asset Parser - Handles bulk asset import from Excel files
 * Supports field mapping, validation, and duplicate detection
 */

import * as XLSX from "xlsx";

export interface AssetRow {
  propertyType: string;
  location: string;
  area?: string;
  size?: number;
  bedrooms?: number;
  bathrooms?: number;
  price: number;
  priceType: "sale" | "rent";
  rentalPeriod?: "monthly" | "yearly";
  description?: string;
  contactName?: string;
  contactPhone?: string;
}

export interface FieldMapping {
  propertyType?: string;
  location?: string;
  area?: string;
  size?: string;
  bedrooms?: string;
  bathrooms?: string;
  price?: string;
  priceType?: string;
  rentalPeriod?: string;
  description?: string;
  contactName?: string;
  contactPhone?: string;
}

/**
 * Parse Excel file and extract asset data
 */
export function parseExcelAssets(
  buffer: Buffer,
  mapping: FieldMapping
): AssetRow[] {
  try {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(worksheet);

    return data.map((row: any) => {
      const asset: AssetRow = {
        propertyType: row[mapping.propertyType || "Property Type"] || "Apartment",
        location: normalizeArea(row[mapping.location || "Location"] || ""),
        area: row[mapping.area || "Area"],
        size: parseFloat(row[mapping.size || "Size"]) || undefined,
        bedrooms: parseInt(row[mapping.bedrooms || "Bedrooms"]) || undefined,
        bathrooms: parseInt(row[mapping.bathrooms || "Bathrooms"]) || undefined,
        price: parseFloat(row[mapping.price || "Price"]) || 0,
        priceType: (row[mapping.priceType || "Type"] || "sale").toLowerCase() as "sale" | "rent",
        rentalPeriod: row[mapping.rentalPeriod || "Rental Period"] || undefined,
        description: row[mapping.description || "Description"] || undefined,
        contactName: row[mapping.contactName || "Contact Name"] || undefined,
        contactPhone: row[mapping.contactPhone || "Contact Phone"] || undefined,
      };

      return asset;
    });
  } catch (error) {
    console.error("[ExcelParser] Error parsing file:", error);
    throw new Error("Failed to parse Excel file");
  }
}

/**
 * Detect field mapping from Excel headers
 * Returns suggested mapping based on header similarity
 */
export function detectFieldMapping(buffer: Buffer): FieldMapping {
  try {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const headers = XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0] as string[];

    const mapping: FieldMapping = {};
    const fieldKeywords = {
      propertyType: ["type", "property", "نوع"],
      location: ["location", "area", "منطقة", "موقع"],
      size: ["size", "area", "sqm", "متر"],
      bedrooms: ["bed", "rooms", "غرف"],
      bathrooms: ["bath", "toilet", "حمام"],
      price: ["price", "cost", "سعر"],
      priceType: ["sale", "rent", "نوع"],
      contactName: ["name", "contact", "اسم"],
      contactPhone: ["phone", "mobile", "رقم"],
    };

    headers.forEach((header) => {
      const lowerHeader = header.toLowerCase();
      Object.entries(fieldKeywords).forEach(([field, keywords]) => {
        if (keywords.some((kw) => lowerHeader.includes(kw))) {
          mapping[field as keyof FieldMapping] = header;
        }
      });
    });

    return mapping;
  } catch (error) {
    console.error("[ExcelParser] Error detecting mapping:", error);
    return {};
  }
}

/**
 * Normalize Arabic area names to standard format
 * Handles common variations and abbreviations
 */
export function normalizeArea(area: string): string {
  if (!area) return "";

  const normalizations: Record<string, string> = {
    "التجمع": "التجمع الخامس",
    "التجمع الخامس": "التجمع الخامس",
    "new cairo": "التجمع الخامس",
    "maadi": "المعادي",
    "المعادي": "المعادي",
    "heliopolis": "مصر الجديدة",
    "مصر الجديدة": "مصر الجديدة",
    "zamalek": "الزمالك",
    "الزمالك": "الزمالك",
    "giza": "الجيزة",
    "الجيزة": "الجيزة",
    "nasr city": "مدينة نصر",
    "مدينة نصر": "مدينة نصر",
    "6 october": "6 أكتوبر",
    "6 أكتوبر": "6 أكتوبر",
    "sheikh zayed": "الشيخ زايد",
    "الشيخ زايد": "الشيخ زايد",
  };

  const normalized = area.toLowerCase().trim();
  return normalizations[normalized] || area;
}

/**
 * Validate asset data before insertion
 */
export function validateAsset(asset: AssetRow): string[] {
  const errors: string[] = [];

  if (!asset.propertyType || asset.propertyType.trim() === "") {
    errors.push("Property type is required");
  }

  if (!asset.location || asset.location.trim() === "") {
    errors.push("Location is required");
  }

  if (asset.price <= 0) {
    errors.push("Price must be greater than 0");
  }

  if (!["sale", "rent"].includes(asset.priceType)) {
    errors.push("Price type must be 'sale' or 'rent'");
  }

  if (asset.bedrooms && asset.bedrooms < 0) {
    errors.push("Bedrooms cannot be negative");
  }

  if (asset.bathrooms && asset.bathrooms < 0) {
    errors.push("Bathrooms cannot be negative");
  }

  if (asset.size && asset.size <= 0) {
    errors.push("Size must be greater than 0");
  }

  return errors;
}

/**
 * Detect duplicates in asset list
 */
export function detectDuplicates(assets: AssetRow[]): Map<number, number[]> {
  const duplicates = new Map<number, number[]>();

  for (let i = 0; i < assets.length; i++) {
    for (let j = i + 1; j < assets.length; j++) {
      if (
        assets[i].propertyType === assets[j].propertyType &&
        assets[i].location === assets[j].location &&
        assets[i].price === assets[j].price &&
        assets[i].bedrooms === assets[j].bedrooms
      ) {
        if (!duplicates.has(i)) {
          duplicates.set(i, []);
        }
        duplicates.get(i)!.push(j);
      }
    }
  }

  return duplicates;
}
