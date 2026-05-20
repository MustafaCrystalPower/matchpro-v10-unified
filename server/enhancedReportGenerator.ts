import ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';
import { generateCorrectTemplateReport } from './correctTemplateReportGenerator';
import { getActiveProperties, getActiveBuyerRequests, getPropertiesStats, getBuyerRequestsStats } from './propertiesDb';

const STYLES = {
  headerBg: { fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { rgb: 'FF1F4E78' } } },
  headerFont: { bold: true, color: { rgb: 'FFFFFFFF' }, size: 11 },
  alternateRow: { fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { rgb: 'FFF2F2F2' } } },
  border: { left: { style: 'thin' as const }, right: { style: 'thin' as const }, top: { style: 'thin' as const }, bottom: { style: 'thin' as const } },
  centerAlign: { alignment: { horizontal: 'center' as const, vertical: 'center' as const, wrapText: true } },
  leftAlign: { alignment: { horizontal: 'left' as const, vertical: 'center' as const, wrapText: true } },
};

export async function generateEnhancedReport(): Promise<string> {
  try {
    console.log('📊 Generating enhanced report with Properties and Requests...');

    // Create a new workbook
    const workbook = new ExcelJS.Workbook();

    // Generate the original report first
    const originalReportPath = await generateCorrectTemplateReport();
    const originalWorkbook = new ExcelJS.Workbook();
    await originalWorkbook.xlsx.readFile(originalReportPath);

    // Copy all sheets from original report
    originalWorkbook.worksheets.forEach((sheet) => {
      const newSheet = workbook.addWorksheet(sheet.name);
      sheet.eachRow((row, rowNumber) => {
        const newRow = newSheet.getRow(rowNumber);
        row.eachCell((cell, colNumber) => {
          const newCell = newRow.getCell(colNumber);
          newCell.value = cell.value;
          newCell.style = { ...cell.style };
        });
      });
      newSheet.columns = sheet.columns;
    });

    // Add Properties sheet
    await addPropertiesSheet(workbook);

    // Add Buyer Requests sheet
    await addBuyerRequestsSheet(workbook);

    // Add Summary sheet
    await addSummarySheet(workbook);

    // Save the enhanced report
    const reportPath = `/tmp/MatchPro_Enhanced_Report_${Date.now()}.xlsx`;
    await workbook.xlsx.writeFile(reportPath);

    console.log(`✅ Enhanced report generated: ${reportPath}`);
    return reportPath;
  } catch (error: any) {
    console.error('❌ Error generating enhanced report:', error.message);
    throw error;
  }
}

async function addPropertiesSheet(workbook: ExcelJS.Workbook) {
  try {
    console.log('📝 Adding Properties sheet...');

    const sheet = workbook.addWorksheet('Properties_Listings', { views: [{ state: 'frozen', ySplit: 1 }] });

    // Get properties data
    const properties = await getActiveProperties(2000);
    const stats = await getPropertiesStats();

    // Add header row
    const headers = ['ID', 'Contact Name', 'Phone', 'Property Type', 'Location', 'Price Min (EGP)', 'Price Max (EGP)', 'Bedrooms', 'Bathrooms', 'Status', 'Priority', 'Original Message', 'Created At'];
    const headerRow = sheet.addRow(headers);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

    // Add data rows
    properties.forEach((prop: any, index: number) => {
      const row = sheet.addRow([
        prop.id,
        prop.name,
        prop.phone,
        prop.type,
        prop.location,
        prop.priceMin || '-',
        prop.priceMax || '-',
        prop.bedrooms || '-',
        prop.bathrooms || '-',
        prop.status,
        prop.priority,
        prop.originalMessage || '-',
        new Date(prop.createdAt).toLocaleString(),
      ]);

      if (index % 2 === 0) {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
      }
      row.alignment = { horizontal: 'left', vertical: 'middle' };
    });

    // Set column widths
    sheet.columns = [
      { width: 8 },
      { width: 20 },
      { width: 15 },
      { width: 15 },
      { width: 20 },
      { width: 15 },
      { width: 15 },
      { width: 12 },
      { width: 12 },
      { width: 12 },
      { width: 10 },
      { width: 20 },
    ];

    // Add summary at the bottom
    const summaryRow = sheet.addRow([]);
    sheet.addRow(['SUMMARY', '', '', '', '', '', '', '', '', '', '', '']);
    sheet.addRow(['Total Properties', stats.totalProperties, '', '', '', '', '', '', '', '', '', '']);
    sheet.addRow(['Available', stats.available, '', '', '', '', '', '', '', '', '', '']);
    sheet.addRow(['Matched', stats.matched, '', '', '', '', '', '', '', '', '', '']);
    sheet.addRow(['Pending', stats.pending, '', '', '', '', '', '', '', '', '', '']);

    console.log(`✅ Properties sheet added: ${properties.length} records`);
  } catch (error: any) {
    console.error('❌ Error adding Properties sheet:', error.message);
  }
}

