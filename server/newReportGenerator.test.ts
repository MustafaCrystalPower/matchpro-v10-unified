import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { generateNewReports } from './newExcelReportGenerator';
import { getRecentMatches, getRecentDemand } from './db';

describe('New Report Generator', () => {
  describe('generateNewReports', () => {
    it('should generate a workbook with multiple sheets', async () => {
      const workbook = await generateNewReports();
      
      // Check that workbook was created
      expect(workbook).toBeDefined();
      expect(workbook.worksheets).toBeDefined();
      expect(workbook.worksheets.length).toBeGreaterThan(0);
    });

    it('should include a Matches sheet', async () => {
      const workbook = await generateNewReports();
      const matchesSheet = workbook.getWorksheet('Matches');
      
      expect(matchesSheet).toBeDefined();
      expect(matchesSheet?.name).toBe('Matches');
    });

    it('should include area sheets', async () => {
      const workbook = await generateNewReports();
      const areas = [
        'مدينتي',
        'التجمع الخامس',
        'الرحاب',
        'القاهرة الجديدة',
        'الساحل الشمالي',
      ];

      for (const area of areas) {
        const sheet = workbook.getWorksheet(area);
        expect(sheet).toBeDefined();
      }
    });

    it('should have proper column headers in Matches sheet', async () => {
      const workbook = await generateNewReports();
      const matchesSheet = workbook.getWorksheet('Matches');
      
      if (!matchesSheet) throw new Error('Matches sheet not found');
      
      const headerRow = matchesSheet.getRow(1);
      const headers = headerRow.values as string[];
      
      expect(headers).toContain('Seller Name');
      expect(headers).toContain('Seller Phone');
      expect(headers).toContain('Buyer Name');
      expect(headers).toContain('Buyer Phone');
      expect(headers).toContain('Property Type');
      expect(headers).toContain('Budget');
      expect(headers).toContain('Score %');
    });

    it('should have proper column headers in area sheets', async () => {
      const workbook = await generateNewReports();
      const areaSheet = workbook.getWorksheet('مدينتي');
      
      if (!areaSheet) throw new Error('Area sheet not found');
      
      const headerRow = areaSheet.getRow(1);
      const headers = headerRow.values as string[];
      
      expect(headers).toContain('Name');
      expect(headers).toContain('Phone');
      expect(headers).toContain('Property Type');
      expect(headers).toContain('Budget');
      expect(headers).toContain('Time');
      expect(headers).toContain('Original Message');
      expect(headers).toContain('Source');
    });

    it('should have metadata set', async () => {
      const workbook = await generateNewReports();
      
      expect(workbook.creator).toBe('Crystal Power Investments');
      expect(workbook.created).toBeDefined();
      expect(workbook.modified).toBeDefined();
    });
  });

  describe('Data Integration', () => {
    it('should fetch recent matches', async () => {
      const matches = await getRecentMatches(10);
      expect(Array.isArray(matches)).toBe(true);
    });

    it('should fetch recent demand leads', async () => {
      const demand = await getRecentDemand(10);
      expect(Array.isArray(demand)).toBe(true);
    });
  });

  describe('Report Schema Compliance', () => {
    it('should use 7 essential columns in area sheets', async () => {
      const workbook = await generateNewReports();
      const areaSheet = workbook.getWorksheet('مدينتي');
      
      if (!areaSheet) throw new Error('Area sheet not found');
      
      // Count columns in header
      const headerRow = areaSheet.getRow(1);
      const columnCount = headerRow.cellCount;
      
      // Should have exactly 7 columns
      expect(columnCount).toBe(7);
    });

    it('should have frozen header rows', async () => {
      const workbook = await generateNewReports();
      const matchesSheet = workbook.getWorksheet('Matches');
      
      if (!matchesSheet) throw new Error('Matches sheet not found');
      
      // Check if views are configured for frozen panes
      expect(matchesSheet.views).toBeDefined();
      expect(matchesSheet.views.length).toBeGreaterThan(0);
    });
  });
});
