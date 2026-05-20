import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './drizzle/schema.ts';
import { like, or, and, gte, desc } from 'drizzle-orm';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(conn, { schema, mode: 'default' });

const supply = schema.supply;
const demand = schema.demand;

// ── Sheet 1: Villa Demand Today ──────────────────────────────────────────────
const villaDemandToday = await db.select().from(demand)
  .where(
    or(
      like(demand.propertyType, '%villa%'),
      like(demand.propertyType, '%فيلا%'),
      like(demand.propertyType, '%Villa%'),
      like(demand.rawMessageText, '%فيلا%'),
      like(demand.rawMessageText, '%villa%'),
      like(demand.rawMessageText, '%تاون هاوس%'),
      like(demand.rawMessageText, '%townhouse%'),
      like(demand.rawMessageText, '%twin house%'),
      like(demand.rawMessageText, '%تاون%'),
      like(demand.rawMessageText, '%Twin%'),
    )
  )
  .orderBy(desc(demand.createdAt))
  .limit(500);

console.log('VILLA_DEMAND_COUNT:', villaDemandToday.length);

// ── Sheet 2: Madinaty Villas (supply) ────────────────────────────────────────
const madinatyVillas = await db.select().from(supply)
  .where(
    and(
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
    )
  )
  .orderBy(desc(supply.createdAt))
  .limit(500);

console.log('MADINATY_VILLAS_COUNT:', madinatyVillas.length);

// ── Sheet 3: Privado Demand + Supply (redirectable) ───────────────────────────
const privadoDemand = await db.select().from(demand)
  .where(
    or(
      like(demand.rawMessageText, '%بريفادو%'),
      like(demand.rawMessageText, '%privado%'),
      like(demand.rawMessageText, '%Privado%'),
      like(demand.location, '%privado%'),
      like(demand.location, '%بريفادو%'),
      like(demand.rawMessageText, '%بريفا%'),
    )
  )
  .orderBy(desc(demand.createdAt))
  .limit(300);

const privadoSupply = await db.select().from(supply)
  .where(
    or(
      like(supply.rawMessageText, '%بريفادو%'),
      like(supply.rawMessageText, '%privado%'),
      like(supply.rawMessageText, '%Privado%'),
      like(supply.location, '%privado%'),
      like(supply.location, '%بريفادو%'),
      like(supply.rawMessageText, '%بريفا%'),
    )
  )
  .orderBy(desc(supply.createdAt))
  .limit(300);

console.log('PRIVADO_DEMAND_COUNT:', privadoDemand.length);
console.log('PRIVADO_SUPPLY_COUNT:', privadoSupply.length);

// ── Sheet 4: VIP High-Quality Properties ─────────────────────────────────────
const vipProperties = await db.select().from(supply)
  .where(
    or(
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
      like(supply.rawMessageText, '%بنتهاوس%'),
      like(supply.rawMessageText, '%بنت هاوس%'),
    )
  )
  .orderBy(desc(supply.price))
  .limit(500);

console.log('VIP_COUNT:', vipProperties.length);

fs.writeFileSync('/tmp/excel_data.json', JSON.stringify({
  villaDemandToday,
  madinatyVillas,
  privadoDemand,
  privadoSupply,
  vipProperties
}, null, 2));

console.log('DATA_SAVED');
await conn.end();
