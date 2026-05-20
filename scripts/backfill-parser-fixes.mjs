/**
 * Backfill script: Fix contactName, bedrooms, and purpose in existing supply/demand rows
 * 
 * Fixes:
 * 1. contactName: Replace invalid names (duration phrases, call-to-action words) with senderName from messages table
 * 2. bedrooms: Null out values where the source text contains "N شهور" (duration) patterns
 * 3. purpose: Re-parse purpose for NULL rows using expanded keyword list (لتمليك, تمليك, etc.)
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const conn = await mysql.createConnection(DATABASE_URL);

// ─── 1. Fix contactName in supply ────────────────────────────────────────────
console.log('\n[1/4] Fixing supply contactName...');

// Words that should NOT appear in a valid contact name
const INVALID_NAME_WORDS = [
  'شهور', 'أشهر', 'اشهر', 'سنه', 'سنة', 'شهر',
  'للتواصل', 'تواصل', 'واتس', 'واتساب', 'اتصل', 'تليفون',
  'عميل', 'مليون', 'مين', 'معاينه', 'معاينة', 'بكره', 'بكرة',
  'غرف', 'غرفة', 'غرفتين', 'شقة', 'شقه', 'فيلا', 'مطلوب',
  'للبيع', 'للايجار', 'بند', 'دور', 'طابق', 'متر',
  'apartment', 'villa', 'room', 'floor', 'contact', 'whatsapp'
];

function isInvalidName(name) {
  if (!name || name === 'Unknown' || name.trim().length < 2) return true;
  const nameLower = name.toLowerCase();
  if (INVALID_NAME_WORDS.some(w => nameLower.includes(w.toLowerCase()))) return true;
  // Phone number pattern
  if (/01[0125]\d{8}/.test(name)) return true;
  // Mostly digits
  if ((name.match(/\d/g) || []).length > name.length * 0.4) return true;
  return false;
}

// Get all supply rows with potentially invalid contactName
const [supplyRows] = await conn.execute(
  `SELECT s.id, s.contactName, s.messageId, m.senderName 
   FROM supply s 
   LEFT JOIN messages m ON s.messageId = m.id
   WHERE s.contactName IS NULL OR s.contactName = 'Unknown' OR LENGTH(s.contactName) < 2`
);

let supplyFixed = 0;
for (const row of supplyRows) {
  if (isInvalidName(row.contactName)) {
    const newName = (row.senderName && row.senderName !== 'Unknown') ? row.senderName : null;
    if (newName && newName !== row.contactName) {
      await conn.execute('UPDATE supply SET contactName = ? WHERE id = ?', [newName, row.id]);
      supplyFixed++;
    }
  }
}
console.log(`  Fixed ${supplyFixed} supply rows with invalid contactName`);

// Also fix supply rows where contactName contains invalid words but is not null/Unknown
const [supplyAllRows] = await conn.execute(
  `SELECT s.id, s.contactName, m.senderName 
   FROM supply s 
   LEFT JOIN messages m ON s.messageId = m.id
   WHERE s.contactName IS NOT NULL AND s.contactName != 'Unknown'`
);

let supplyWordFixed = 0;
for (const row of supplyAllRows) {
  if (isInvalidName(row.contactName)) {
    const newName = (row.senderName && row.senderName !== 'Unknown') ? row.senderName : 'Unknown';
    await conn.execute('UPDATE supply SET contactName = ? WHERE id = ?', [newName, row.id]);
    supplyWordFixed++;
  }
}
console.log(`  Fixed ${supplyWordFixed} additional supply rows with invalid-word contactName`);

// ─── 2. Fix contactName in demand ────────────────────────────────────────────
console.log('\n[2/4] Fixing demand contactName...');

const [demandRows] = await conn.execute(
  `SELECT d.id, d.contactName, d.messageId, m.senderName 
   FROM demand d 
   LEFT JOIN messages m ON d.messageId = m.id`
);

let demandFixed = 0;
for (const row of demandRows) {
  if (isInvalidName(row.contactName)) {
    const newName = (row.senderName && row.senderName !== 'Unknown') ? row.senderName : 'Unknown';
    if (newName !== row.contactName) {
      await conn.execute('UPDATE demand SET contactName = ? WHERE id = ?', [newName, row.id]);
      demandFixed++;
    }
  }
}
console.log(`  Fixed ${demandFixed} demand rows with invalid contactName`);

// ─── 3. Fix bedrooms in supply/demand ────────────────────────────────────────
console.log('\n[3/4] Fixing bedroom extraction errors...');

// Duration pattern: a number immediately followed by شهور/أشهر/سنه/سنة
const DURATION_PATTERN = /\d+\s*(?:شهور|أشهر|اشهر|شهر|سنه|سنة|سنوات|يوم|أيام|ايام)/;

const [supplyBedroomRows] = await conn.execute(
  `SELECT s.id, s.bedrooms, m.messageText 
   FROM supply s 
   LEFT JOIN messages m ON s.messageId = m.id
   WHERE s.bedrooms IS NOT NULL AND s.bedrooms > 0`
);

let bedroomFixed = 0;
for (const row of supplyBedroomRows) {
  if (!row.messageText) continue;
  
  // Check if the message contains a duration pattern that could have been misread as bedrooms
  if (DURATION_PATTERN.test(row.messageText)) {
    // Check if the bedroom number appears in a duration context
    const bedroomNum = row.bedrooms;
    const durationRegex = new RegExp(`${bedroomNum}\\s*(?:شهور|أشهر|اشهر|شهر|سنه|سنة|سنوات|يوم|أيام|ايام)`);
    
    if (durationRegex.test(row.messageText)) {
      // The bedroom count likely came from a duration phrase — null it out
      // But only if there's no explicit bedroom keyword in the message
      const hasBedroomKeyword = /غرف|غرفة|غرفتين|نوم|bedroom|bedrooms/i.test(row.messageText);
      if (!hasBedroomKeyword) {
        await conn.execute('UPDATE supply SET bedrooms = NULL WHERE id = ?', [row.id]);
        bedroomFixed++;
      }
    }
  }
}
console.log(`  Fixed ${bedroomFixed} supply rows with duration-misread bedrooms`);

// Same for demand
const [demandBedroomRows] = await conn.execute(
  `SELECT d.id, d.bedrooms, m.messageText 
   FROM demand d 
   LEFT JOIN messages m ON d.messageId = m.id
   WHERE d.bedrooms IS NOT NULL AND d.bedrooms > 0`
);

let demandBedroomFixed = 0;
for (const row of demandBedroomRows) {
  if (!row.messageText) continue;
  
  if (DURATION_PATTERN.test(row.messageText)) {
    const bedroomNum = row.bedrooms;
    const durationRegex = new RegExp(`${bedroomNum}\\s*(?:شهور|أشهر|اشهر|شهر|سنه|سنة|سنوات|يوم|أيام|ايام)`);
    
    if (durationRegex.test(row.messageText)) {
      const hasBedroomKeyword = /غرف|غرفة|غرفتين|نوم|bedroom|bedrooms/i.test(row.messageText);
      if (!hasBedroomKeyword) {
        await conn.execute('UPDATE demand SET bedrooms = NULL WHERE id = ?', [row.id]);
        demandBedroomFixed++;
      }
    }
  }
}
console.log(`  Fixed ${demandBedroomFixed} demand rows with duration-misread bedrooms`);

// ─── 4. Fix purpose (sale/rent) for NULL rows ─────────────────────────────────
console.log('\n[4/4] Fixing NULL purpose values...');

const SALE_WORDS = ['للبيع', 'لتمليك', 'تمليك', 'بيع', 'for sale', 'selling', 'sale', 'ownership'];
const RENT_WORDS = ['للإيجار', 'للايجار', 'ايجار', 'إيجار', 'for rent', 'renting', 'rent', 'شهري', 'سنوي', 'ايجاري'];

function detectPurpose(text) {
  if (!text) return null;
  if (SALE_WORDS.some(w => text.includes(w))) return 'sale';
  if (RENT_WORDS.some(w => text.includes(w))) return 'rent';
  return null;
}

// Fix supply purpose
const [supplyNullPurpose] = await conn.execute(
  `SELECT s.id, m.messageText 
   FROM supply s 
   LEFT JOIN messages m ON s.messageId = m.id
   WHERE s.purpose IS NULL`
);

let supplyPurposeFixed = 0;
for (const row of supplyNullPurpose) {
  const purpose = detectPurpose(row.messageText);
  if (purpose) {
    await conn.execute('UPDATE supply SET purpose = ? WHERE id = ?', [purpose, row.id]);
    supplyPurposeFixed++;
  }
}
console.log(`  Fixed ${supplyPurposeFixed} supply rows with NULL purpose`);

// Fix demand purpose
const [demandNullPurpose] = await conn.execute(
  `SELECT d.id, m.messageText 
   FROM demand d 
   LEFT JOIN messages m ON d.messageId = m.id
   WHERE d.purpose IS NULL`
);

let demandPurposeFixed = 0;
for (const row of demandNullPurpose) {
  const purpose = detectPurpose(row.messageText);
  if (purpose) {
    await conn.execute('UPDATE demand SET purpose = ? WHERE id = ?', [purpose, row.id]);
    demandPurposeFixed++;
  }
}
console.log(`  Fixed ${demandPurposeFixed} demand rows with NULL purpose`);

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log('\n=== Backfill Summary ===');
const [supplyCount] = await conn.execute('SELECT COUNT(*) as cnt FROM supply');
const [demandCount] = await conn.execute('SELECT COUNT(*) as cnt FROM demand');
const [supplyUnknown] = await conn.execute("SELECT COUNT(*) as cnt FROM supply WHERE contactName IS NULL OR contactName = 'Unknown'");
const [demandUnknown] = await conn.execute("SELECT COUNT(*) as cnt FROM demand WHERE contactName IS NULL OR contactName = 'Unknown'");
const [supplyNullPurposeCount] = await conn.execute('SELECT COUNT(*) as cnt FROM supply WHERE purpose IS NULL');
const [demandNullPurposeCount] = await conn.execute('SELECT COUNT(*) as cnt FROM demand WHERE purpose IS NULL');

console.log(`Supply: ${supplyCount[0].cnt} total, ${supplyUnknown[0].cnt} still Unknown contactName, ${supplyNullPurposeCount[0].cnt} NULL purpose`);
console.log(`Demand: ${demandCount[0].cnt} total, ${demandUnknown[0].cnt} still Unknown contactName, ${demandNullPurposeCount[0].cnt} NULL purpose`);

await conn.end();
console.log('\nBackfill complete!');
