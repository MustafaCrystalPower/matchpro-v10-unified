import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './drizzle/schema.ts';
import { like, or, and, gte, desc, sql } from 'drizzle-orm';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(conn, { schema, mode: 'default' });

const supply = schema.supply;
const demand = schema.demand;

// ── Fetch all 4 datasets sorted by date ──────────────────────────────────────

// 1. Villa Demand
const villaDemandRaw = await db.select().from(demand)
  .where(or(
    like(demand.propertyType, '%villa%'),
    like(demand.propertyType, '%فيلا%'),
    like(demand.propertyType, '%Villa%'),
    like(demand.rawMessageText, '%فيلا%'),
    like(demand.rawMessageText, '%villa%'),
    like(demand.rawMessageText, '%تاون هاوس%'),
    like(demand.rawMessageText, '%townhouse%'),
    like(demand.rawMessageText, '%twin house%'),
    like(demand.rawMessageText, '%Twin%'),
    like(demand.rawMessageText, '%تاون%'),
  ))
  .orderBy(desc(demand.createdAt))
  .limit(2000);

// 2. Madinaty Villas
const madinatyVillasRaw = await db.select().from(supply)
  .where(and(
    or(
      like(supply.location, '%مدينتي%'),
      like(supply.location, '%Madinaty%'),
      like(supply.location, '%madinaty%'),
      like(supply.rawMessageText, '%مدينتي%'),
    ),
    or(
      like(supply.propertyType, '%villa%'),
      like(supply.propertyType, '%فيلا%'),
      like(supply.propertyType, '%Villa%'),
      like(supply.rawMessageText, '%فيلا%'),
      like(supply.rawMessageText, '%villa%'),
      like(supply.rawMessageText, '%تاون هاوس%'),
      like(supply.rawMessageText, '%townhouse%'),
      like(supply.rawMessageText, '%twin house%'),
      like(supply.rawMessageText, '%دوبلكس%'),
      like(supply.rawMessageText, '%duplex%'),
      like(supply.rawMessageText, '%Twin%'),
    )
  ))
  .orderBy(desc(supply.createdAt))
  .limit(2000);

// 3. Privado Demand
const privadoDemandRaw = await db.select().from(demand)
  .where(or(
    like(demand.rawMessageText, '%بريفادو%'),
    like(demand.rawMessageText, '%privado%'),
    like(demand.rawMessageText, '%Privado%'),
    like(demand.location, '%privado%'),
    like(demand.location, '%بريفادو%'),
    like(demand.rawMessageText, '%بريفا%'),
  ))
  .orderBy(desc(demand.createdAt))
  .limit(1000);

// 4. Privado Supply
const privadoSupplyRaw = await db.select().from(supply)
  .where(or(
    like(supply.rawMessageText, '%بريفادو%'),
    like(supply.rawMessageText, '%privado%'),
    like(supply.rawMessageText, '%Privado%'),
    like(supply.location, '%privado%'),
    like(supply.location, '%بريفادو%'),
    like(supply.rawMessageText, '%بريفا%'),
  ))
  .orderBy(desc(supply.createdAt))
  .limit(1000);

// 5. VIP Properties
const vipRaw = await db.select().from(supply)
  .where(or(
    gte(supply.price, 5000000),
    like(supply.rawMessageText, '%vip%'),
    like(supply.rawMessageText, '%VIP%'),
    like(supply.rawMessageText, '%luxury%'),
    like(supply.rawMessageText, '%فاخر%'),
    like(supply.rawMessageText, '%مميز%'),
    like(supply.rawMessageText, '%بنتهاوس%'),
    like(supply.rawMessageText, '%penthouse%'),
    like(supply.rawMessageText, '%Penthouse%'),
    like(supply.rawMessageText, '%sky villa%'),
    like(supply.rawMessageText, '%سكاي%'),
    like(supply.rawMessageText, '%روف%'),
    like(supply.rawMessageText, '%roof%'),
    like(supply.rawMessageText, '%duplex%'),
    like(supply.rawMessageText, '%دوبلكس%'),
    like(supply.rawMessageText, '%بنت هاوس%'),
  ))
  .orderBy(desc(supply.price))
  .limit(2000);

console.log('Raw counts:', {
  villaDemand: villaDemandRaw.length,
  madinatyVillas: madinatyVillasRaw.length,
  privadoDemand: privadoDemandRaw.length,
  privadoSupply: privadoSupplyRaw.length,
  vip: vipRaw.length,
});

// ── Deduplication function ────────────────────────────────────────────────────
function extractAllPhones(text) {
  if (!text) return [];
  // Match all Egyptian phone formats
  const matches = String(text).match(/(?:(?:\+?2|00)?01[0-9]{9}|(?:\+?20)?1[0-9]{9})/g) || [];
  // Normalize to 01XXXXXXXXX format
  return [...new Set(matches.map(p => {
    p = p.replace(/\s+/g, '').replace(/[^\d+]/g, '');
    if (p.startsWith('+2')) return p.slice(2);
    if (p.startsWith('002')) return p.slice(3);
    if (p.startsWith('20') && p.length === 12) return '0' + p.slice(2);
    return p;
  }))].filter(p => p.length >= 10);
}

function dedup(records, keyFn) {
  const seen = new Set();
  return records.filter(r => {
    const key = keyFn(r);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Dedup demand by: phone + location + propertyType
function demandKey(r) {
  const phones = extractAllPhones(r.rawMessageText);
  const phone = phones[0] || '';
  const loc = (r.location || '').toLowerCase().trim().substring(0, 20);
  const type = (r.propertyType || '').toLowerCase().trim().substring(0, 15);
  const budget = r.maxBudget || r.minBudget || '';
  if (!phone && !loc) return null; // skip if no phone and no location
  return `${phone}|${loc}|${type}|${budget}`;
}

// Dedup supply by: phone + location + price
function supplyKey(r) {
  const phones = extractAllPhones(r.rawMessageText);
  const phone = phones[0] || '';
  const loc = (r.location || '').toLowerCase().trim().substring(0, 20);
  const price = r.price || r.minPrice || '';
  const size = r.size || '';
  if (!phone && !loc) return null;
  return `${phone}|${loc}|${price}|${size}`;
}

const villaDemand   = dedup(villaDemandRaw,   demandKey);
const madinatyVillas = dedup(madinatyVillasRaw, supplyKey);
const privadoDemand  = dedup(privadoDemandRaw,  demandKey);
const privadoSupply  = dedup(privadoSupplyRaw,  supplyKey);
const vipProps       = dedup(vipRaw,            supplyKey);

console.log('After dedup:', {
  villaDemand: villaDemand.length,
  madinatyVillas: madinatyVillas.length,
  privadoDemand: privadoDemand.length,
  privadoSupply: privadoSupply.length,
  vipProps: vipProps.length,
});

fs.writeFileSync('/tmp/excel_data_v2.json', JSON.stringify({
  villaDemand,
  madinatyVillas,
  privadoDemand,
  privadoSupply,
  vipProps,
}, null, 2));

console.log('DATA_SAVED');
await conn.end();
