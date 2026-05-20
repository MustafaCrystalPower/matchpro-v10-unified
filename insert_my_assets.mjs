import { createConnection } from 'mysql2/promise';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';

// Load env from .env file
try {
  const envContent = readFileSync('/home/ubuntu/matchpro-dashboard/.env', 'utf-8');
  envContent.split('\n').forEach(line => {
    const [k, ...v] = line.split('=');
    if (k && v.length) process.env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
  });
} catch(e) {}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('No DATABASE_URL'); process.exit(1); }

// Parse mysql connection string
const url = new URL(DATABASE_URL.replace('mysql://', 'http://'));
const conn = await createConnection({
  host: url.hostname,
  port: parseInt(url.port) || 3306,
  user: url.username,
  password: url.password,
  database: url.pathname.slice(1),
  ssl: { rejectUnauthorized: false },
  multipleStatements: false,
});

// Check table structure
const [cols] = await conn.execute('DESCRIBE userAssets');
console.log('COLUMNS:', cols.map(c => c.Field).join(', '));

// Get owner user
const [users] = await conn.execute('SELECT id, email FROM user LIMIT 5');
console.log('USERS:', JSON.stringify(users));

if (users.length === 0) {
  console.log('No users found - assets will be added without userId');
}

const userId = users[0]?.id || 1;
console.log('Using userId:', userId);

// Check existing assets
const [existing] = await conn.execute('SELECT id, propertyType, location FROM userAssets WHERE userId = ?', [userId]);
console.log('Existing assets:', JSON.stringify(existing));

// Insert M's assets
const assets = [
  {
    userId,
    propertyType: 'Apartment',
    location: 'Privado',
    area: 'Madinaty',
    size: null,
    bedrooms: null,
    bathrooms: null,
    price: null,
    purpose: 'sale',
    rentalPeriod: null,
    description: 'Apartments for sale in Privado compound, Madinaty. Multiple units available. Immediate delivery.',
    contactPhone: '+201066505665',
    status: 'active',
  },
  {
    userId,
    propertyType: 'Studio',
    location: 'Privado',
    area: 'Group 131-132',
    size: 64,
    bedrooms: 1,
    bathrooms: 1,
    price: 3600000,
    purpose: 'sale',
    rentalPeriod: null,
    description: 'Studio 64m² in Privado Group 131 or 132. Total price ~3.6M EGP. Monthly installment ~8,000 EGP. Annual 230,000-240,000 EGP.',
    contactPhone: '+201066505665',
    status: 'active',
  },
  {
    userId,
    propertyType: 'Apartment',
    location: 'Dreamland',
    area: null,
    size: null,
    bedrooms: null,
    bathrooms: null,
    price: null,
    purpose: 'rent',
    rentalPeriod: 'yearly',
    description: 'Apartment for rent in Dreamland. Available immediately.',
    contactPhone: '+201066505665',
    status: 'active',
  },
];

for (const asset of assets) {
  // Check if already exists
  const [ex] = await conn.execute(
    'SELECT id FROM userAssets WHERE userId = ? AND location = ? AND purpose = ? AND propertyType = ?',
    [asset.userId, asset.location, asset.purpose, asset.propertyType]
  );
  if (ex.length > 0) {
    console.log(`Asset already exists: ${asset.propertyType} in ${asset.location} (${asset.purpose}) - skipping`);
    continue;
  }

  const cols2 = ['userId', 'propertyType', 'location', 'area', 'size', 'bedrooms', 'bathrooms', 'price', 'purpose', 'rentalPeriod', 'description', 'contactPhone', 'status', 'matchCount', 'newMatchCount', 'createdAt', 'updatedAt'];
  const vals = [asset.userId, asset.propertyType, asset.location, asset.area, asset.size, asset.bedrooms, asset.bathrooms, asset.price, asset.purpose, asset.rentalPeriod, asset.description, asset.contactPhone, asset.status, 0, 0, new Date(), new Date()];
  
  try {
    const [res] = await conn.execute(
      `INSERT INTO userAssets (${cols2.join(',')}) VALUES (${cols2.map(() => '?').join(',')})`,
      vals
    );
    console.log(`✅ Inserted: ${asset.propertyType} in ${asset.location} (${asset.purpose}) — ID: ${res.insertId}`);
  } catch(e) {
    console.error(`❌ Failed to insert ${asset.propertyType} in ${asset.location}:`, e.message);
    // Try without area/rentalPeriod if those columns don't exist
    try {
      const [res2] = await conn.execute(
        'INSERT INTO userAssets (userId, propertyType, location, size, bedrooms, bathrooms, price, purpose, description, contactPhone, status, matchCount, newMatchCount, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [asset.userId, asset.propertyType, asset.location, asset.size, asset.bedrooms, asset.bathrooms, asset.price, asset.purpose, asset.description, asset.contactPhone, asset.status, 0, 0, new Date(), new Date()]
      );
      console.log(`✅ Inserted (fallback): ${asset.propertyType} in ${asset.location} — ID: ${res2.insertId}`);
    } catch(e2) {
      console.error(`❌ Fallback also failed:`, e2.message);
    }
  }
}

