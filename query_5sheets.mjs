import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './drizzle/schema.ts';
import { like, or, and, gte, desc, sql } from 'drizzle-orm';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(conn, { schema, mode: 'default' });
const d = schema.demand;
const s = schema.supply;

function orLike(field, kws) { return or(...kws.map(k => like(field, k))); }

// ── Date filter: today + yesterday ──────────────────────────────────────────
const now = new Date();
const yesterday = new Date(now);
yesterday.setDate(yesterday.getDate() - 1);
yesterday.setHours(0, 0, 0, 0);
const yesterdayStr = yesterday.toISOString().slice(0, 10) + ' 00:00:00';

// ── Keyword groups ───────────────────────────────────────────────────────────
const rentKw    = ['%للإيجار%','%للايجار%','%إيجار%','%ايجار%','%rent%','%Rent%','%RENT%','%تأجير%','%تاجير%','%بالإيجار%','%بالايجار%'];
const studioKw  = ['%ستوديو%','%studio%','%Studio%','%STUDIO%','%استوديو%','%غرفة وصالة%','%روم%','%room%'];
const gardenKw  = ['%جاردن%','%حديقة%','%garden%','%Garden%','%GARDEN%','%تراس%','%terrace%','%حوش%'];
const privadoKw = ['%بريفادو%','%privado%','%Privado%','%PRIVADO%','%بريفا%'];
const b7Kw      = ['%B7%','%b7%','%بي 7%','%بي٧%','%B 7%','%b 7%'];
const dreamKw   = ['%دريم لاند%','%dreamland%','%Dreamland%','%DREAMLAND%','%dream land%','%Dream Land%'];
const madinatyKw= ['%مدينتي%','%madinaty%','%Madinaty%','%MADINATY%'];
const villaKw   = ['%فيلا%','%villa%','%Villa%','%VILLA%','%تاون هاوس%','%townhouse%','%Townhouse%','%twin house%','%Twin House%','%توين%','%تاون%','%دوبلكس%','%duplex%'];
const buyKw     = ['%للبيع%','%بيع%','%sale%','%Sale%','%SALE%','%شراء%','%buy%','%Buy%'];
const aptKw     = ['%شقة%','%شقه%','%apartment%','%Apartment%','%flat%','%Flat%','%وحدة%'];

// ── HELPER: dedup by phone + location + budget ───────────────────────────────
function extractPhone(text) {
  if (!text) return '';
  const m = String(text).match(/(?:(?:\+?2|00)?01[0-9]{9})/);
  if (!m) return '';
  let p = m[0].replace(/\s+/g,'');
  if (p.startsWith('+2')) p = p.slice(2);
  else if (p.startsWith('002')) p = p.slice(3);
  return p.length >= 10 ? p : '';
}

function dedup(records) {
  const seen = new Set();
  return records.filter(r => {
    const phone = (r.contact || extractPhone(r.rawMessageText) || '').replace(/\s+/g,'');
    const loc   = (r.location || '').toLowerCase().trim().slice(0, 20);
    const bud   = String(r.priceMax || r.priceMin || '');
    const key   = `${phone}|${loc}|${bud}`;
    if (!phone && !loc) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SHEET 1: Privado Studio Rentals WITH GARDEN (demand)
// ═══════════════════════════════════════════════════════════════════════════
const privadoStudioGardenRaw = await db.select().from(d)
  .where(and(
    or(orLike(d.location, privadoKw), orLike(d.rawMessageText, privadoKw)),
    or(orLike(d.propertyType, studioKw), orLike(d.rawMessageText, studioKw)),
    or(orLike(d.rawMessageText, gardenKw), orLike(d.rawMessageText, rentKw)),
  ))
  .orderBy(desc(d.createdAt)).limit(500);

// ═══════════════════════════════════════════════════════════════════════════
// SHEET 2: B7 Studio Rentals (demand)
// ═══════════════════════════════════════════════════════════════════════════
const b7StudioRentRaw = await db.select().from(d)
  .where(and(
    or(orLike(d.location, b7Kw), orLike(d.rawMessageText, b7Kw)),
    or(orLike(d.propertyType, studioKw), orLike(d.rawMessageText, studioKw)),
  ))
  .orderBy(desc(d.createdAt)).limit(500);

// ═══════════════════════════════════════════════════════════════════════════
// SHEET 3: Privado Apartment BUYERS (demand — for selling your units)
// ═══════════════════════════════════════════════════════════════════════════
const privadoAptBuyersRaw = await db.select().from(d)
  .where(and(
    or(orLike(d.location, privadoKw), orLike(d.rawMessageText, privadoKw)),
    or(orLike(d.propertyType, aptKw), orLike(d.rawMessageText, aptKw)),
  ))
  .orderBy(desc(d.createdAt)).limit(500);

// ═══════════════════════════════════════════════════════════════════════════
// SHEET 4: Dreamland Renters (demand)
// ═══════════════════════════════════════════════════════════════════════════
const dreamlandRentRaw = await db.select().from(d)
  .where(
    or(orLike(d.location, dreamKw), orLike(d.rawMessageText, dreamKw))
  )
  .orderBy(desc(d.createdAt)).limit(500);

// ═══════════════════════════════════════════════════════════════════════════
// SHEET 5: Madinaty Villa Demand — TODAY & YESTERDAY ONLY
// ═══════════════════════════════════════════════════════════════════════════
const madinatyVillaTodayRaw = await db.select().from(d)
  .where(and(
    or(orLike(d.location, madinatyKw), orLike(d.rawMessageText, madinatyKw)),
    or(orLike(d.propertyType, villaKw), orLike(d.rawMessageText, villaKw)),
    gte(d.createdAt, new Date(yesterdayStr)),
  ))
  .orderBy(desc(d.createdAt)).limit(500);

// ── Dedup all ────────────────────────────────────────────────────────────────
const results = {
  privadoStudioGarden:  dedup(privadoStudioGardenRaw),
  b7StudioRent:         dedup(b7StudioRentRaw),
  privadoAptBuyers:     dedup(privadoAptBuyersRaw),
  dreamlandRent:        dedup(dreamlandRentRaw),
  madinatyVillaToday:   dedup(madinatyVillaTodayRaw),
};

console.log('Results:', {
  'Privado Studio+Garden': results.privadoStudioGarden.length,
  'B7 Studio Rent':        results.b7StudioRent.length,
  'Privado Apt Buyers':    results.privadoAptBuyers.length,
  'Dreamland Rent':        results.dreamlandRent.length,
  'Madinaty Villa Today':  results.madinatyVillaToday.length,
});

fs.writeFileSync('/tmp/demand_5sheets.json', JSON.stringify(results, null, 2));
console.log('SAVED');
await conn.end();
