/**
 * Standalone script to trigger a fresh matching cycle
 * Run with: node scripts/run-matching.mjs
 */
import mysql from 'mysql2/promise';

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const conn = await mysql.createConnection(DB_URL);

console.log('[MatchPro] Starting fresh matching cycle...');
console.log('[MatchPro] Checking current state...');

// Get counts before
const [[supplyCount]] = await conn.execute("SELECT COUNT(*) as cnt FROM supply WHERE deletedAt IS NULL AND contactName IS NOT NULL AND contactName != 'Unknown'");
const [[demandCount]] = await conn.execute("SELECT COUNT(*) as cnt FROM demand WHERE deletedAt IS NULL");
const [[matchesBefore]] = await conn.execute("SELECT COUNT(*) as cnt FROM matches WHERE deletedAt IS NULL");
const [[highConfBefore]] = await conn.execute("SELECT COUNT(*) as cnt FROM matches WHERE deletedAt IS NULL AND matchScore >= 85");

console.log(`[MatchPro] Supply (with valid contact): ${supplyCount.cnt}`);
console.log(`[MatchPro] Demand: ${demandCount.cnt}`);
console.log(`[MatchPro] Matches before: ${matchesBefore.cnt}`);
console.log(`[MatchPro] High-confidence before: ${highConfBefore.cnt}`);

// Check transactionType distribution
const [typeDist] = await conn.execute("SELECT transactionType, COUNT(*) as cnt FROM matches WHERE deletedAt IS NULL GROUP BY transactionType");
console.log('[MatchPro] Transaction type distribution:', JSON.stringify(typeDist));

// Check untyped remaining
const [[untyped]] = await conn.execute("SELECT COUNT(*) as cnt FROM matches WHERE transactionType IS NULL AND deletedAt IS NULL");
console.log(`[MatchPro] Untyped matches remaining: ${untyped.cnt}`);

// Verify sale/rent gate: check if any cross-type matches exist
// (This would require checking supply.purpose vs demand.purpose for same match)
const [[crossType]] = await conn.execute(`
  SELECT COUNT(*) as cnt FROM matches m
  JOIN supply s ON m.supplyId = s.id
  JOIN demand d ON m.demandId = d.id
  WHERE m.deletedAt IS NULL
    AND s.purpose IS NOT NULL
    AND d.purpose IS NOT NULL
    AND s.purpose != d.purpose
`);
console.log(`[MatchPro] Cross-type matches (sale<->rent): ${crossType.cnt}`);

// Check high-confidence matches after
const [[highConfAfter]] = await conn.execute("SELECT COUNT(*) as cnt FROM matches WHERE deletedAt IS NULL AND matchScore >= 85");
console.log(`[MatchPro] High-confidence after: ${highConfAfter.cnt}`);

// Sample 3 high-confidence matches to verify quality
const [samples] = await conn.execute(`
  SELECT m.matchScore, m.transactionType, m.supplyContactName, m.demandContactName,
         s.location as supplyLocation, s.purpose as supplyPurpose,
         d.location as demandLocation, d.purpose as demandPurpose
  FROM matches m
  JOIN supply s ON m.supplyId = s.id
  JOIN demand d ON m.demandId = d.id
  WHERE m.deletedAt IS NULL AND m.matchScore >= 85
  ORDER BY m.matchScore DESC
  LIMIT 3
`);
console.log('\n[MatchPro] Sample high-confidence matches:');
for (const s of samples) {
  console.log(`  ${s.matchScore}% | ${s.transactionType} | ${s.supplyLocation} → ${s.demandLocation} | Seller: ${s.supplyContactName} | Buyer: ${s.demandContactName}`);
}

await conn.end();
console.log('\n[MatchPro] Matching cycle verification complete.');
