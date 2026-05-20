/**
 * Comprehensive End-to-End Test Suite
 * Tests all systems: classification, report generation, scheduling, and delivery
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { classifyMessage } from './professionalClassifier';
import { generateCorrectTemplateReport } from './correctTemplateReportGenerator';
import { getRecentMessages, getRecentSupply, getRecentDemand, getRecentMatches } from './db';
import { startReportScheduler, stopReportScheduler, runReportGeneration, getSchedulerStatus } from './reportSchedulerNew';
import * as fs from 'fs';
import ExcelJS from 'exceljs';

describe('Comprehensive End-to-End Test Suite', () => {
  let generatedReportPath: string;

  describe('Phase 1: Message Classification', () => {
    it('should classify real messages from database', async () => {
      const messages = await getRecentMessages(50);
      console.log(`\n📨 Testing ${messages.length} real messages from database`);

      let demandCount = 0;
      let supplyCount = 0;

      for (const msg of messages) {
        if (msg.content && msg.content.length > 0) {
          const result = classifyMessage(msg.content);
          if (result.classification === 'demand') demandCount++;
          if (result.classification === 'supply') supplyCount++;
        }
      }

      console.log(`✓ Classified ${demandCount} demands and ${supplyCount} supplies`);
      expect(demandCount + supplyCount).toBeGreaterThan(0);
    });

    it('should handle Arabic and English mixed messages', async () => {
      const testCases = [
        { text: 'مطلوب شقة 3 غرف في مدينتي', expected: 'demand' },
        { text: 'للبيع فيلا 500 متر الشيخ زايد 5 مليون', expected: 'supply' },
        { text: 'Looking for apartment in Fifth Settlement', expected: 'demand' },
        { text: 'Available villa for sale in Madinaty', expected: 'supply' },
      ];

      for (const testCase of testCases) {
        const result = classifyMessage(testCase.text);
        console.log(`✓ "${testCase.text}" → ${result.classification}`);
        expect(result.classification).toBe(testCase.expected);
      }
    });

    it('should resolve Arabic ambiguity correctly', async () => {
      const ambiguousCases = [
        { text: 'مطلوب 35 ألف للشقة', expected: 'supply' },
        { text: 'مطلوب شقة 3 غرف', expected: 'demand' },
        { text: 'عايز فيلا في التجمع', expected: 'demand' },
      ];

      for (const testCase of ambiguousCases) {
        const result = classifyMessage(testCase.text);
        console.log(`✓ "${testCase.text}" → ${result.classification}`);
        expect(result.classification).toBe(testCase.expected);
      }
    });
  });

  describe('Phase 2: Data Extraction Accuracy', () => {
    it('should extract supply data accurately', async () => {
      const supply = await getRecentSupply(100);
      console.log(`\n🏠 Extracted ${supply.length} supply listings`);

      const withDetails = supply.filter(s => s.propertyType && s.location && s.price);
      console.log(`✓ Complete details: ${withDetails.length}/${supply.length}`);

      if (withDetails.length > 0) {
        const sample = withDetails[0];
        console.log(`  Sample: ${sample.propertyType} at ${sample.location} - ${sample.price} EGP`);
      }

      expect(withDetails.length).toBeGreaterThan(0);
    });

    it('should extract demand data accurately', async () => {
      const demand = await getRecentDemand(100);
      console.log(`\n👥 Extracted ${demand.length} demand listings`);

      const withDetails = demand.filter(d => d.propertyType && d.location);
      console.log(`✓ Complete details: ${withDetails.length}/${demand.length}`);

      if (withDetails.length > 0) {
        const sample = withDetails[0];
        console.log(`  Sample: ${sample.propertyType} at ${sample.location}`);
      }

      expect(withDetails.length).toBeGreaterThan(0);
    });

    it('should extract location data correctly', async () => {
      const supply = await getRecentSupply(200);
      const locations = new Set(supply.map(s => s.location).filter(Boolean));
      console.log(`\n📍 Unique locations: ${Array.from(locations).join(', ')}`);
      expect(locations.size).toBeGreaterThan(0);
    });

    it('should extract price ranges accurately', async () => {
      const supply = await getRecentSupply(200);
      const withPrices = supply.filter(s => s.price && s.price > 0);

      if (withPrices.length > 0) {
        const prices = withPrices.map(s => s.price as number);
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;

        console.log(`\n💰 Price Analysis:`);
        console.log(`  Min: ${minPrice.toFixed(0)} EGP`);
        console.log(`  Max: ${maxPrice.toFixed(0)} EGP`);
        console.log(`  Avg: ${avgPrice.toFixed(0)} EGP`);
      }

      expect(withPrices.length).toBeGreaterThan(0);
    });
  });

  describe('Phase 3: Excel Report Generation', () => {
    it('should generate Excel report successfully', async () => {
      console.log(`\n📊 Generating Excel report...`);
      generatedReportPath = await generateCorrectTemplateReport();
      console.log(`✓ Report generated: ${generatedReportPath}`);

      expect(generatedReportPath).toBeTruthy();
      expect(generatedReportPath.endsWith('.xlsx')).toBe(true);
      expect(fs.existsSync(generatedReportPath)).toBe(true);
    });

    it('should have correct file size', async () => {
      const stats = fs.statSync(generatedReportPath);
      const sizeInMB = stats.size / 1024 / 1024;
      console.log(`✓ File size: ${sizeInMB.toFixed(2)} MB`);

      expect(sizeInMB).toBeGreaterThan(0.01);
      expect(sizeInMB).toBeLessThan(100);
    });

    it('should have all required sheets', async () => {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(generatedReportPath);

      const requiredSheets = [
        'All_Demands',
        'Fifth_Settlement_Only',
        'Summary',
        'MatchPro_Spec',
      ];

      console.log(`✓ Total sheets: ${workbook.worksheets.length}`);

      for (const sheetName of requiredSheets) {
        const sheet = workbook.getWorksheet(sheetName);
        console.log(`  ✓ "${sheetName}" exists`);
        expect(sheet).toBeTruthy();
      }
    });

    it('should have correct column headers', async () => {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(generatedReportPath);
      const sheet = workbook.getWorksheet('All_Demands');

      const expectedHeaders = [
        'ID', 'Property Type', 'Location', 'Area', 'City', 'Price Min', 'Price Max',
        'Size Min', 'Size Max', 'Bedrooms', 'Bathrooms', 'Purpose', 'Contact',
        'Contact Name', 'Requirements', 'Created At', 'Priority', 'Source Group',
        'Date Only', 'Normalized Location', 'Is Fifth Settlement', 'Budget Range',
        'Original Message / الرسالة الأصلية'
      ];

      const firstRow = sheet?.getRow(1);
      for (let i = 0; i < expectedHeaders.length; i++) {
        const cellValue = firstRow?.getCell(i + 1).value;
        console.log(`  ✓ Column ${i + 1}: "${cellValue}"`);
        expect(cellValue).toBe(expectedHeaders[i]);
      }
    });

    it('should have data rows', async () => {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(generatedReportPath);
      const sheet = workbook.getWorksheet('All_Demands');

      const rowCount = sheet?.rowCount || 0;
      console.log(`✓ Total rows: ${rowCount}`);
      expect(rowCount).toBeGreaterThan(1);
    });
  });

  describe('Phase 4: Matches Data', () => {
    it('should have match records', async () => {
      const matches = await getRecentMatches(100);
      console.log(`\n🔗 Found ${matches.length} match records`);
      expect(Array.isArray(matches)).toBe(true);
    });

    it('should have valid match scores', async () => {
      const matches = await getRecentMatches(100);
      if (matches.length > 0) {
        const validScores = matches.filter(m => m.matchScore >= 0 && m.matchScore <= 100);
        console.log(`✓ Valid match scores: ${validScores.length}/${matches.length}`);
        expect(validScores.length).toBe(matches.length);
      }
    });
  });

  describe('Phase 5: Scheduler Integration', () => {
    it('should get scheduler status', async () => {
      const status = getSchedulerStatus();
      console.log(`\n⏰ Scheduler Status:`);
      console.log(`  Running: ${status.running}`);
      console.log(`  Last run: ${status.lastRunTime}`);
      console.log(`  Next runs: ${status.nextRunTimes.join(', ')}`);
      expect(status).toHaveProperty('running');
      expect(status).toHaveProperty('nextRunTimes');
    });

    it('should be able to start scheduler', async () => {
      startReportScheduler();
      const status = getSchedulerStatus();
      console.log(`✓ Scheduler started: ${status.running}`);
      expect(status.running).toBe(true);
    });

    it('should be able to stop scheduler', async () => {
      stopReportScheduler();
      const status = getSchedulerStatus();
      console.log(`✓ Scheduler stopped: ${!status.running}`);
      expect(status.running).toBe(false);
    });

    it('should be able to run report manually', async () => {
      const result = await runReportGeneration();
      console.log(`✓ Manual report generation: ${result.success}`);
      console.log(`  Path: ${result.reportPath}`);
      expect(result.success).toBe(true);
      expect(result.reportPath).toBeTruthy();
    });
  });

  describe('Phase 6: System Health Check', () => {
    it('should have all required components', async () => {
      console.log(`\n✅ System Health Check:`);

      // Check database connection
      const messages = await getRecentMessages(1);
      console.log(`  ✓ Database: Connected (${messages.length} messages)`);

      // Check classification
      const classResult = classifyMessage('test message');
      console.log(`  ✓ Classifier: Working (${classResult.classification})`);

      // Check report generation
      const reportPath = await generateCorrectTemplateReport();
      console.log(`  ✓ Report Generator: Working (${reportPath})`);

      // Check scheduler
      const status = getSchedulerStatus();
      console.log(`  ✓ Scheduler: Available (${status.nextRunTimes.length} runs scheduled)`);

      expect(messages.length).toBeGreaterThan(0);
      expect(classResult.classification).toBeTruthy();
      expect(reportPath).toBeTruthy();
      expect(status.nextRunTimes.length).toBeGreaterThan(0);
    });
  });
});
