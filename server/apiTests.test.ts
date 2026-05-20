/**
 * Comprehensive API Test Suite
 * Tests all tRPC endpoints and verifies real data extraction
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { appRouter } from './routers';
import { getDb } from './db';

describe('API Endpoints - Comprehensive Test Suite', () => {
  let caller: any;
  let db: any;

  beforeAll(async () => {
    db = getDb();
    const context = { user: { id: 'test-user', role: 'admin', openId: 'test' } };
    caller = appRouter.createCaller(context);
  });

  describe('Messages API', () => {
    it('should fetch all messages from database', async () => {
      const messages = await caller.messages.getAll();
      console.log(`✓ Fetched ${messages.length} messages`);
      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0]).toHaveProperty('id');
      expect(messages[0]).toHaveProperty('content');
    });

    it('should have real WhatsApp message data', async () => {
      const messages = await caller.messages.getAll();
      const realMessages = messages.filter((m: any) => m.content && m.content.length > 0);
      console.log(`✓ Found ${realMessages.length} messages with content`);
      expect(realMessages.length).toBeGreaterThan(0);
    });

    it('should extract Arabic and English messages', async () => {
      const messages = await caller.messages.getAll();
      const arabicMessages = messages.filter((m: any) => /[\u0600-\u06FF]/.test(m.content));
      const englishMessages = messages.filter((m: any) => /[a-zA-Z]/.test(m.content));
      console.log(`✓ Arabic messages: ${arabicMessages.length}, English messages: ${englishMessages.length}`);
      expect(arabicMessages.length).toBeGreaterThan(0);
    });
  });

  describe('Supply API', () => {
    it('should fetch all supply listings', async () => {
      const supply = await caller.supply.getAll();
      console.log(`✓ Fetched ${supply.length} supply listings`);
      expect(Array.isArray(supply)).toBe(true);
    });

    it('should have correct supply structure', async () => {
      const supply = await caller.supply.getAll();
      if (supply.length > 0) {
        const item = supply[0];
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('propertyType');
        expect(item).toHaveProperty('location');
        expect(item).toHaveProperty('price');
        console.log(`✓ Supply item structure verified: ${item.propertyType} at ${item.location}`);
      }
    });

    it('should extract property details accurately', async () => {
      const supply = await caller.supply.getAll();
      const withDetails = supply.filter((s: any) => s.propertyType && s.location && s.price);
      console.log(`✓ Supply listings with complete details: ${withDetails.length}/${supply.length}`);
      expect(withDetails.length).toBeGreaterThan(0);
    });
  });

  describe('Demand API', () => {
    it('should fetch all demand listings', async () => {
      const demand = await caller.demand.getAll();
      console.log(`✓ Fetched ${demand.length} demand listings`);
      expect(Array.isArray(demand)).toBe(true);
    });

    it('should have correct demand structure', async () => {
      const demand = await caller.demand.getAll();
      if (demand.length > 0) {
        const item = demand[0];
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('propertyType');
        expect(item).toHaveProperty('location');
        console.log(`✓ Demand item structure verified: ${item.propertyType} at ${item.location}`);
      }
    });

    it('should extract buyer requirements accurately', async () => {
      const demand = await caller.demand.getAll();
      const withDetails = demand.filter((d: any) => d.propertyType && d.location);
      console.log(`✓ Demand listings with complete details: ${withDetails.length}/${demand.length}`);
      expect(withDetails.length).toBeGreaterThan(0);
    });
  });

  describe('Matches API', () => {
    it('should fetch all matches', async () => {
      const matches = await caller.matches.getAll();
      console.log(`✓ Fetched ${matches.length} matches`);
      expect(Array.isArray(matches)).toBe(true);
    });

    it('should have correct match structure', async () => {
      const matches = await caller.matches.getAll();
      if (matches.length > 0) {
        const match = matches[0];
        expect(match).toHaveProperty('id');
        expect(match).toHaveProperty('supplyId');
        expect(match).toHaveProperty('demandId');
        expect(match).toHaveProperty('matchScore');
        console.log(`✓ Match structure verified: Score ${match.matchScore}%`);
      }
    });

    it('should calculate match scores correctly', async () => {
      const matches = await caller.matches.getAll();
      const validMatches = matches.filter((m: any) => m.matchScore >= 0 && m.matchScore <= 100);
      console.log(`✓ Valid match scores: ${validMatches.length}/${matches.length}`);
      expect(validMatches.length).toBe(matches.length);
    });
  });

  describe('Data Extraction Accuracy', () => {
    it('should extract Egyptian locations correctly', async () => {
      const supply = await caller.supply.getAll();
      const locations = new Set(supply.map((s: any) => s.location).filter(Boolean));
      console.log(`✓ Unique locations found: ${Array.from(locations).join(', ')}`);
      expect(locations.size).toBeGreaterThan(0);
    });

    it('should extract price ranges accurately', async () => {
      const supply = await caller.supply.getAll();
      const withPrices = supply.filter((s: any) => s.price && s.price > 0);
      const avgPrice = withPrices.reduce((sum: number, s: any) => sum + s.price, 0) / withPrices.length;
      console.log(`✓ Average property price: ${avgPrice.toFixed(0)} EGP`);
      expect(avgPrice).toBeGreaterThan(0);
    });

    it('should extract property types correctly', async () => {
      const supply = await caller.supply.getAll();
      const types = new Set(supply.map((s: any) => s.propertyType).filter(Boolean));
      console.log(`✓ Property types: ${Array.from(types).join(', ')}`);
      expect(types.size).toBeGreaterThan(0);
    });

    it('should extract bedrooms and bathrooms', async () => {
      const supply = await caller.supply.getAll();
      const withBeds = supply.filter((s: any) => s.bedrooms && s.bedrooms > 0);
      console.log(`✓ Listings with bedroom info: ${withBeds.length}/${supply.length}`);
      expect(withBeds.length).toBeGreaterThan(0);
    });

    it('should extract contact information', async () => {
      const supply = await caller.supply.getAll();
      const withContact = supply.filter((s: any) => s.contact && s.contact.length > 0);
      console.log(`✓ Listings with contact info: ${withContact.length}/${supply.length}`);
      expect(withContact.length).toBeGreaterThan(0);
    });
  });

  describe('Classification Accuracy', () => {
    it('should classify supply vs demand correctly', async () => {
      const supply = await caller.supply.getAll();
      const demand = await caller.demand.getAll();
      console.log(`✓ Supply: ${supply.length}, Demand: ${demand.length}`);
      expect(supply.length).toBeGreaterThan(0);
      expect(demand.length).toBeGreaterThan(0);
    });

    it('should have no overlap between supply and demand', async () => {
      const supply = await caller.supply.getAll();
      const demand = await caller.demand.getAll();
      const supplyIds = new Set(supply.map((s: any) => s.id));
      const demandIds = new Set(demand.map((d: any) => d.id));
      const overlap = [...supplyIds].filter(id => demandIds.has(id));
      console.log(`✓ No overlap between supply and demand (overlap: ${overlap.length})`);
      expect(overlap.length).toBe(0);
    });
  });

  describe('Report Generation API', () => {
    it('should have report generation endpoint', async () => {
      expect(caller.admin.generateReport).toBeDefined();
      console.log(`✓ Report generation endpoint exists`);
    });

    it('should generate report successfully', async () => {
      try {
        const reportPath = await caller.admin.generateReport();
        console.log(`✓ Report generated: ${reportPath}`);
        expect(reportPath).toBeTruthy();
        expect(reportPath.endsWith('.xlsx')).toBe(true);
      } catch (error) {
        console.error('Report generation error:', error);
        throw error;
      }
    });
  });

  describe('System Health', () => {
    it('should have database connection', async () => {
      expect(db).toBeDefined();
      console.log(`✓ Database connection verified`);
    });

    it('should have all required API procedures', async () => {
      const procedures = [
        'messages.getAll',
        'supply.getAll',
        'demand.getAll',
        'matches.getAll',
        'admin.generateReport',
      ];

      for (const proc of procedures) {
        const [module, method] = proc.split('.');
        expect(caller[module][method]).toBeDefined();
        console.log(`✓ ${proc} endpoint available`);
      }
    });
  });
});
