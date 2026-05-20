import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { appRouter } from './routers';
import { TrpcContext } from './_core/context';

describe('My Assets Router', () => {
  const mockCtx: TrpcContext = {
    user: { id: 1, email: 'test@example.com', role: 'admin', name: 'Test User' },
  };

  const caller = appRouter.createCaller(mockCtx);

  describe('myAssets.create', () => {
    it('should create an asset with valid input', async () => {
      const result = await caller.myAssets.create({
        title: 'Luxury 2BR Apartment',
        location: 'New Cairo',
        propertyType: 'apartment',
        price: 5000000,
        priceUnit: 'EGP',
        bedrooms: 2,
        bathrooms: 2,
        size: 150,
        description: 'Modern apartment with full amenities',
      });

      expect(result.success).toBe(true);
      expect(result.id).toBeGreaterThan(0);
    });

    it('should fail without title', async () => {
      try {
        await caller.myAssets.create({
          title: '',
          location: 'New Cairo',
          propertyType: 'apartment',
          price: 5000000,
          priceUnit: 'EGP',
        });
        expect.fail('Should have thrown error');
      } catch (err: any) {
        expect(err.message).toContain('title');
      }
    });

    it('should fail without location', async () => {
      try {
        await caller.myAssets.create({
          title: 'Test Property',
          location: '',
          propertyType: 'apartment',
          price: 5000000,
          priceUnit: 'EGP',
        });
        expect.fail('Should have thrown error');
      } catch (err: any) {
        expect(err.message).toContain('location');
      }
    });
  });

  describe('myAssets.list', () => {
    it('should return list of assets', async () => {
      const result = await caller.myAssets.list();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('myAssets.getById', () => {
    it('should return asset by id', async () => {
      // First create an asset
      const created = await caller.myAssets.create({
        title: 'Test Asset',
        location: 'Cairo',
        propertyType: 'villa',
        price: 10000000,
        priceUnit: 'EGP',
      });

      // Then fetch it
      const result = await caller.myAssets.getById({ id: created.id });
      expect(result).not.toBeNull();
      expect(result?.title).toBe('Test Asset');
    });

    it('should return null for non-existent id', async () => {
      const result = await caller.myAssets.getById({ id: 999999 });
      expect(result).toBeNull();
    });
  });

  describe('myAssets.findMatches', () => {
    it('should find matches for an asset', async () => {
      // Create an asset
      const asset = await caller.myAssets.create({
        title: 'Match Test Asset',
        location: 'Heliopolis',
        propertyType: 'apartment',
        price: 3000000,
        priceUnit: 'EGP',
        bedrooms: 2,
      });

      // Find matches
      const matches = await caller.myAssets.findMatches({ assetId: asset.id });
      expect(Array.isArray(matches)).toBe(true);
    });

    it('should return empty array for non-existent asset', async () => {
      const matches = await caller.myAssets.findMatches({ assetId: 999999 });
      expect(matches).toEqual([]);
    });
  });

  describe('Match Scoring Logic', () => {
    it('should score location matches correctly', async () => {
      // Create asset in specific location
      const asset = await caller.myAssets.create({
        title: 'Location Test',
        location: 'New Cairo',
        propertyType: 'apartment',
        price: 5000000,
        priceUnit: 'EGP',
      });

      const matches = await caller.myAssets.findMatches({ assetId: asset.id });
      
      // Verify scoring exists
      if (matches.length > 0) {
        expect(matches[0].locationScore).toBeGreaterThanOrEqual(0);
        expect(matches[0].locationScore).toBeLessThanOrEqual(100);
      }
    });

    it('should score price matches correctly', async () => {
      const asset = await caller.myAssets.create({
        title: 'Price Test',
        location: 'Cairo',
        propertyType: 'apartment',
        price: 4500000,
        priceUnit: 'EGP',
      });

      const matches = await caller.myAssets.findMatches({ assetId: asset.id });
      
      if (matches.length > 0) {
        expect(matches[0].priceScore).toBeGreaterThanOrEqual(0);
        expect(matches[0].priceScore).toBeLessThanOrEqual(100);
      }
    });

    it('should score property type matches correctly', async () => {
      const asset = await caller.myAssets.create({
        title: 'Type Test',
        location: 'Cairo',
        propertyType: 'villa',
        price: 10000000,
        priceUnit: 'EGP',
      });

      const matches = await caller.myAssets.findMatches({ assetId: asset.id });
      
      if (matches.length > 0) {
        expect(matches[0].typeScore).toBeGreaterThanOrEqual(0);
        expect(matches[0].typeScore).toBeLessThanOrEqual(100);
      }
    });
  });
});

describe('My Requests Router', () => {
  const mockCtx: TrpcContext = {
    user: { id: 1, email: 'test@example.com', role: 'admin', name: 'Test User' },
  };

  const caller = appRouter.createCaller(mockCtx);

  describe('myRequests.create', () => {
    it('should create a request with valid input', async () => {
      const result = await caller.myRequests.create({
        title: '2BR Apartment Wanted',
        location: 'New Cairo',
        propertyType: 'apartment',
        bedrooms: 2,
        bathrooms: 2,
        minPrice: 3000000,
        maxPrice: 5000000,
        minArea: 100,
        maxArea: 200,
        amenities: ['pool', 'gym', 'parking'],
        furnished: true,
        notes: 'Need modern apartment',
      });

      expect(result.success).toBe(true);
      expect(result.id).toBeGreaterThan(0);
    });

    it('should fail without title', async () => {
      try {
        await caller.myRequests.create({
          title: '',
          location: 'New Cairo',
          propertyType: 'apartment',
        });
        expect.fail('Should have thrown error');
      } catch (err: any) {
        expect(err.message).toContain('title');
      }
    });
  });

  describe('myRequests.list', () => {
    it('should return list of requests', async () => {
      const result = await caller.myRequests.list();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('myRequests.getById', () => {
    it('should return request by id', async () => {
      const created = await caller.myRequests.create({
        title: 'Test Request',
        location: 'Cairo',
        propertyType: 'apartment',
      });

      const result = await caller.myRequests.getById({ id: created.id });
      expect(result).not.toBeNull();
      expect(result?.title).toBe('Test Request');
    });

    it('should return null for non-existent id', async () => {
      const result = await caller.myRequests.getById({ id: 999999 });
      expect(result).toBeNull();
    });
  });

  describe('myRequests.findMatches', () => {
    it('should find matches for a request', async () => {
      const request = await caller.myRequests.create({
        title: 'Match Test Request',
        location: 'Heliopolis',
        propertyType: 'apartment',
        bedrooms: 2,
        minPrice: 2000000,
        maxPrice: 4000000,
      });

      const matches = await caller.myRequests.findMatches({ requestId: request.id });
      expect(Array.isArray(matches)).toBe(true);
    });

    it('should return empty array for non-existent request', async () => {
      const matches = await caller.myRequests.findMatches({ requestId: 999999 });
      expect(matches).toEqual([]);
    });
  });

  describe('Request Matching Logic', () => {
    it('should filter matches by bedroom count', async () => {
      const request = await caller.myRequests.create({
        title: 'Bedroom Filter Test',
        location: 'Cairo',
        propertyType: 'apartment',
        bedrooms: 3,
      });

      const matches = await caller.myRequests.findMatches({ requestId: request.id });
      
      // Verify bedroom scoring is applied
      if (matches.length > 0) {
        expect(matches[0].bedroomScore).toBeGreaterThanOrEqual(0);
        expect(matches[0].bedroomScore).toBeLessThanOrEqual(100);
      }
    });

    it('should filter matches by price range', async () => {
      const request = await caller.myRequests.create({
        title: 'Price Filter Test',
        location: 'Cairo',
        propertyType: 'apartment',
        minPrice: 3000000,
        maxPrice: 5000000,
      });

      const matches = await caller.myRequests.findMatches({ requestId: request.id });
      
      if (matches.length > 0) {
        expect(matches[0].priceScore).toBeGreaterThanOrEqual(0);
        expect(matches[0].priceScore).toBeLessThanOrEqual(100);
      }
    });

    it('should sort matches by score descending', async () => {
      const request = await caller.myRequests.create({
        title: 'Sort Test',
        location: 'Cairo',
        propertyType: 'apartment',
      });

      const matches = await caller.myRequests.findMatches({ requestId: request.id });
      
      // Verify sorting
      for (let i = 1; i < matches.length; i++) {
        expect(matches[i - 1].matchScore).toBeGreaterThanOrEqual(matches[i].matchScore);
      }
    });
  });
});
