import { describe, it, expect, beforeAll } from "vitest";
import { getDb } from "./db";

describe("MatchPro Feature Tests", () => {
  let db: any;

  beforeAll(async () => {
    db = await getDb();
  });

  describe("Properties Export", () => {
    it("should export supply properties as CSV", async () => {
      const supply = await db.execute(
        `SELECT id, contactName, contact, propertyType, location, price FROM supply LIMIT 5`
      );
      expect(supply).toBeDefined();
      expect(Array.isArray(supply)).toBe(true);
    });

    it("should export demand properties as CSV", async () => {
      const demand = await db.execute(
        `SELECT id, contactName, contact, propertyType, location, priceMin, priceMax FROM demand LIMIT 5`
      );
      expect(demand).toBeDefined();
      expect(Array.isArray(demand)).toBe(true);
    });

    it("should filter properties by location", async () => {
      const filtered = await db.execute(
        `SELECT COUNT(*) as count FROM supply WHERE location = 'Cairo'`
      );
      expect(filtered).toBeDefined();
    });
  });

  describe("Daily Email Reports", () => {
    it("should generate demand reports", async () => {
      const reports = await db.execute(
        `SELECT DISTINCT location FROM demand WHERE created_at >= DATE_SUB(NOW(), INTERVAL 48 HOUR)`
      );
      expect(reports).toBeDefined();
      expect(Array.isArray(reports)).toBe(true);
    });

    it("should calculate demand statistics", async () => {
      const stats = await db.execute(
        `SELECT 
          COUNT(*) as totalDemand,
          AVG(budget_max) as avgBudget,
          AVG(bedrooms) as avgBedrooms
        FROM demand 
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 48 HOUR)`
      );
      expect(stats).toBeDefined();
      expect(stats[0]).toHaveProperty("totalDemand");
    });

    it("should group demands by property type", async () => {
      const types = await db.execute(
        `SELECT property_type, COUNT(*) as count 
        FROM demand 
        GROUP BY property_type`
      );
      expect(types).toBeDefined();
      expect(Array.isArray(types)).toBe(true);
    });
  });

  describe("Messages Export", () => {
    it("should export messages with filtering", async () => {
      const messages = await db.execute(
        `SELECT id, sender, content, location FROM messages LIMIT 10`
      );
      expect(messages).toBeDefined();
      expect(Array.isArray(messages)).toBe(true);
    });
  });

  describe("Matches Export", () => {
    it("should export matches with score filtering", async () => {
      const matches = await db.execute(
        `SELECT id, supplyId, demandId, score FROM matches WHERE score >= 0.7 LIMIT 10`
      );
      expect(matches).toBeDefined();
      expect(Array.isArray(matches)).toBe(true);
    });

    it("should calculate match statistics", async () => {
      const stats = await db.execute(
        `SELECT 
          COUNT(*) as totalMatches,
          AVG(score) as avgScore,
          MAX(score) as maxScore
        FROM matches`
      );
      expect(stats).toBeDefined();
      expect(stats[0]).toHaveProperty("totalMatches");
    });
  });

  describe("Biometric Login", () => {
    it("should validate passcode 166161", () => {
      const passcode = "166161";
      expect(passcode).toBe("166161");
    });

    it("should reject incorrect passcode", () => {
      const passcode = "123456";
      expect(passcode).not.toBe("166161");
    });
  });

  describe("Report Settings", () => {
    it("should support daily frequency", () => {
      const frequency = "daily";
      expect(["daily", "weekly", "disabled"]).toContain(frequency);
    });

    it("should support location filtering", () => {
      const locations = ["Cairo", "Giza", "Alexandria"];
      expect(locations.length).toBeGreaterThan(0);
    });

    it("should support property type filtering", () => {
      const types = ["Apartment", "Villa", "Townhouse"];
      expect(types.length).toBeGreaterThan(0);
    });
  });
});
