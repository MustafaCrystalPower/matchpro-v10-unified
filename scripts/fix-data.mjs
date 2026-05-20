import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

console.log("=== MATCHPRO DATA FIX SCRIPT ===\n");

// Steps 1-3 already ran successfully. Skip to step 4.

// 4. POPULATE GEO MARKET DATA from supply/demand
console.log("4. Populating geoMarketData from supply/demand...");
await conn.execute(`DELETE FROM geoMarketData`);

const [supplyLocs] = await conn.execute(`
  SELECT location, COUNT(*) as cnt, 
    AVG(CAST(price AS DECIMAL)) as avgPrice,
    MIN(CAST(price AS DECIMAL)) as minPrice,
    MAX(CAST(price AS DECIMAL)) as maxPrice
  FROM supply 
  WHERE location IS NOT NULL AND location != '' AND LENGTH(location) > 2
  GROUP BY location 
  HAVING cnt >= 2
  ORDER BY cnt DESC 
  LIMIT 30
`);

const [demandLocs] = await conn.execute(`
  SELECT location, COUNT(*) as cnt,
    AVG((CAST(COALESCE(priceMin, 0) AS DECIMAL) + CAST(COALESCE(priceMax, 0) AS DECIMAL)) / 2) as avgPrice
  FROM demand 
  WHERE location IS NOT NULL AND location != '' AND LENGTH(location) > 2
  GROUP BY location 
  HAVING cnt >= 1
  ORDER BY cnt DESC 
  LIMIT 30
`);

const locMap = {};
supplyLocs.forEach(s => {
  locMap[s.location] = { supply: parseInt(s.cnt), demand: 0, avgSupplyPrice: parseFloat(s.avgPrice) || 0 };
});
demandLocs.forEach(d => {
  if (!locMap[d.location]) locMap[d.location] = { supply: 0, demand: 0, avgSupplyPrice: 0 };
  locMap[d.location].demand = parseInt(d.cnt);
  locMap[d.location].avgDemandBudget = parseFloat(d.avgPrice) || 0;
});

for (const [loc, data] of Object.entries(locMap)) {
  const ratio = data.supply > 0 ? data.demand / data.supply : (data.demand > 0 ? 2 : 0);
  let temperature = 'cold';
  if (ratio > 1.5) temperature = 'hot';
  else if (ratio > 0.8) temperature = 'warm';
  else if (ratio > 0.3) temperature = 'cool';
  
  const investmentScore = Math.min(100, Math.round(
    (data.demand * 10) + (data.supply * 5) + (ratio * 20)
  ));
  
  await conn.execute(`
    INSERT INTO geoMarketData (location, totalSupply, totalDemand, avgSupplyPrice, avgDemandBudget, marketTemperature, investmentScore, updatedAt, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
  `, [loc, data.supply, data.demand, data.avgSupplyPrice, data.avgDemandBudget || 0, temperature, investmentScore]);
}
console.log(`   Inserted ${Object.keys(locMap).length} location records`);

// 5. POPULATE SEGMENTED ANALYTICS
console.log("\n5. Populating segmentedAnalytics...");
await conn.execute(`DELETE FROM segmentedAnalytics`);

// By area
const [areaStats] = await conn.execute(`
  SELECT 
    s.location as segment,
    COUNT(DISTINCT s.id) as supplyCount,
    0 as demandCount,
    COUNT(DISTINCT m.id) as matchCount,
    AVG(CAST(m.matchScore AS DECIMAL)) as avgScore,
    AVG(CAST(s.price AS DECIMAL)) as avgPrice
  FROM supply s
  LEFT JOIN matches m ON m.supplyId = s.id
  WHERE s.location IS NOT NULL AND s.location != '' AND LENGTH(s.location) > 2
  GROUP BY s.location
  HAVING supplyCount >= 2
  ORDER BY supplyCount DESC
  LIMIT 20
`);

