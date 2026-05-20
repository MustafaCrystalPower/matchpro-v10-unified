import ExcelJS from "exceljs";
import { getDb } from "./db";
import { demand } from "../drizzle/schema";
import { sql } from "drizzle-orm";

const AREAS = [
  "التجمع الخامس",
  "مدينتي",
  "الرحاب",
  "القاهرة الجديدة",
  "الشروق",
  "بدر",
  "العبور",
  "القطامية",
  "الشيخ زايد",
  "6 أكتوبر",
];

interface DemandLead {
  id: number;
  senderName: string;
  senderPhone: string;
  area: string;
  propertyType: string;
  purpose: string;
  budgetMin: number | null;
  budgetMax: number | null;
  rooms: number | null;
  size: number | null;
  details: string;
  createdAt: Date;
}

export async function generateAreaBasedExcelReports() {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const reports: { area: string; buffer: Buffer }[] = [];

  for (const area of AREAS) {
    const leads = await db
      .select()
      .from(demand)
      .where(sql`location LIKE ${"%" + area + "%"}`);

    if (leads.length === 0) continue;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(area.substring(0, 31)); // Excel sheet name limit

    // Header row with styling
    const headers = [
      "Lead ID",
      "Client Name",
      "Phone",
      "Area",
      "Property Type",
      "Purpose",
      "Budget Min",
      "Budget Max",
      "Rooms",
      "Size (m²)",
      "Details",
      "Date",
    ];

    const headerRow = worksheet.addRow(headers);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1F4E78" },
    };
    headerRow.alignment = { horizontal: "center" as any, vertical: "middle" as any };

    // Data rows with alternating colors
    leads.forEach((lead, index) => {
      const row = worksheet.addRow([
        `MP-${lead.id}`,
        lead.contactName || "N/A",
        lead.contact || "N/A",
        lead.location || area,
        lead.propertyType || "N/A",
        lead.purpose || "N/A",
        lead.priceMin ? `${lead.priceMin} EGP` : "N/A",
        lead.priceMax ? `${lead.priceMax} EGP` : "N/A",
        lead.bedrooms || "N/A",
        lead.sizeMax ? `${lead.sizeMax} m²` : "N/A",
        lead.requirements ? JSON.stringify(lead.requirements) : "N/A",
        new Date(lead.createdAt).toLocaleDateString("ar-EG"),
      ]);

      // Alternating row colors
      if (index % 2 === 0) {
        row.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF2F2F2" },
        };
      }

      row.alignment = { horizontal: "left", vertical: "top", wrapText: true };
    });

    // Auto-fit columns
    worksheet.columns.forEach((column) => {
      let maxLength = 0;
      column.eachCell?.({ includeEmpty: true }, (cell) => {
        const cellLength = cell.value?.toString().length || 0;
        if (cellLength > maxLength) maxLength = cellLength;
      });
      column.width = Math.min(maxLength + 2, 50);
    });

    // Freeze header row
    worksheet.views = [{ state: "frozen", ySplit: 1 }];

    // Add summary section
    const summaryRow = worksheet.addRow([]);
    summaryRow.height = 5;

    const summaryHeaderRow = worksheet.addRow([
      `Summary for ${area}`,
      `Total Leads: ${leads.length}`,
    ]);
    summaryHeaderRow.font = { bold: true, size: 12 };
    summaryHeaderRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFFE699" },
    };

    const buffer = await workbook.xlsx.writeBuffer();
    reports.push({ area, buffer: buffer as any });
  }

  return reports;
}

export async function generateSingleAreaExcelReport(area: string) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const leads = await db
    .select()
    .from(demand)
    .where(sql`location LIKE ${"%" + area + "%"}`);

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(area.substring(0, 31));

  // Header row
  const headers = [
    "Lead ID",
    "Client Name",
    "Phone",
    "Area",
    "Property Type",
    "Purpose",
    "Budget Min",
    "Budget Max",
    "Rooms",
    "Size (m²)",
    "Details",
    "Date",
  ];

  const headerRow = worksheet.addRow(headers);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1F4E78" },
  };

  // Data rows
  leads.forEach((lead, index) => {
    const row = worksheet.addRow([
      `MP-${lead.id}`,
      lead.contactName || "N/A",
      lead.contact || "N/A",
      lead.location || area,
      lead.propertyType || "N/A",
      lead.purpose || "N/A",
      lead.priceMin ? `${lead.priceMin} EGP` : "N/A",
      lead.priceMax ? `${lead.priceMax} EGP` : "N/A",
      lead.bedrooms || "N/A",
      lead.sizeMax ? `${lead.sizeMax} m²` : "N/A",
      lead.requirements ? JSON.stringify(lead.requirements) : "N/A",
      new Date(lead.createdAt).toLocaleDateString("ar-EG"),
    ]);

    if (index % 2 === 0) {
      row.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF2F2F2" },
      };
    }
  });

  // Auto-fit columns
  worksheet.columns.forEach((column) => {
    let maxLength = 0;
    column.eachCell?.({ includeEmpty: true }, (cell) => {
      const cellLength = cell.value?.toString().length || 0;
      if (cellLength > maxLength) maxLength = cellLength;
    });
    column.width = Math.min(maxLength + 2, 50);
  });

  worksheet.views = [{ state: "frozen", ySplit: 1 }];

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as unknown as Buffer;
}
