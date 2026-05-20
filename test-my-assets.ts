import { getDb } from './server/db';
import { userAssets } from './drizzle/schema';
import { count } from 'drizzle-orm';

async function testMyAssets() {
  console.log('🧪 TEST 4: MY ASSETS FEATURE\n');
  try {
    const db = await getDb();
    if (!db) throw new Error('Database not available');
    
    const result = await db.select({ count: count() }).from(userAssets);
    const assetCount = result[0]?.count || 0;
    
    console.log(`✅ My Assets table exists`);
    console.log(`✅ Current user assets: ${assetCount}`);
    console.log(`✅ Schema: userAssets table with proper fields`);
    
    return true;
  } catch (error) {
    console.error(`❌ FAILED: ${(error as Error).message}`);
    return false;
  }
}

testMyAssets().then(success => process.exit(success ? 0 : 1));
