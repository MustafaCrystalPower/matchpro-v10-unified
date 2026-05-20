import { createConnection } from 'mysql2/promise';
import { readFileSync } from 'fs';

// Load env
try {
  const envContent = readFileSync('/home/ubuntu/matchpro-dashboard/.env', 'utf-8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
  });
} catch(e) {}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('No DATABASE_URL'); process.exit(1); }

const url = new URL(DATABASE_URL.replace('mysql://', 'http://'));
const conn = await createConnection({
  host: url.hostname,
  port: parseInt(url.port) || 3306,
  user: url.username,
  password: url.password,
  database: url.pathname.slice(1),
  ssl: { rejectUnauthorized: false },
});

console.log('Connected to database');

// Create userAssets table
try {
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS userAssets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      propertyType VARCHAR(64) NOT NULL,
      location VARCHAR(256) NOT NULL,
      area VARCHAR(256),
      size INT,
      bedrooms INT,
      bathrooms INT,
      price DECIMAL(15,2),
      priceType ENUM('sale','rent') NOT NULL DEFAULT 'sale',
      rentalPeriod ENUM('monthly','yearly'),
      description TEXT,
      contactPhone VARCHAR(20),
      status ENUM('active','sold','rented','inactive') DEFAULT 'active',
      matchCount INT DEFAULT 0,
      newMatchCount INT DEFAULT 0,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
      INDEX idx_userId (userId),
      INDEX idx_status (status),
      INDEX idx_location (location(100))
    )
  `);
  console.log('✅ userAssets table created (or already exists)');
} catch(e) {
  console.error('❌ userAssets:', e.message);
}

// Create assetMatches table
try {
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS assetMatches (
      id INT AUTO_INCREMENT PRIMARY KEY,
      assetId INT NOT NULL,
      demandId INT NOT NULL,
      matchScore DECIMAL(5,2),
      matchReason TEXT,
      status ENUM('new','contacted','interested','closed') DEFAULT 'new',
      sentToEmail TINYINT DEFAULT 0,
      sentAt TIMESTAMP NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
      UNIQUE KEY unique_asset_demand (assetId, demandId),
      INDEX idx_assetId (assetId),
      INDEX idx_demandId (demandId),
      INDEX idx_status (status)
    )
  `);
  console.log('✅ assetMatches table created (or already exists)');
} catch(e) {
  console.error('❌ assetMatches:', e.message);
}

// Get owner user
const [users] = await conn.execute('SELECT id, email FROM users ORDER BY id LIMIT 5');
console.log('Users:', JSON.stringify(users));

if (users.length === 0) {
  console.log('No users found — cannot insert assets');
  await conn.end();
  process.exit(0);
}

const userId = users[0].id;
console.log('Using userId:', userId);

// Insert M's assets
const assets = [
  {
    propertyType: 'Apartment',
    location: 'Privado',
    area: 'Madinaty',
    size: null,
    bedrooms: null,
    bathrooms: null,
    price: null,
    priceType: 'sale',
    rentalPeriod: null,
    description: 'Apartments for sale in Privado compound, Madinaty. Multiple units available. Immediate delivery. Talaat Mostafa Group contract.',
    contactPhone: '+201066505665',
  },
  {
    propertyType: 'Studio',
    location: 'Privado',
    area: 'Group 131-132',
    size: 64,
    bedrooms: 1,
    bathrooms: 1,
    price: 3600000,
    priceType: 'sale',
    rentalPeriod: null,
    description: 'Studio 64m² in Privado Group 131 or 132. Total price ~3.6M EGP. Monthly installment ~8,000 EGP. Annual 230,000-240,000 EGP.',
    contactPhone: '+201066505665',
  },
  {
    propertyType: 'Apartment',
    location: 'Dreamland',
    area: null,
    size: null,
    bedrooms: null,
    bathrooms: null,
    price: null,
    priceType: 'rent',
    rentalPeriod: 'yearly',
    description: 'Apartment for rent in Dreamland. Available immediately.',
    contactPhone: '+201066505665',
  },
];