async function addBuyerRequestsSheet(workbook: ExcelJS.Workbook) {
  try {
    console.log('📝 Adding Buyer Requests sheet...');

    const sheet = workbook.addWorksheet('Buyer_Requests', { views: [{ state: 'frozen', ySplit: 1 }] });

    // Get buyer requests data
    const requests = await getActiveBuyerRequests(2000);
    const stats = await getBuyerRequestsStats();

    // Add header row
    const headers = ['ID', 'Contact Name', 'Phone', 'Property Type', 'Location', 'Budget Min (EGP)', 'Budget Max (EGP)', 'Bedrooms', 'Bathrooms', 'Status', 'Priority', 'Original Message', 'Created At'];
    const headerRow = sheet.addRow(headers);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

    // Add data rows
    requests.forEach((req: any, index: number) => {
      const row = sheet.addRow([
        req.id,
        req.name,
        req.phone,
        req.type,
        req.location,
        req.budgetMin || '-',
        req.budgetMax || '-',
        req.bedrooms || '-',
        req.bathrooms || '-',
        req.status,
        req.priority,
        req.originalMessage || '-',
        new Date(req.createdAt).toLocaleString(),
      ]);

      if (index % 2 === 0) {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
      }
      row.alignment = { horizontal: 'left', vertical: 'middle' };
    });

    // Set column widths
    sheet.columns = [
      { width: 8 },
      { width: 20 },
      { width: 15 },
      { width: 15 },
      { width: 20 },
      { width: 15 },
      { width: 15 },
      { width: 12 },
      { width: 12 },
      { width: 12 },
      { width: 10 },
      { width: 20 },
    ];

    // Add summary at the bottom
    sheet.addRow([]);
    sheet.addRow(['SUMMARY', '', '', '', '', '', '', '', '', '', '', '']);
    sheet.addRow(['Total Requests', stats.totalRequests, '', '', '', '', '', '', '', '', '', '']);
    sheet.addRow(['Available', stats.available, '', '', '', '', '', '', '', '', '', '']);
    sheet.addRow(['Matched', stats.matched, '', '', '', '', '', '', '', '', '', '']);
    sheet.addRow(['Pending', stats.pending, '', '', '', '', '', '', '', '', '', '']);

    console.log(`✅ Buyer Requests sheet added: ${requests.length} records`);
  } catch (error: any) {
    console.error('❌ Error adding Buyer Requests sheet:', error.message);
  }
}

async function addSummarySheet(workbook: ExcelJS.Workbook) {
  try {
    console.log('📝 Adding Summary sheet...');

    const sheet = workbook.addWorksheet('Report_Summary');

    // Get statistics
    const propertiesStats = await getPropertiesStats();
    const requestsStats = await getBuyerRequestsStats();

    // Add title
    const titleRow = sheet.addRow(['MatchPro Report Summary']);
    titleRow.font = { bold: true, size: 14 };
    sheet.addRow([]);

    // Add properties summary
    sheet.addRow(['PROPERTIES (Supply)']);
    sheet.addRow(['Total Properties', propertiesStats.totalProperties]);
    sheet.addRow(['Available', propertiesStats.available]);
    sheet.addRow(['Matched', propertiesStats.matched]);
    sheet.addRow(['Pending Review', propertiesStats.pending]);
    sheet.addRow([]);

    // Add requests summary
    sheet.addRow(['BUYER REQUESTS (Demand)']);
    sheet.addRow(['Total Requests', requestsStats.totalRequests]);
    sheet.addRow(['Available', requestsStats.available]);
    sheet.addRow(['Matched', requestsStats.matched]);
    sheet.addRow(['Pending Review', requestsStats.pending]);
    sheet.addRow([]);

    // Add metadata
    sheet.addRow(['Report Generated', new Date().toLocaleString()]);
    sheet.addRow(['Report Type', 'Enhanced Report with Properties & Requests']);

    // Set column widths
    sheet.columns = [{ width: 30 }, { width: 15 }];

    console.log('✅ Summary sheet added');
  } catch (error: any) {
    console.error('❌ Error adding Summary sheet:', error.message);
  }
}