// Now run matching for each asset
console.log('\n--- Running matching for all assets ---');
const [allAssets] = await conn.execute('SELECT * FROM userAssets WHERE userId = ? AND status = ?', [userId, 'active']);
console.log(`Found ${allAssets.length} active assets`);

for (const asset of allAssets) {
  try {
    const [res] = await conn.execute(
      `INSERT IGNORE INTO assetMatches (assetId, demandId, matchScore, matchReason, status, createdAt, updatedAt)
       SELECT ?, d.id,
         LEAST(100, (
           (CASE WHEN LOWER(d.location) LIKE LOWER(CONCAT('%', ?, '%')) OR LOWER(?) LIKE LOWER(CONCAT('%', d.location, '%')) THEN 40 ELSE 0 END) +
           (CASE WHEN LOWER(d.propertyType) LIKE LOWER(CONCAT('%', ?, '%')) OR LOWER(?) LIKE LOWER(CONCAT('%', d.propertyType, '%')) THEN 30 ELSE 0 END) +
           (CASE WHEN (d.priceMax IS NULL OR d.priceMax = 0 OR d.priceMax >= ?) AND (d.priceMin IS NULL OR d.priceMin = 0 OR d.priceMin <= ?) THEN 20 ELSE 0 END) +
           (CASE WHEN d.bedrooms IS NULL OR d.bedrooms = 0 OR d.bedrooms = ? THEN 10 ELSE 0 END)
         )) AS score,
         CONCAT('Location: ', d.location, ' | Type: ', COALESCE(d.propertyType,'any'), ' | Budget: ', COALESCE(d.priceMax,0)),
         'new', NOW(), NOW()
       FROM demand d
       WHERE (
         LOWER(d.location) LIKE LOWER(CONCAT('%', ?, '%')) OR LOWER(?) LIKE LOWER(CONCAT('%', d.location, '%'))
       )
       HAVING score >= 60
       ORDER BY score DESC
       LIMIT 500`,
      [
        asset.id,
        asset.location, asset.location,
        asset.propertyType, asset.propertyType,
        asset.price || 999999999, asset.price || 0,
        asset.bedrooms || 0,
        asset.location, asset.location,
      ]
    );
    const newMatches = res.affectedRows || 0;
    
    // Update match count
    await conn.execute(
      'UPDATE userAssets SET matchCount = (SELECT COUNT(*) FROM assetMatches WHERE assetId = ?), newMatchCount = (SELECT COUNT(*) FROM assetMatches WHERE assetId = ? AND status = ?), updatedAt = NOW() WHERE id = ?',
      [asset.id, asset.id, 'new', asset.id]
    );
    
    const [countRes] = await conn.execute('SELECT matchCount, newMatchCount FROM userAssets WHERE id = ?', [asset.id]);
    console.log(`✅ ${asset.propertyType} in ${asset.location}: ${newMatches} new matches inserted, total: ${countRes[0]?.matchCount}`);
  } catch(e) {
    console.error(`❌ Matching failed for asset ${asset.id}:`, e.message);
  }
}

await conn.end();
console.log('\n✅ Done!');
