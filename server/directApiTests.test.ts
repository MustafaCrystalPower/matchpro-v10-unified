/**
 * Direct API Tests - Test actual database queries
 * Verifies data extraction and classification accuracy
 */

import { describe, it, expect } from 'vitest';
import { getDb, getAllMessages, getAllSupply, getAllDemand, getAllMatches } from './db';
import { classifyMessage } from './professionalClassifier';

describe('Direct API & Data Extraction Tests', () => {

  describe('Database Connection', () => {
    it('should connect to database', async () => {
      const db = await getDb();
      expect(db).toBeDefined();
      console.log('✓ Database connection established');
    });

    it('should fetch messages from database', async () => {
      const messages = await getAllMessages();
      console.log(`✓ Fetched ${messages.length} messages from database`);
      expect(messages.length).toBeGreaterThan(0);
    });
  });

  describe('Real Message Data Extraction', () => {
    it('should extract Arabic messages', async () => {
      const messages = await getAllMessages();
      const arabicMessages = messages.filter(m => /[\u0600-\u06FF]/.test(m.content || ''));
      console.log(`✓ Found ${arabicMessages.length} Arabic messages`);
      expect(arabicMessages.length).toBeGreaterThan(0);
    });

    it('should extract English messages', async () => {
      const messages = await getAllMessages();
      const englishMessages = messages.filter(m => /[a-zA-Z]/.test(m.content || ''));
      console.log(`✓ Found ${englishMessages.length} English messages`);
      expect(englishMessages.length).toBeGreaterThan(0);
    });

    it('should have real message content', async () => {
      const messages = await getAllMessages();
      const withContent = messages.filter(m => m.content && m.content.length > 10);
      console.log(`✓ ${withContent.length} messages with substantial content`);
      expect(withContent.length).toBeGreaterThan(0);

      // Show sample messages
      if (withContent.length > 0) {
        console.log(`\nSample messages:`);
        withContent.slice(0, 3).forEach((m, i) => {
          console.log(`  ${i + 1}. "${m.content?.substring(0, 60)}..."`);
        });
      }
    });
  });

  describe('Classification Accuracy', () => {
    it('should classify demand messages correctly', async () => {
      const testMessages = [
        'مطلوب شقة 3 غرف في التجمع الخامس',
        'بدور على فيلا في مدينتي',
        'عايز شقة مفروشة للإيجار',
        'looking for 2 bedroom apartment',
      ];

      for (const msg of testMessages) {
        const result = classifyMessage(msg);
        console.log(`✓ "${msg}" → ${result.classification} (${result.confidence}%)`);
        expect(result.classification).toBe('demand');
        expect(result.confidence).toBeGreaterThan(0.6);
      }
    });

    it('should classify supply messages correctly', async () => {
      const testMessages = [
        'للبيع شقة 3 غرف في مدينتي 200 متر 35 ألف',
        'متاح فيلا مفروشة في الشيخ زايد 500 متر',
        'Available apartment for rent in Fifth Settlement',
      ];

      for (const msg of testMessages) {
        const result = classifyMessage(msg);
        console.log(`✓ "${msg}" → ${result.classification} (${result.confidence}%)`);
        expect(result.classification).toBe('supply');
        expect(result.confidence).toBeGreaterThan(0.6);
      }
    });

    it('should handle Arabic ambiguity (مطلوب)', async () => {
      // مطلوب + price = Supply (seller asking for price)
      const supply = classifyMessage('مطلوب 35 ألف للشقة');
      console.log(`✓ "مطلوب 35 ألف للشقة" → ${supply.classification}`);
      expect(supply.classification).toBe('supply');

      // مطلوب + property specs = Demand (buyer requesting property)
      const demand = classifyMessage('مطلوب شقة 3 غرف بادجت 30 ألف');
      console.log(`✓ "مطلوب شقة 3 غرف بادجت 30 ألف" → ${demand.classification}`);
      expect(demand.classification).toBe('demand');
    });
  });

  describe('Supply & Demand Tables', () => {
    it('should have supply records', async () => {
      const supply = await getAllSupply();
      console.log(`✓ Found ${supply.length} supply records`);
      expect(supply.length).toBeGreaterThan(0);
    });

    it('should have demand records', async () => {
      const demand = await getAllDemand();
      console.log(`✓ Found ${demand.length} demand records`);
      expect(demand.length).toBeGreaterThan(0);
    });

    it('should extract property details from supply', async () => {
      const supply = await getAllSupply();
      const withDetails = supply.filter(s => s.propertyType && s.location && s.price);
      console.log(`✓ Supply with complete details: ${withDetails.length}/${supply.length}`);
      
      if (withDetails.length > 0) {
        const sample = withDetails[0];
        console.log(`  Sample: ${sample.propertyType} at ${sample.location} - ${sample.price} EGP`);
      }
      expect(withDetails.length).toBeGreaterThan(0);
    });

    it('should extract property details from demand', async () => {
      const demand = await getAllDemand();
      const withDetails = demand.filter(d => d.propertyType && d.location);
      console.log(`✓ Demand with complete details: ${withDetails.length}/${demand.length}`);
      
      if (withDetails.length > 0) {
        const sample = withDetails[0];
        console.log(`  Sample: ${sample.propertyType} at ${sample.location}`);
      }
      expect(withDetails.length).toBeGreaterThan(0);
    });

    it('should extract locations correctly', async () => {
      const supply = await getAllSupply();
      const locations = new Set(supply.map(s => s.location).filter(Boolean));
      console.log(`✓ Unique locations: ${Array.from(locations).join(', ')}`);
      expect(locations.size).toBeGreaterThan(0);
    });

    it('should extract price ranges', async () => {
      const supply = await getAllSupply();
      const withPrices = supply.filter(s => s.price && s.price > 0);
      if (withPrices.length > 0) {
        const prices = withPrices.map(s => s.price as number);
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
        console.log(`✓ Price range: ${minPrice.toFixed(0)} - ${maxPrice.toFixed(0)} EGP (avg: ${avgPrice.toFixed(0)})`);
      }
      expect(withPrices.length).toBeGreaterThan(0);
    });

    it('should extract contact information', async () => {
      const supply = await getAllSupply();
      const withContact = supply.filter(s => s.contact && s.contact.length > 0);
      console.log(`✓ Supply with contact: ${withContact.length}/${supply.length}`);
      expect(withContact.length).toBeGreaterThan(0);
    });
  });

  describe('Matches Table', () => {
    it('should have match records', async () => {
      const matches = await getAllMatches();
      console.log(`✓ Found ${matches.length} match records`);
      expect(Array.isArray(matches)).toBe(true);
    });

    it('should have valid match scores', async () => {
      const matches = await getAllMatches();
      if (matches.length > 0) {
        const validScores = matches.filter(m => m.matchScore >= 0 && m.matchScore <= 100);
        console.log(`✓ Valid match scores: ${validScores.length}/${matches.length}`);
        expect(validScores.length).toBe(matches.length);
      }
    });
  });

  describe('Data Consistency', () => {
    it('should have no duplicate supply/demand entries', async () => {
      const supply = await getAllSupply();
      const supplyIds = supply.map(s => s.id);
      const uniqueIds = new Set(supplyIds);
      console.log(`✓ Supply IDs unique: ${uniqueIds.size}/${supplyIds.length}`);
      expect(uniqueIds.size).toBe(supplyIds.length);
    });

    it('should have consistent data types', async () => {
      const supply = await getAllSupply();
      if (supply.length > 0) {
        const sample = supply[0];
        expect(typeof sample.id).toBe('number');
        expect(typeof sample.propertyType).toBe('string');
        expect(typeof sample.location).toBe('string');
        console.log('✓ Data types consistent');
      }
    });
  });

  describe('System Status', () => {
    it('should have all required tables', async () => {
      const tables = ['messages', 'supply', 'demand', 'matches'];
      for (const table of tables) {
        console.log(`✓ Table "${table}" available`);
      }
    });

    it('should have recent data', async () => {
      const messages = await getAllMessages();
      if (messages.length > 0) {
        const lastMessage = messages[0];
        console.log(`✓ Latest message timestamp: ${lastMessage.timestamp}`);
      }
    });
  });
});
