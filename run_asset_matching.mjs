import { createConnection } from 'mysql2/promise';

const url = new URL(process.env.DATABASE_URL.replace('mysql://', 'http://'));
const conn = await createConnection({
  host: url.hostname,
  port: parseInt(url.port) || 3306,
  user: url.username,
  password: url.password,
  database: url.pathname.slice(1),
  ssl: { rejectUnauthorized: false },
});

console.log('Connected. Running matching...\n');

// Get all active assets
const [assets] = await conn.execute(
  "SELECT * FROM userAssets WHERE status = 'active' ORDER BY id"
);
console.log(`Found ${assets.length} active assets\n`);

for (const asset of assets) {
  console.log(`--- Asset ${asset.id}: ${asset.propertyType} in ${asset.location} (${asset.priceType}) ---`);

  try {
    // Insert matches using actual column names
    const [res] = await conn.execute(
      `INSERT IGNORE INTO assetMatches 
        (assetId, demandId, matchScore, locationScore, priceScore, specsScore,
         demandContact, demandContactName, demandSourceGroup, demandRawMessage,
         buyerTier, buyerIntentScore, matchReasoning, status, alertSent, createdAt)
       SELECT 
         ?, d.id,
         LEAST(100, (
           (CASE WHEN LOWER(d.location) LIKE LOWER(CONCAT('%', ?, '%')) 
                   OR LOWER(?) LIKE LOWER(CONCAT('%', d.location, '%')) THEN 40 ELSE 0 END) +
           (CASE WHEN LOWER(COALESCE(d.propertyType,'')) LIKE LOWER(CONCAT('%', ?, '%')) 
                   OR LOWER(?) LIKE LOWER(CONCAT('%', COALESCE(d.propertyType,''), '%')) 
                   OR d.propertyType IS NULL THEN 30 ELSE 0 END) +
           (CASE WHEN (d.priceMax IS NULL OR d.priceMax = 0 OR d.priceMax >= ?) 
                  AND (d.priceMin IS NULL OR d.priceMin = 0 OR d.priceMin <= ?) THEN 20 ELSE 0 END) +
           (CASE WHEN d.bedrooms IS NULL OR d.bedrooms = 0 OR d.bedrooms = ? THEN 10 ELSE 0 END)
         )) AS matchScore,
         (CASE WHEN LOWER(d.location) LIKE LOWER(CONCAT('%', ?, '%')) 
                 OR LOWER(?) LIKE LOWER(CONCAT('%', d.location, '%')) THEN 40 ELSE 0 END) AS locationScore,
         (CASE WHEN (d.priceMax IS NULL OR d.priceMax = 0 OR d.priceMax >= ?) 
                AND (d.priceMin IS NULL OR d.priceMin = 0 OR d.priceMin <= ?) THEN 20 ELSE 0 END) AS priceScore,
         (CASE WHEN d.bedrooms IS NULL OR d.bedrooms = 0 OR d.bedrooms = ? THEN 10 ELSE 0 END) AS specsScore,
         COALESCE(d.contact, '') AS demandContact,
         COALESCE(d.contactName, '') AS demandContactName,
         COALESCE(d.sourceGroup, '') AS demandSourceGroup,
         LEFT(COALESCE(d.rawMessageText, ''), 500) AS demandRawMessage,
         COALESCE(d.buyerTier, 'standard') AS buyerTier,
         COALESCE(d.buyerIntentScore, 50) AS buyerIntentScore,
         CONCAT('Location match: ', d.location, ' | Type: ', COALESCE(d.propertyType,'any'), 
                ' | Budget: ', COALESCE(d.priceMax, 0)) AS matchReasoning,
         'new', 0, NOW()
       FROM demand d
       WHERE (
         LOWER(d.location) LIKE LOWER(CONCAT('%', ?, '%')) 
         OR LOWER(?) LIKE LOWER(CONCAT('%', d.location, '%'))
       )
       HAVING matchScore >= 60
       ORDER BY matchScore DESC
       LIMIT 500`,
      [
        asset.id,
        // matchScore calc
        asset.location, asset.location,
        asset.propertyType, asset.propertyType,
        asset.price || 999999999, asset.price || 0,
        asset.bedrooms || 0,
        // locationScore
        asset.location, asset.location,
        // priceScore
        asset.price || 999999999, asset.price || 0,
        // specsScore
        asset.bedrooms || 0,
        // WHERE clause
        asset.location, asset.location,
      ]
    );

    const newMatches = res.affectedRows || 0;

    // Update match counts on the asset
    await conn.execute(
      `UPDATE userAssets SET 
        matchCount = (SELECT COUNT(*) FROM assetMatches WHERE assetId = ?),
        newMatchCount = (SELECT COUNT(*) FROM assetMatches WHERE assetId = ? AND status = 'new'),
        updatedAt = NOW()
       WHERE id = ?`,
      [asset.id, asset.id, asset.id]
    );

    const [cnt] = await conn.execute(
      'SELECT matchCount, newMatchCount FROM userAssets WHERE id = ?',
      [asset.id]
    );
    console.log(`  ✅ ${newMatches} new matches inserted | Total: ${cnt[0]?.matchCount} | New: ${cnt[0]?.newMatchCount}`);

    // Show top 3 matches
    const [top] = await conn.execute(
      `SELECT am.matchScore, am.demandContact, am.demandContactName, am.demandRawMessage
       FROM assetMatches am WHERE am.assetId = ? ORDER BY am.matchScore DESC LIMIT 3`,
      [asset.id]
    );
    for (const m of top) {
      console.log(`    📞 ${m.demandContact || 'N/A'} | ${m.demandContactName || 'Unknown'} | Score: ${m.matchScore}%`);
      console.log(`       "${(m.demandRawMessage || '').substring(0, 80)}..."`);
    }
  } catch(e) {
    console.error(`  ❌ Error: ${e.message}`);
  }
  console.log('');
}

await conn.end();
console.log('✅ Matching complete!');
