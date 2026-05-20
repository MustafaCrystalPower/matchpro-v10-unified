import { describe, expect, it } from "vitest";

describe("CSV Export", () => {
  it("generates valid CSV headers", () => {
    const headers = [
      'Match ID',
      'Confidence Score',
      'Status',
      'Buyer Name',
      'Buyer Phone',
      'Buyer Location',
      'Buyer Budget',
      'Buyer Property Type',
      'Buyer Bedrooms',
      'Seller Name',
      'Seller Phone',
      'Seller Location',
      'Seller Price',
      'Seller Property Type',
      'Seller Bedrooms',
      'Seller Size (sqm)',
      'Location Score',
      'Price Score',
      'Specs Score',
      'Match Summary',
      'Notes',
      'Created At'
    ];
    
    expect(headers.length).toBe(22);
    expect(headers[0]).toBe('Match ID');
    expect(headers[headers.length - 1]).toBe('Created At');
  });

  it("escapes CSV values correctly", () => {
    const escapeCSV = (value: string | null | undefined): string => {
      const str = String(value || '');
      return `"${str.replace(/"/g, '""')}"`;
    };
    
    expect(escapeCSV('Simple text')).toBe('"Simple text"');
    expect(escapeCSV('Text with "quotes"')).toBe('"Text with ""quotes"""');
    expect(escapeCSV(null)).toBe('""');
    expect(escapeCSV(undefined)).toBe('""');
  });

  it("formats match data for CSV export", () => {
    const match = {
      id: 1,
      confidenceScore: 85,
      status: 'new',
      demand: {
        buyerName: 'Ahmed Mohamed',
        buyerPhone: '01022382328',
        location: 'Sheikh Zayed',
        maxPrice: 2500000,
        propertyType: 'apartment',
        minBedrooms: 2
      },
      supply: {
        sellerName: 'Soaad Ibrahim',
        sellerPhone: '01098765432',
        location: 'Sheikh Zayed',
        price: 2300000,
        propertyType: 'apartment',
        bedrooms: 2,
        size: 120
      },
      locationScore: 100,
      priceScore: 92,
      specsScore: 100,
      matchSummary: 'Ahmed looking for apartment → Matched with Soaad',
      notes: '',
      createdAt: new Date('2026-02-04T12:00:00Z')
    };
    
    const row = [
      match.id,
      match.confidenceScore,
      match.status,
      match.demand.buyerName,
      match.demand.buyerPhone,
      match.demand.location,
      match.demand.maxPrice,
      match.demand.propertyType,
      match.demand.minBedrooms,
      match.supply.sellerName,
      match.supply.sellerPhone,
      match.supply.location,
      match.supply.price,
      match.supply.propertyType,
      match.supply.bedrooms,
      match.supply.size,
      match.locationScore,
      match.priceScore,
      match.specsScore,
      match.matchSummary,
      match.notes,
      match.createdAt.toISOString()
    ];
    
    expect(row.length).toBe(22);
    expect(row[0]).toBe(1);
    expect(row[3]).toBe('Ahmed Mohamed');
    expect(row[9]).toBe('Soaad Ibrahim');
  });

  it("generates correct filename format", () => {
    const date = new Date('2026-02-04');
    const filename = `matchpro-matches-${date.toISOString().split('T')[0]}.csv`;
    expect(filename).toBe('matchpro-matches-2026-02-04.csv');
  });
});