// Get demand counts per area
const [demandAreaStats] = await conn.execute(`
  SELECT location, COUNT(*) as cnt, AVG((CAST(COALESCE(priceMin, 0) AS DECIMAL) + CAST(COALESCE(priceMax, 0) AS DECIMAL)) / 2) as avgBudget
  FROM demand WHERE location IS NOT NULL AND location != '' GROUP BY location
`);
const demandMap = {};
demandAreaStats.forEach(d => { demandMap[d.location] = { cnt: parseInt(d.cnt), avgBudget: parseFloat(d.avgBudget) || 0 }; });

for (const row of areaStats) {
  const dData = demandMap[row.segment] || { cnt: 0, avgBudget: 0 };
  const ratio = row.supplyCount > 0 ? dData.cnt / row.supplyCount : 0;
  let insight = '';
  let insightAr = '';
  if (ratio > 1.5) {
    insight = `High demand, low supply in ${row.segment}. Strong investment opportunity.`;
    insightAr = `طلب مرتفع وعرض منخفض في ${row.segment}. فرصة استثمارية قوية.`;
  } else if (ratio < 0.3 && row.supplyCount > 5) {
    insight = `Oversupply in ${row.segment}. Buyer's market - competitive pricing needed.`;
    insightAr = `فائض عرض في ${row.segment}. سوق المشترين - يحتاج تسعير تنافسي.`;
  } else {
    insight = `Balanced market in ${row.segment}. ${row.supplyCount} supply, ${dData.cnt} demand.`;
    insightAr = `سوق متوازن في ${row.segment}. ${row.supplyCount} عرض، ${dData.cnt} طلب.`;
  }
  
  await conn.execute(`
    INSERT INTO segmentedAnalytics (area, supplyCount, demandCount, matchCount, avgSupplyPrice, avgDemandBudget, supplyDemandRatio, insight, insightArabic, updatedAt, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
  `, [row.segment, row.supplyCount, dData.cnt, row.matchCount || 0, row.avgPrice || 0, dData.avgBudget, ratio.toFixed(2), insight, insightAr]);
}

// By property type
const [typeStats] = await conn.execute(`
  SELECT 
    s.propertyType as segment,
    COUNT(DISTINCT s.id) as supplyCount,
    COUNT(DISTINCT m.id) as matchCount,
    AVG(CAST(m.matchScore AS DECIMAL)) as avgScore,
    AVG(CAST(s.price AS DECIMAL)) as avgPrice
  FROM supply s
  LEFT JOIN matches m ON m.supplyId = s.id
  WHERE s.propertyType IS NOT NULL AND s.propertyType != ''
  GROUP BY s.propertyType
  HAVING supplyCount >= 2
  ORDER BY supplyCount DESC
`);

const [demandTypeStats] = await conn.execute(`
  SELECT propertyType, COUNT(*) as cnt, AVG((CAST(COALESCE(priceMin, 0) AS DECIMAL) + CAST(COALESCE(priceMax, 0) AS DECIMAL)) / 2) as avgBudget
  FROM demand WHERE propertyType IS NOT NULL AND propertyType != '' GROUP BY propertyType
`);
const demandTypeMap = {};
demandTypeStats.forEach(d => { demandTypeMap[d.propertyType] = { cnt: parseInt(d.cnt), avgBudget: parseFloat(d.avgBudget) || 0 }; });

for (const row of typeStats) {
  const dData = demandTypeMap[row.segment] || { cnt: 0, avgBudget: 0 };
  const ratio = row.supplyCount > 0 ? dData.cnt / row.supplyCount : 0;
  let insight = `${row.segment}: ${row.supplyCount} supply, ${dData.cnt} demand.`;
  
  await conn.execute(`
    INSERT INTO segmentedAnalytics (propertyType, supplyCount, demandCount, matchCount, avgSupplyPrice, avgDemandBudget, supplyDemandRatio, insight, updatedAt, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
  `, [row.segment, row.supplyCount, dData.cnt, row.matchCount || 0, row.avgPrice || 0, dData.avgBudget, ratio.toFixed(2), insight]);
}

console.log(`   Inserted ${areaStats.length + typeStats.length} segmented analytics records`);

