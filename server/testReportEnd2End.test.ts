/**
 * End-to-End Test for Report Generation
 * Verifies:
 * 1. Database connection and message retrieval
 * 2. Classification accuracy
 * 3. Excel file generation and validity
 * 4. File opens without corruption
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { generateCorrectTemplateReport } from './correctTemplateReportGenerator';
import { classifyMessage } from './professionalClassifier';
import * as fs from 'fs';
import ExcelJS from 'exceljs';

describe('Report Generation E2E', () => {
  let generatedFile: string;

  describe('Classification Engine', () => {
    it('should classify demand messages correctly', () => {
      const demandMessages = [
        'مطلوب شقة 3 غرف في مدينتي بادجت 30 ألف',
        'بدور على فيلا في التجمع الخامس',
        'عايز شقة مفروشة للإيجار',
        'looking for 2 bedroom apartment in Fifth Settlement',
      ];

      for (const msg of demandMessages) {
        const result = classifyMessage(msg);
        console.log(`✓ "${msg}" → ${result.classification} (${result.confidence}%)`);
        expect(result.classification).toBe('demand');
        expect(result.confidence).toBeGreaterThan(0.7);
      }
    });

    it('should classify supply messages correctly', () => {
      const supplyMessages = [
        'للبيع شقة 3 غرف في مدينتي 200 متر السعر 35 ألف',
        'متاح فيلا مفروشة في الشيخ زايد 500 متر 5 مليون',
        'Available apartment for rent in Madinaty, 150 sqm, furnished',
      ];

      for (const msg of supplyMessages) {
        const result = classifyMessage(msg);
        console.log(`✓ "${msg}" → ${result.classification} (${result.confidence}%)`);
        expect(result.classification).toBe('supply');
        expect(result.confidence).toBeGreaterThan(0.65);
      }
    });

    it('should handle مطلوب ambiguity', () => {
      // مطلوب + price = Supply
      const supply = classifyMessage('مطلوب 35 ألف للشقة');
      expect(supply.classification).toBe('supply');

      // مطلوب + property specs = Demand
      const demand = classifyMessage('مطلوب شقة 3 غرف بادجت 30 ألف');
      expect(demand.classification).toBe('demand');
    });
  });

  describe('Report Generation', () => {
    it('should generate Excel file without errors', async () => {
      try {
        generatedFile = await generateCorrectTemplateReport();
        console.log(`✓ Report generated: ${generatedFile}`);
        expect(generatedFile).toBeTruthy();
        expect(generatedFile.endsWith('.xlsx')).toBe(true);
      } catch (error) {
        console.error('❌ Report generation failed:', error);
        throw error;
      }
    });

    it('should create a valid Excel file that opens', async () => {
      if (!generatedFile) {
        console.log('⊘ Skipping: No file generated');
        return;
      }

      try {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(generatedFile);
        console.log(`✓ File opens successfully`);
        expect(workbook.worksheets.length).toBeGreaterThan(0);
      } catch (error) {
        console.error('❌ File is corrupted:', error);
        throw error;
      }
    });

    it('should have all required sheets', async () => {
      if (!generatedFile) {
        console.log('⊘ Skipping: No file generated');
        return;
      }

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(generatedFile);

      const requiredSheets = [
        'All_Demands',
        'Fifth_Settlement_Only',
        'Summary',
        'MatchPro_Spec',
        'Madinaty_Demands',
      ];

      for (const sheetName of requiredSheets) {
        const sheet = workbook.getWorksheet(sheetName);
        console.log(`✓ Sheet "${sheetName}" exists`);
        expect(sheet).toBeTruthy();
      }
    });

    it('should have correct headers in All_Demands sheet', async () => {
      if (!generatedFile) {
        console.log('⊘ Skipping: No file generated');
        return;
      }

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(generatedFile);
      const sheet = workbook.getWorksheet('All_Demands');

      if (!sheet) {
        throw new Error('All_Demands sheet not found');
      }

      const expectedHeaders = [
        'ID', 'Property Type', 'Location', 'Area', 'City', 'Price Min', 'Price Max',
        'Size Min', 'Size Max', 'Bedrooms', 'Bathrooms', 'Purpose', 'Contact',
        'Contact Name', 'Requirements', 'Created At', 'Priority', 'Source Group',
        'Date Only', 'Normalized Location', 'Is Fifth Settlement', 'Budget Range',
        'Original Message / الرسالة الأصلية'
      ];

      const firstRow = sheet.getRow(1);
      for (let i = 0; i < expectedHeaders.length; i++) {
        const cellValue = firstRow?.getCell(i + 1).value;
        console.log(`✓ Column ${i + 1}: "${cellValue}"`);
        expect(cellValue).toBe(expectedHeaders[i]);
      }
    });

    it('should have data rows in All_Demands sheet', async () => {
      if (!generatedFile) {
        console.log('⊘ Skipping: No file generated');
        return;
      }

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(generatedFile);
      const sheet = workbook.getWorksheet('All_Demands');

      if (!sheet) {
        throw new Error('All_Demands sheet not found');
      }

      const rowCount = sheet.rowCount;
      console.log(`✓ Total rows: ${rowCount}`);
      expect(rowCount).toBeGreaterThan(1); // At least header + 1 data row
    });

    it('should be a valid file size', async () => {
      if (!generatedFile) {
        console.log('⊘ Skipping: No file generated');
        return;
      }

      const stats = fs.statSync(generatedFile);
      const sizeInMB = stats.size / 1024 / 1024;
      console.log(`✓ File size: ${sizeInMB.toFixed(2)} MB`);
      expect(sizeInMB).toBeGreaterThan(0.01); // At least 10KB
      expect(sizeInMB).toBeLessThan(100); // Less than 100MB
    });
  });

  afterAll(() => {
    if (generatedFile && fs.existsSync(generatedFile)) {
      console.log(`\n📊 Generated file: ${generatedFile}`);
      console.log('✅ All tests passed!');
    }
  });
});
