import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './drizzle/schema.ts';
import { desc } from 'drizzle-orm';
import dotenv from 'dotenv';
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(conn, { schema, mode: 'default' });

const rows = await db.select().from(schema.supply).orderBy(desc(schema.supply.createdAt)).limit(5);
console.log('SUPPLY COLUMNS:', JSON.stringify(Object.keys(rows[0])));
console.log('\n=== SAMPLE 1 ===');
console.log(JSON.stringify(rows[0], null, 2).substring(0, 1500));

const drows = await db.select().from(schema.demand).orderBy(desc(schema.demand.createdAt)).limit(3);
console.log('\n\nDEMAND COLUMNS:', JSON.stringify(Object.keys(drows[0])));
console.log('\n=== DEMAND SAMPLE 1 ===');
console.log(JSON.stringify(drows[0], null, 2).substring(0, 1500));

await conn.end();