const insertedIds = [];
for (const asset of assets) {
  // Check if already exists
  const [ex] = await conn.execute(
    'SELECT id FROM userAssets WHERE userId = ? AND location = ? AND priceType = ? AND propertyType = ?',
    [userId, asset.location, asset.priceType, asset.propertyType]
  );
  if (ex.length > 0) {
    console.log(`Asset already exists: ${asset.propertyType} in ${asset.location} (${asset.priceType}) - ID: ${ex[0].id}`);
    insertedIds.push(ex[0].id);
    continue;
  }

  try {
    const [res] = await conn.execute(
      `INSERT INTO userAssets (userId, propertyType, location, area, size, bedrooms, bathrooms, price, priceType, rentalPeriod, description, contactPhone, status, matchCount, newMatchCount, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 0, 0, NOW(), NOW())`,
      [userId, asset.propertyType, asset.location, asset.area, asset.size, asset.bedrooms, asset.bathrooms, asset.price, asset.priceType, asset.rentalPeriod, asset.description, asset.contactPhone]
    );
    console.log(`✅ Inserted: ${asset.propertyType} in ${asset.location} (${asset.priceType}) — ID: ${res.insertId}`);
    insertedIds.push(res.insertId);
  } catch(e) {
    console.error(`❌ Failed: ${asset.propertyType} in ${asset.location}:`, e.message);
  }
}

// Run matching for each asset
console.log('\n--- Running matching ---');
const [allAssets] = await conn.execute('SELECT * FROM userAssets WHERE userId = ? AND status = ?', [userId, 'active']);

for (const asset of allAssets) {
  try {
    // Check what columns assetMatches has
    const [amCols] = await conn.execute('DESCRIBE assetMatches');
    const amColNames = amCols.map(c => c.Field);
    const hasMatchReason = amColNames.includes('matchReason');
    const insertCols = hasMatchReason
      ? 'assetId, demandId, matchScore, matchReason, status, createdAt, updatedAt'
      : 'assetId, demandId, matchScore, status, createdAt, updatedAt';
    const selectCols = hasMatchReason
      ? `?, d.id, score, CONCAT('Location: ', d.location, ' | Type: ', COALESCE(d.propertyType,'any')), 'new', NOW(), NOW()`
      : `?, d.id, score, 'new', NOW(), NOW()`;
    const [res] = await conn.execute(
      `INSERT IGNORE INTO assetMatches (${insertCols})
       SELECT ${selectCols}
       FROM (
         SELECT d.id, d.location, d.propertyType, d.priceMax, d.priceMin, d.bedrooms,
           LEAST(100, (
             (CASE WHEN LOWER(d.location) LIKE LOWER(CONCAT('%', ?, '%')) OR LOWER(?) LIKE LOWER(CONCAT('%', d.location, '%')) THEN 40 ELSE 0 END) +
             (CASE WHEN LOWER(d.propertyType) LIKE LOWER(CONCAT('%', ?, '%')) OR LOWER(?) LIKE LOWER(CONCAT('%', d.propertyType, '%')) THEN 30 ELSE 0 END) +
             (CASE WHEN (d.priceMax IS NULL OR d.priceMax = 0 OR d.priceMax >= ?) AND (d.priceMin IS NULL OR d.priceMin = 0 OR d.priceMin <= ?) THEN 20 ELSE 0 END) +
             (CASE WHEN d.bedrooms IS NULL OR d.bedrooms = 0 OR d.bedrooms = ? THEN 10 ELSE 0 END)
           )) AS score
         FROM demand d
         WHERE (LOWER(d.location) LIKE LOWER(CONCAT('%', ?, '%')) OR LOWER(?) LIKE LOWER(CONCAT('%', d.location, '%')))
         HAVING score >= 60
         ORDER BY score DESC
         LIMIT 500
       ) AS d`,
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

    // Update match counts
    await conn.execute(
      `UPDATE userAssets SET 
        matchCount = (SELECT COUNT(*) FROM assetMatches WHERE assetId = ?),
        newMatchCount = (SELECT COUNT(*) FROM assetMatches WHERE assetId = ? AND status = 'new'),
        updatedAt = NOW()
       WHERE id = ?`,
      [asset.id, asset.id, asset.id]
    );

    const [countRes] = await conn.execute('SELECT matchCount, newMatchCount FROM userAssets WHERE id = ?', [asset.id]);
    console.log(`✅ ${asset.propertyType} in ${asset.location}: ${newMatches} new matches, total: ${countRes[0]?.matchCount}, new: ${countRes[0]?.newMatchCount}`);
  } catch(e) {
    console.error(`❌ Matching failed for asset ${asset.id} (${asset.propertyType}):`, e.message);
  }
}

await conn.end();
console.log('\n✅ All done!');
