/**
 * Secure Report Generator
 * Generates location-based Excel reports with watermarking and expiring links
 */

import ExcelJS from "exceljs";
const { Workbook } = ExcelJS;
import crypto from "crypto";
import { storagePut, storageGet } from "./storage";
import { LOCATION_MAPPINGS, normalizeLocationToKey, getLocationDisplayName } from "./locationMappings";

interface DemandRecord {
  id: number;
  propertyType: string;
  location: string;
  bedrooms?: number;
  bathrooms?: number;
  sizeMin?: number;
  sizeMax?: number;
  priceMin?: number;
  priceMax?: number;
  purpose: "sale" | "rent";
  contactName: string;
  contact: string;
  requirements?: string;
  createdAt: string;
  normalizedLocation: string;
}

/**
 * Generate secure Excel report for a specific location
 */
export async function generateSecureLocationReport(
  locationKey: string,
  demands: DemandRecord[],
  reportDate: Date
): Promise<{
  excelBuffer: Buffer;
  reportId: string;
  expiresAt: Date;
  secureUrl: string;
}> {
  const mapping = LOCATION_MAPPINGS[locationKey];
  if (!mapping) throw new Error(`Invalid location key: ${locationKey}`);

  // Create workbook
  const workbook = new Workbook();
  const worksheet = workbook.addWorksheet(mapping.sheetName);

  // Add header with branding
  worksheet.mergeCells("A1:L1");
  const headerCell = worksheet.getCell("A1");
  headerCell.value = `MatchPro™ - ${getLocationDisplayName(locationKey).english}`;
  headerCell.font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
  headerCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } };
  headerCell.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(1).height = 30;

  // Add report metadata
  worksheet.mergeCells("A2:L2");
  const metaCell = worksheet.getCell("A2");
  metaCell.value = `Report Date: ${reportDate.toLocaleDateString()} | Total Demands: ${demands.length}`;
  metaCell.font = { size: 10, italic: true, color: { argb: "FF6B7280" } };
  metaCell.alignment = { horizontal: "center" };

  // Add watermark (diagonal text across sheet)
  const watermarkRow = worksheet.getRow(3);
  watermarkRow.height = 200;
  worksheet.mergeCells("A3:L3");
  const watermarkCell = worksheet.getCell("A3");
  watermarkCell.value = "CONFIDENTIAL - DO NOT SHARE";
  watermarkCell.font = { size: 48, bold: true, color: { argb: "20000000" } }; // 20% opacity black
  watermarkCell.alignment = { horizontal: "center", vertical: "middle" };

  // Add column headers (row 5)
  const headers = [
    "ID",
    "Property Type",
    "Location",
    "Bedrooms",
    "Bathrooms",
    "Size (m²)",
    "Price Min",
    "Price Max",
    "Purpose",
    "Contact Name",
    "Contact",
    "Requirements",
    "Date",
  ];

  headers.forEach((header, index) => {
    const cell = worksheet.getCell(5, index + 1);
    cell.value = header;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF374151" } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });

  // Add demand data (starting row 6)
  demands.forEach((demand, index) => {
    const row = 6 + index;
    worksheet.getCell(row, 1).value = demand.id;
    worksheet.getCell(row, 2).value = demand.propertyType;
    worksheet.getCell(row, 3).value = demand.location;
    worksheet.getCell(row, 4).value = demand.bedrooms || "N/A";
    worksheet.getCell(row, 5).value = demand.bathrooms || "N/A";
    worksheet.getCell(row, 6).value = demand.sizeMin || "N/A";
    worksheet.getCell(row, 7).value = demand.priceMin ? `${demand.priceMin.toLocaleString()} EGP` : "N/A";
    worksheet.getCell(row, 8).value = demand.priceMax ? `${demand.priceMax.toLocaleString()} EGP` : "N/A";
    worksheet.getCell(row, 9).value = demand.purpose === "sale" ? "For Sale" : "For Rent";
    worksheet.getCell(row, 10).value = demand.contactName;
    worksheet.getCell(row, 11).value = maskPhoneNumber(demand.contact);
    worksheet.getCell(row, 12).value = demand.requirements || "N/A";
    worksheet.getCell(row, 13).value = new Date(demand.createdAt).toLocaleDateString();

    // Alternate row colors for readability
    if (index % 2 === 0) {
      for (let col = 1; col <= 13; col++) {
        worksheet.getCell(row, col).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF9FAFB" },
        };
      }
    }
  });

  // Set column widths
  worksheet.columns = [
    { width: 8 },
    { width: 12 },
    { width: 15 },
    { width: 10 },
    { width: 10 },
    { width: 10 },
    { width: 12 },
    { width: 12 },
    { width: 10 },
    { width: 15 },
    { width: 12 },
    { width: 20 },
    { width: 12 },
  ];

  // Freeze header rows
  worksheet.views = [{ state: "frozen", ySplit: 5 }];

  // Add protection to prevent editing (optional)
  worksheet.protect("matchpro2026", {
    selectLockedCells: true,
    selectUnlockedCells: true,
    formatCells: false,
    formatColumns: false,
    formatRows: false,
    insertColumns: false,
    insertRows: false,
    insertHyperlinks: false,
    deleteColumns: false,
    deleteRows: false,
    sort: true,
    autoFilter: true,
    pivotTables: false,
    objects: false,
    scenarios: false,
    
  });

  // Generate Excel buffer
  const excelBuffer = (await workbook.xlsx.writeBuffer()) as unknown as Buffer;

  // Generate secure report ID and expiration
  const reportId = crypto.randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  // Upload to S3
  const fileKey = `reports/${locationKey}/${reportId}.xlsx`;
  const { url: secureUrl } = await storagePut(fileKey, excelBuffer, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

  return {
    excelBuffer,
    reportId,
    expiresAt,
    secureUrl,
  };
}

/**
 * Mask phone number - show only last 4 digits
 */
export function maskPhoneNumber(phone: string): string {
  if (!phone || phone.length < 4) return "****";
  return `****${phone.slice(-4)}`;
}

/**
 * Generate OTP for contact reveal
 */
export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Verify OTP (in production, would check against stored OTP)
 */
export function verifyOTP(inputOtp: string, storedOtp: string): boolean {
  return inputOtp === storedOtp;
}

/**
 * Generate WhatsApp message template for location report
 */
export function generateWhatsappMessage(
  locationKey: string,
  demandsCount: number,
  apartmentCount: number,
  villaCount: number,
  chaletCount: number,
  secureLink: string,
  otpCode: string
): string {
  const { arabic, english } = getLocationDisplayName(locationKey);

  return `🏠 *MatchPro™ ${english}* ━━━━━━━━━━━━━━━━━━
📅 Date: ${new Date().toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" })}
⏰ Time: ${new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })} (Cairo)
📊 Total Demands: ${demandsCount}
🏠 Apartments: ${apartmentCount} | 🏡 Villas: ${villaCount}${chaletCount > 0 ? ` | 🏖️ Chalets: ${chaletCount}` : ""}
━━━━━━━━━━━━━━━━━━
🔐 *Secure Access:* ${secureLink}
🔑 *PIN:* ${otpCode}
⚠️ Expires in 15 minutes
━━━━━━━━━━━━━━━━━━
⛔ Do not share | 📵 Screenshots disabled`;
}

/**
 * Count property types in demands
 */
export function countPropertyTypes(demands: DemandRecord[]): {
  apartments: number;
  villas: number;
  chalets: number;
  other: number;
} {
  return {
    apartments: demands.filter((d) => d.propertyType.toLowerCase() === "apartment").length,
    villas: demands.filter((d) => d.propertyType.toLowerCase() === "villa").length,
    chalets: demands.filter((d) => d.propertyType.toLowerCase() === "chalet").length,
    other: demands.filter(
      (d) =>
        !["apartment", "villa", "chalet"].includes(d.propertyType.toLowerCase())
    ).length,
  };
}