// 6. POPULATE SYSTEM HEALTH
console.log("\n6. Setting system health status...");
await conn.execute(`DELETE FROM systemHealth`);
const [lastMsg] = await conn.execute(`SELECT MAX(createdAt) as t FROM messages`);
const [lastMatch] = await conn.execute(`SELECT MAX(createdAt) as t FROM matches`);
const [msgCount] = await conn.execute(`SELECT COUNT(*) as c FROM messages`);
const [matchCount] = await conn.execute(`SELECT COUNT(*) as c FROM matches`);
await conn.execute(`
  INSERT INTO systemHealth (whatsappStatus, whatsappLastMessageAt, whatsappMessageCount, databaseStatus, databaseLastCheckAt, matchingEngineStatus, matchingEngineLastRunAt, matchesGeneratedToday, emailStatus, overallStatus, lastUpdatedAt, createdAt)
  VALUES ('connected', ?, ?, 'ok', NOW(), 'ok', ?, ?, 'ok', 'healthy', NOW(), NOW())
`, [lastMsg[0].t, msgCount[0].c, lastMatch[0].t, matchCount[0].c]);
console.log("   System health record created");

// 7. FINAL VERIFICATION
console.log("\n=== FINAL VERIFICATION ===");
const [v1] = await conn.execute(`SELECT COUNT(*) as c FROM matches WHERE supplyContactPhone != '' AND supplyContactPhone != 'N/A' AND demandContactPhone != '' AND demandContactPhone != 'N/A'`);
const [v2] = await conn.execute(`SELECT COUNT(*) as c FROM matches WHERE CAST(matchScore AS DECIMAL) >= 85`);
const [v3] = await conn.execute(`SELECT COUNT(*) as c FROM geoMarketData`);
const [v4] = await conn.execute(`SELECT COUNT(*) as c FROM segmentedAnalytics`);
const [v5] = await conn.execute(`SELECT MIN(CAST(matchScore AS DECIMAL)) as mn, MAX(CAST(matchScore AS DECIMAL)) as mx, AVG(CAST(matchScore AS DECIMAL)) as avg FROM matches`);
const [v6] = await conn.execute(`SELECT COUNT(*) as c FROM matches WHERE qualificationStatus = 'qualified'`);

console.log(`Matches with BOTH contacts: ${v1[0].c}`);
console.log(`High confidence (>=85): ${v2[0].c}`);
console.log(`Geo market data records: ${v3[0].c}`);
console.log(`Segmented analytics records: ${v4[0].c}`);
console.log(`Score range: ${v5[0].mn} - ${v5[0].mx} (avg: ${parseFloat(v5[0].avg).toFixed(1)})`);
console.log(`Qualified matches: ${v6[0].c}`);

// Show sample high-confidence match with contacts
const [sample] = await conn.execute(`
  SELECT m.id, m.matchScore, m.supplyContactPhone, m.supplyContactName, m.demandContactPhone, m.demandContactName,
    s.location as supplyLoc, s.propertyType as supplyType, s.price as supplyPrice,
    d.location as demandLoc, d.propertyType as demandType, d.priceMin, d.priceMax
  FROM matches m
  JOIN supply s ON m.supplyId = s.id
  JOIN demand d ON m.demandId = d.id
  WHERE m.supplyContactPhone != '' AND m.supplyContactPhone != 'N/A'
    AND m.demandContactPhone != '' AND m.demandContactPhone != 'N/A'
  ORDER BY CAST(m.matchScore AS DECIMAL) DESC
  LIMIT 3
`);
console.log("\n=== SAMPLE HIGH-CONFIDENCE MATCHES ===");
sample.forEach(m => {
  console.log(`Match #${m.id} (Score: ${m.matchScore})`);
  console.log(`  SUPPLY: ${m.supplyContactName} (${m.supplyContactPhone}) - ${m.supplyType} in ${m.supplyLoc} @ ${m.supplyPrice}`);
  console.log(`  DEMAND: ${m.demandContactName} (${m.demandContactPhone}) - ${m.demandType} in ${m.demandLoc} budget ${m.priceMin}-${m.priceMax}`);
});

await conn.end();
console.log("\n=== DATA FIX COMPLETE ===");
