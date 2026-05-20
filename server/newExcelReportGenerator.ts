import ExcelJS from 'exceljs';
import { getDb, getRecentMatches, getRecentDemand } from './db';
import { storagePut } from './storage';

/**
 * New Excel Report Generator
 * Generates:
 * 1. Matches Sheet (for owner) - High-quality matches only
 * 2. Area Sheets (for brokers) - Demand leads segregated by location with For Sale/For Rent sections
 */

const AREAS = [
  'مدينتي',
  'التجمع الخامس',
  'الرحاب',
  'القاهرة الجديدة',
  'الساحل الشمالي',
  'الشيخ زايد',
  'العاصمة الإدارية',
  'مدينة بدر',
  'الدقي',
  'أخرى',
];

export async function generateNewReports() {
  const workbook = new ExcelJS.Workbook();

  // Add Matches Sheet
  await addMatchesSheet(workbook);

  // Add Area Sheets
  for (const area of AREAS) {
    await addAreaSheet(workbook, area);
  }

  // Add branding and metadata
  addBranding(workbook);

  return workbook;
}

async function addMatchesSheet(workbook: ExcelJS.Workbook) {
  const sheet = workbook.addWorksheet('Matches', {
    pageSetup: { paperSize: 9, orientation: 'landscape' },
  });

  // Header
  const headerRow = sheet.addRow([
    'Seller Name',
    'Seller Phone',
    'Buyer Name',
    'Buyer Phone',
    'Property Type',
    'Budget',
    'Score %',
  ]);

  formatHeaderRow(headerRow);
  sheet.columns = [
    { width: 20 },
    { width: 15 },
    { width: 20 },
    { width: 15 },
    { width: 15 },
    { width: 15 },
    { width: 10 },
  ];

  // Fetch high-quality matches (score >= 75)
  const matches = await getRecentMatches(500);

  // Add data rows
  for (const match of matches) {
    const row = sheet.addRow([
      match.sellerName || '',
      match.sellerPhone || '',
      match.buyerName || '',
      match.buyerPhone || '',
      match.propertyType || '',
      match.budget || '',
      match.score,
    ]);

    formatDataRow(row, match.score);
  }

  // Freeze header
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
}

async function addAreaSheet(workbook: ExcelJS.Workbook, area: string) {
  const sheet = workbook.addWorksheet(area, {
    pageSetup: { paperSize: 9, orientation: 'landscape' },
  });

  // Header
  const headerRow = sheet.addRow([
    'Name',
    'Phone',
    'Property Type',
    'Budget',
    'Time',
    'Original Message',
    'Source',
  ]);

  formatHeaderRow(headerRow);
  sheet.columns = [
    { width: 20 },
    { width: 15 },
    { width: 15 },
    { width: 15 },
    { width: 15 },
    { width: 40 },
    { width: 12 },
  ];

  // Fetch demand leads for this area
  const allDemand = await getRecentDemand(1000);
  const demandLeads = allDemand.filter((d: any) => d.location === area);

  // Separate by purpose (For Sale / For Rent)
  const forSale = demandLeads.filter((d: any) => d.purpose === 'for_sale');
  const forRent = demandLeads.filter((d: any) => d.purpose === 'for_rent');

  let rowIndex = 2; // Start after header

  // Add For Sale Section
  if (forSale.length > 0) {
    const sectionRow = sheet.addRow(['FOR SALE', '', '', '', '', '', '']);
    formatSectionHeader(sectionRow);
    rowIndex++;

    for (const lead of forSale) {
      const budgetRange = lead.priceMin && lead.priceMax 
        ? `${lead.priceMin} - ${lead.priceMax}` 
        : (lead.priceMin ? `${lead.priceMin}+` : 'Flexible');
      const row = sheet.addRow([
        lead.contactName || '',
        lead.contact || '',
        lead.propertyType || '',
        budgetRange,
        lead.createdAt?.toLocaleString('en-EG') || '',
        lead.rawMessageText || '',
        lead.sourceGroup || 'WhatsApp',
      ]);
      formatDataRow(row, 85);
      rowIndex++;
    }
  }

  // Add For Rent Section
  if (forRent.length > 0) {
    const sectionRow = sheet.addRow(['FOR RENT', '', '', '', '', '', '']);
    formatSectionHeader(sectionRow);
    rowIndex++;

    for (const lead of forRent) {
      const budgetRange = lead.priceMin && lead.priceMax 
        ? `${lead.priceMin} - ${lead.priceMax}` 
        : (lead.priceMin ? `${lead.priceMin}+` : 'Flexible');
      const row = sheet.addRow([
        lead.contactName || '',
        lead.contact || '',
        lead.propertyType || '',
        budgetRange,
        lead.createdAt?.toLocaleString('en-EG') || '',
        lead.rawMessageText || '',
        lead.sourceGroup || 'WhatsApp',
      ]);
      formatDataRow(row, 80);
      rowIndex++;
    }
  }

  // Freeze header
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
}

function formatHeaderRow(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
  row.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1F4E78' }, // Dark blue
  };
  row.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  row.height = 25;

  row.eachCell((cell) => {
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
  });
}

function formatSectionHeader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  row.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' }, // Medium blue
  };
  row.alignment = { horizontal: 'left', vertical: 'middle' };
  row.height = 20;

  row.eachCell((cell) => {
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
  });
}

function formatDataRow(row: ExcelJS.Row, confidence: number) {
  // Color code by confidence
  let bgColor = 'FFFFFFFF'; // White
  if (confidence >= 85) {
    bgColor = 'FFC6EFCE'; // Light green
  } else if (confidence >= 75) {
    bgColor = 'FFFFC7CE'; // Light yellow
  }

  row.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: bgColor },
    };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
    cell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true };
  });

  row.height = 30;
}

function addBranding(workbook: ExcelJS.Workbook) {
  // Add metadata
  workbook.creator = 'Crystal Power Investments';
  workbook.created = new Date();
  workbook.modified = new Date();
}

export async function uploadReportToS3(
  workbook: ExcelJS.Workbook,
  reportName: string
): Promise<{ url: string; key: string }> {
  const buffer = await workbook.xlsx.writeBuffer();
  const fileKey = `reports/${reportName}-${Date.now()}.xlsx`;

  return storagePut(fileKey, buffer as unknown as Buffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

export async function generateAndUploadReports() {
  const workbook = await generateNewReports();
  const timestamp = new Date().toISOString().split('T')[0];
  const reportName = `MatchPro_Report_${timestamp}`;

  return uploadReportToS3(workbook, reportName);
}
