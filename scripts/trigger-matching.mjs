import { createRequire } from 'module';
import { config } from 'dotenv';
config();

// Call the matching cycle via the live server's tRPC endpoint
// using the session cookie from a direct DB call to get an admin token
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Get current match counts before
const [[before]] = await conn.execute(
  'SELECT COUNT(*) as cnt FROM matches WHERE deletedAt IS NULL'
);
console.log(`Before: ${before.cnt} active matches`);

// Run the matching engine directly
const { execSync } = createRequire(import.meta.url)('child_process');
try {
  const result = execSync(
    `npx tsx --tsconfig tsconfig.json -e "
import { runFullMatchingCycle } from './server/matchingEngine.ts';
const r = await runFullMatchingCycle();
console.log(JSON.stringify(r));
"`,
    { timeout: 110000, cwd: '/home/ubuntu/matchpro-dashboard', encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
  );
  console.log('Matching result:', result.trim().slice(-500));
} catch(e) {
  console.error('Error:', e.stderr?.slice(0, 500) || e.message?.slice(0, 500));
}

// Get match counts after
const [[after]] = await conn.execute(
  `SELECT 
    COUNT(*) as total,
    SUM(CASE WHEN CAST(matchScore AS DECIMAL) >= 90 THEN 1 ELSE 0 END) as excellent,
    SUM(CASE WHEN CAST(matchScore AS DECIMAL) >= 80 THEN 1 ELSE 0 END) as great,
    ROUND(AVG(CAST(matchScore AS DECIMAL)),1) as avg_score
  FROM matches WHERE deletedAt IS NULL`
);
console.log(`After: ${after.total} active matches | ${after.excellent} excellent (≥90%) | ${after.great} great (≥80%) | avg ${after.avg_score}%`);

await conn.end();
