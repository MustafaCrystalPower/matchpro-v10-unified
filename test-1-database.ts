import { getDb } from './server/db';
import { matches, supply, demand } from './drizzle/schema';
import { count, gte, lte, and } from 'drizzle-orm';

async function test1() {
  console.log('🧪 TEST 1: DATABASE CONNECTIVITY\n');
  try {
    const db = await getDb();
    if (!db) throw new Error('Database not available');
    
    const totalMatches = await db.select({ count: count() }).from(matches);
    const totalSupply = await db.select({ count: count() }).from(supply);
    const totalDemand = await db.select({ count: count() }).from(demand);
    
    console.log(`✅ Database connected`);
    console.log(`✅ Total matches: ${totalMatches[0]?.count || 0}`);
    console.log(`✅ Total supply: ${totalSupply[0]?.count || 0}`);
    console.log(`✅ Total demand: ${totalDemand[0]?.count || 0}`);
    
    return true;
  } catch (error) {
    console.error(`❌ FAILED: ${(error as Error).message}`);
    return false;
  }
}

test1().then(success => process.exit(success ? 0 : 1));
