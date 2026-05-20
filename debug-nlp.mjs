import { db } from './server/db.ts';
import { supply, demand } from './drizzle/schema.ts';

// Check supply and demand counts
const supplyCount = await db.select().from(supply).limit(5);
const demandCount = await db.select().from(demand).limit(5);

console.log('=== SUPPLY SAMPLE ===');
supplyCount.forEach(s => console.log(`Classification: ${s.classification}, Location: ${s.location}, Price: ${s.price}`));

console.log('\n=== DEMAND SAMPLE ===');
demandCount.forEach(d => console.log(`Classification: ${d.classification}, Location: ${d.location}, Budget: ${d.priceMin}-${d.priceMax}`));
