import { describe, it, expect, beforeAll } from 'vitest';
import { generateNewReports } from './newExcelReportGenerator';
import { generateReportMetrics, calculateQualityScore, getAreaPerformance, getMatchQualityDistribution, getSupplyDemandRatio } from './reportAnalytics';
import { getBrokersForArea, getActiveBrokers, getBrokerStats } from './brokerDistribution';
import { getRecentMatches, getRecentDemand, getRecentSupply } from './db';

describe('Report System - End-to-End Tests', () => {
  describe('Report Generation', () => {
    it('should generate a complete workbook', async () => {
      const workbook = await generateNewReports();
      expect(workbook).toBeDefined();
      expect(workbook.worksheets.length).toBeGreaterThan(0);
    });

    it('should have Matches sheet with correct structure', async () => {
      const workbook = await generateNewReports();
      const matchesSheet = workbook.getWorksheet('Matches');
      
      expect(matchesSheet).toBeDefined();
      if (matchesSheet) {
        const headerRow = matchesSheet.getRow(1);
        expect(headerRow.cellCount).toBeGreaterThan(0);
      }
    });

    it('should have area-specific sheets', async () => {
      const workbook = await generateNewReports();
      const areas = ['مدينتي', 'التجمع الخامس'];
      
      for (const area of areas) {
        const sheet = workbook.getWorksheet(area);
        expect(sheet).toBeDefined();
      }
    });
  });

  describe('Analytics', () => {
    it('should generate report metrics', async () => {
      const metrics = await generateReportMetrics(1000);
      
      expect(metrics).toBeDefined();
      expect(metrics.matchesCount).toBeGreaterThanOrEqual(0);
      expect(metrics.demandCount).toBeGreaterThanOrEqual(0);
      expect(metrics.supplyCount).toBeGreaterThanOrEqual(0);
    });

    it('should calculate quality score', async () => {
      const metrics = await generateReportMetrics(1000);
      const score = calculateQualityScore(metrics);
      
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should get area performance', async () => {
      const metrics = await generateReportMetrics(1000);
      const performance = getAreaPerformance(metrics);
      
      expect(Array.isArray(performance)).toBe(true);
    });

    it('should get match quality distribution', async () => {
      const distribution = await getMatchQualityDistribution();
      
      expect(distribution).toBeDefined();
      expect(distribution.excellent).toBeGreaterThanOrEqual(0);
      expect(distribution.high).toBeGreaterThanOrEqual(0);
      expect(distribution.medium).toBeGreaterThanOrEqual(0);
      expect(distribution.low).toBeGreaterThanOrEqual(0);
    });

    it('should get supply/demand ratio', async () => {
      const ratio = await getSupplyDemandRatio();
      
      expect(ratio).toBeDefined();
      expect(ratio.supply).toBeGreaterThanOrEqual(0);
      expect(ratio.demand).toBeGreaterThanOrEqual(0);
      expect(ratio.ratio).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Broker Distribution', () => {
    it('should get active brokers', () => {
      const brokers = getActiveBrokers();
      expect(Array.isArray(brokers)).toBe(true);
    });

    it('should get brokers for specific area', () => {
      const brokers = getBrokersForArea('مدينتي');
      expect(Array.isArray(brokers)).toBe(true);
    });

    it('should get broker statistics', () => {
      const stats = getBrokerStats();
      
      expect(stats).toBeDefined();
      expect(stats.totalBrokers).toBeGreaterThanOrEqual(0);
      expect(stats.activeBrokers).toBeGreaterThanOrEqual(0);
      expect(stats.totalAreas).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Data Integration', () => {
    it('should fetch recent matches', async () => {
      const matches = await getRecentMatches(10);
      expect(Array.isArray(matches)).toBe(true);
    });

    it('should fetch recent demand', async () => {
      const demand = await getRecentDemand(10);
      expect(Array.isArray(demand)).toBe(true);
    });

    it('should fetch recent supply', async () => {
      const supply = await getRecentSupply(10);
      expect(Array.isArray(supply)).toBe(true);
    });
  });

  describe('Schema Compliance', () => {
    it('should use 7-column schema in area sheets', async () => {
      const workbook = await generateNewReports();
      const areaSheet = workbook.getWorksheet('مدينتي');
      
      if (areaSheet) {
        const headerRow = areaSheet.getRow(1);
        expect(headerRow.cellCount).toBe(7);
      }
    });

    it('should have correct column headers', async () => {
      const workbook = await generateNewReports();
      const areaSheet = workbook.getWorksheet('مدينتي');
      
      if (areaSheet) {
        const headerRow = areaSheet.getRow(1);
        const headers = headerRow.values as string[];
        
        expect(headers).toContain('Name');
        expect(headers).toContain('Phone');
        expect(headers).toContain('Property Type');
        expect(headers).toContain('Budget');
      }
    });

    it('should have frozen header rows', async () => {
      const workbook = await generateNewReports();
      const matchesSheet = workbook.getWorksheet('Matches');
      
      if (matchesSheet) {
        expect(matchesSheet.views).toBeDefined();
        expect(matchesSheet.views.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Data Quality', () => {
    it('should have consistent data types', async () => {
      const metrics = await generateReportMetrics(1000);
      
      expect(typeof metrics.matchesCount).toBe('number');
      expect(typeof metrics.demandCount).toBe('number');
      expect(typeof metrics.averageMatchScore).toBe('number');
      expect(metrics.generatedAt instanceof Date).toBe(true);
    });

    it('should have valid area breakdown', async () => {
      const metrics = await generateReportMetrics(1000);
      
      for (const [area, count] of Object.entries(metrics.areaBreakdown)) {
        expect(typeof area).toBe('string');
        expect(typeof count).toBe('number');
        expect(count).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Performance', () => {
    it('should generate report within reasonable time', async () => {
      const startTime = Date.now();
      await generateNewReports();
      const duration = Date.now() - startTime;
      
      // Should complete within 30 seconds
      expect(duration).toBeLessThan(30000);
    });

    it('should calculate metrics efficiently', async () => {
      const startTime = Date.now();
      await generateReportMetrics(0);
      const duration = Date.now() - startTime;
      
      // Should complete within 5 seconds
      expect(duration).toBeLessThan(5000);
    });
  });
});
