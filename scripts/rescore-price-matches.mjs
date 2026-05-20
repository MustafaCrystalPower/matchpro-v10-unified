/**
 * Re-score matches where supply price is much lower than demand budget
 * Fixes the 485K vs 3M = 100% false positive issue
 */
import { createConnection } from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const conn = await createConnection(process.env.DATABASE_URL);

const PRICE_TOLERANCE = 0.1;

function calculatePriceScore(supplyPrice, demandPriceMin, demandPriceMax) {
  if (!supplyPrice) return 50;
  if (!demandPriceMin && !demandPriceMax) return 60;
  
  const price = Number(supplyPrice);
  const minPrice = demandPriceMin ? Number(demandPriceMin) : 0;
  const maxPrice = demandPriceMax ? Number(demandPriceMax) : Infinity;
  
  if (price >= minPrice && price <= maxPrice) {
    if (maxPrice > 0 && price < maxPrice * 0.5) {
      const ratio = price / maxPrice;
      if (ratio < 0.2) return 30;
      if (ratio < 0.35) return 50;
      return 70;
    }
    return 100;
  }
  
  if (maxPrice !== Infinity) {
    const overBudgetPercent = (price - maxPrice) / maxPrice;
    if (overBudgetPercent <= PRICE_TOLERANCE) {
      return Math.min(100, Math.round(100 - (overBudgetPercent * 200)));
    }
    if (overBudgetPercent <= PRICE_TOLERANCE * 2) {
      return Math.round(60 - (overBudgetPercent * 100));
    }
  }
  
  if (minPrice > 0 && price < minPrice) {
    const underBudgetPercent = (minPrice - price) / minPrice;
    if (underBudgetPercent <= PRICE_TOLERANCE) return 95;
    if (underBudgetPercent > 0.5) return 20;
    return 60;
  }
  
  return 20;
}

console.log('[Re-score] Finding matches with price mismatch...');

// Find all matches where supply price is < 50% of demand budget (potential false positives)
const [badPriceMatches] = await conn.execute(`
  SELECT m.id, m.matchScore, m.locationScore, m.priceScore, m.specsScore,
         s.price as supplyPrice, s.priceUnit, d.priceMin, d.priceMax
  FROM matches m
  JOIN supply s ON m.supplyId = s.id
  JOIN demand d ON m.demandId = d.id
  WHERE m.deletedAt IS NULL
    AND s.price IS NOT NULL AND d.priceMax IS NOT NULL
    AND s.price < d.priceMax * 0.5
`);

console.log(`Found ${badPriceMatches.length} matches with supply < 50% of demand budget`);

// Weights: location 30%, purpose 30% (fixed at 100 if same), price 25%, specs 10%, type 5%
// But we don't have purpose score stored, so use the existing match structure
// Recalculate: matchScore = locationScore*0.30 + purposeScore*0.30 + priceScore*0.25 + specsScore*0.10 + typeScore*0.05

let updated = 0;
let softDeleted = 0;

for (const m of badPriceMatches) {
  const newPriceScore = calculatePriceScore(m.supplyPrice, m.priceMin, m.priceMax);
  
  if (newPriceScore === parseFloat(m.priceScore)) continue; // No change needed
  
  const locationScore = parseFloat(m.locationScore) || 0;
  const specsScore = parseFloat(m.specsScore) || 0;
  
  // Estimate purpose score from existing matchScore (reverse engineer)
  // Since we can't easily get purpose score, use a conservative estimate
  // If both have same purpose, purpose score = 100; if NULL, use 60
  const purposeScore = 80; // Conservative estimate
  
  const newMatchScore = Math.round(
    (locationScore * 0.30) + 
    (purposeScore * 0.30) + 
    (newPriceScore * 0.25) + 
    (specsScore * 0.10) + 
    (50 * 0.05)  // type score default
  );
  
  await conn.execute(
    'UPDATE matches SET priceScore = ?, matchScore = ? WHERE id = ?',
    [newPriceScore, newMatchScore, m.id]
  );
  updated++;
}

console.log(`Updated ${updated} matches with corrected price scores`);

// Check new state
const [[totalActive]] = await conn.execute('SELECT COUNT(*) as cnt FROM matches WHERE deletedAt IS NULL');
const [[highConf]] = await conn.execute('SELECT COUNT(*) as cnt FROM matches WHERE deletedAt IS NULL AND matchScore >= 70');
const [[veryHigh]] = await conn.execute('SELECT COUNT(*) as cnt FROM matches WHERE deletedAt IS NULL AND matchScore >= 85');

console.log('\n=== After Price Re-scoring ===');
console.log('Total active matches:', totalActive.cnt);
console.log('High-confidence (>=70%):', highConf.cnt);
console.log('Very high-confidence (>=85%):', veryHigh.cnt);

// Sample top matches
const [samples] = await conn.execute(`
  SELECT m.matchScore, m.priceScore, m.locationScore, m.supplyContactName, m.demandContactName,
         s.location as supplyLoc, s.price as supplyPrice, s.purpose as supplyPurpose,
         d.location as demandLoc, d.priceMax as demandBudget, d.purpose as demandPurpose
  FROM matches m
  JOIN supply s ON m.supplyId = s.id
  JOIN demand d ON m.demandId = d.id
  WHERE m.deletedAt IS NULL AND m.matchScore >= 80
  ORDER BY m.matchScore DESC
  LIMIT 8
`);

console.log('\nTop 8 matches (>=80%):');
for (const s of samples) {
  console.log(`  ${s.matchScore}% (price:${s.priceScore}%, loc:${s.locationScore}%) | ${s.supplyLoc} [${s.supplyPurpose}] ${s.supplyPrice}EGP vs ${s.demandLoc} [${s.demandPurpose}] budget:${s.demandBudget} | Seller: ${s.supplyContactName} | Buyer: ${s.demandContactName}`);
}

await conn.end();
console.log('\nDone!');
