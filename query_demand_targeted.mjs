import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './drizzle/schema.ts';
import { like, or, and, desc } from 'drizzle-orm';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(conn, { schema, mode: 'default' });
const d = schema.demand;

// ── DEMAND keywords (must be a buyer/renter, not a seller) ──────────────────
// These keywords indicate the person is LOOKING for a property (demand)
const demandKeywords = [
  '%مطلوب%', '%محتاج%', '%محتاجة%', '%عايز%', '%عايزة%',
  '%بدور%', '%بدورة%', '%طالب%', '%طالبة%', '%ابحث%',
  '%أبحث%', '%نبحث%', '%required%', '%looking for%',
  '%wanted%', '%need%', '%seeking%',
];

// ── VILLA keywords ───────────────────────────────────────────────────────────
const villaKeywords = [
  '%فيلا%', '%villa%', '%Villa%', '%VILLA%',
  '%تاون هاوس%', '%townhouse%', '%Townhouse%', '%town house%',
  '%twin house%', '%Twin House%', '%تاون%', '%تونهاوس%',
  '%دوبلكس%', '%duplex%', '%Duplex%',
  '%توين%', '%twin%',
];

// ── PRIVADO keywords ─────────────────────────────────────────────────────────
const privadoKeywords = [
  '%بريفادو%', '%privado%', '%Privado%', '%PRIVADO%',
  '%بريفا%',
];

// ── MADINATY keywords ────────────────────────────────────────────────────────
const madinatyKeywords = [
  '%مدينتي%', '%madinaty%', '%Madinaty%', '%MADINATY%',
  '%مدينة نصر%',
];

// ── REHAB keywords ───────────────────────────────────────────────────────────
const rehabKeywords = [
  '%الرحاب%', '%rehab%', '%Rehab%', '%REHAB%',
  '%رحاب%',
];

function orLike(field, keywords) {
  return or(...keywords.map(k => like(field, k)));
}

// ── Query 1: Privado Demand ──────────────────────────────────────────────────
// People who want to buy/rent in Privado
// Check both location field AND raw message text
const privadoDemandRaw = await db.select().from(d)
  .where(
    or(
      orLike(d.location, privadoKeywords),
      orLike(d.rawMessageText, privadoKeywords),
    )
  )
  .orderBy(desc(d.createdAt))
  .limit(2000);

// ── Query 2: Villa Demand in Madinaty ────────────────────────────────────────
// People who want a villa/townhouse/twin house in Madinaty
const madinatyVillaDemandRaw = await db.select().from(d)
  .where(
    and(
      or(
        orLike(d.location, madinatyKeywords),
        orLike(d.rawMessageText, madinatyKeywords),
      ),
      or(
        orLike(d.propertyType, villaKeywords),
        orLike(d.rawMessageText, villaKeywords),
      )
    )
  )
  .orderBy(desc(d.createdAt))
  .limit(2000);

// ── Query 3: Villa Demand in Rehab ───────────────────────────────────────────
// People who want a villa/townhouse/twin house in Rehab
const rehabVillaDemandRaw = await db.select().from(d)
  .where(
    and(
      or(
        orLike(d.location, rehabKeywords),
        orLike(d.rawMessageText, rehabKeywords),
      ),
      or(
        orLike(d.propertyType, villaKeywords),
        orLike(d.rawMessageText, villaKeywords),
      )
    )
  )
  .orderBy(desc(d.createdAt))
  .limit(2000);

console.log('Raw counts:', {
  privadoDemand: privadoDemandRaw.length,
  madinatyVillaDemand: madinatyVillaDemandRaw.length,
  rehabVillaDemand: rehabVillaDemandRaw.length,
});

// ── Deduplication ────────────────────────────────────────────────────────────
function extractPhones(text) {
  if (!text) return [];
  const matches = String(text).match(/(?:(?:\+?2|00)?01[0-9]{9})/g) || [];
  return [...new Set(matches.map(p => {
    p = p.replace(/\s+/g, '');
    if (p.startsWith('+2')) return p.slice(2);
    if (p.startsWith('002')) return p.slice(3);
    return p;
  }))].filter(p => p.length >= 10);
}

function dedup(records) {
  const seen = new Set();
  return records.filter(r => {
    // Primary contact from DB
    const dbPhone = (r.contact || '').replace(/\s+/g,'');
    // All phones from raw text
    const textPhones = extractPhones(r.rawMessageText);
    const primaryPhone = dbPhone.length >= 10 ? dbPhone : (textPhones[0] || '');
    
    const loc = (r.location || '').toLowerCase().trim().substring(0, 25);
    const type = (r.propertyType || '').toLowerCase().trim().substring(0, 15);
    const budget = String(r.priceMax || r.priceMin || '');
    
    // Dedup key: phone + location + budget (same person asking same thing)
    const key = `${primaryPhone}|${loc}|${budget}`;
    if (!primaryPhone && !loc) return true; // keep if no identifier
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const privadoDemand      = dedup(privadoDemandRaw);
const madinatyVillaDemand = dedup(madinatyVillaDemandRaw);
const rehabVillaDemand   = dedup(rehabVillaDemandRaw);

console.log('After dedup:', {
  privadoDemand: privadoDemand.length,
  madinatyVillaDemand: madinatyVillaDemand.length,
  rehabVillaDemand: rehabVillaDemand.length,
});

// ── Save ─────────────────────────────────────────────────────────────────────
fs.writeFileSync('/tmp/demand_targeted.json', JSON.stringify({
  privadoDemand,
  madinatyVillaDemand,
  rehabVillaDemand,
}, null, 2));

console.log('SAVED');
await conn.end();
