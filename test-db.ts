import { getDb } from './server/db';
import { matches } from './drizzle/schema';
import { count, gte, lte, and, desc } from 'drizzle-orm';

async function testDB() {
  try {
    const db = await getDb();
    if (!db) {
      console.error('❌ Database not available');
      return;
    }
    
    const totalResult = await db.select({ count: count() }).from(matches);
    const total = totalResult[0]?.count || 0;
    console.log(`Total matches: ${total}`);
    
    const now = new Date();
    const windowStart = new Date(now.getTime() - 13 * 60 * 60 * 1000);
    
    const recentResult = await db.select({ count: count() }).from(matches)
      .where(and(
        gte(matches.createdAt, windowStart),
        lte(matches.createdAt, now)
      ));
    const recent = recentResult[0]?.count || 0;
    console.log(`Matches in last 13 hours: ${recent}`);
    
  } catch (error) {
    console.error('Error:', (error as Error).message);
  }
}

testDB();
