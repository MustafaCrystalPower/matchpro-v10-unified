import { getDb } from './server/db';
import { matches } from './drizzle/schema';
import { count, gte, lte, and, desc } from 'drizzle-orm';

async function checkTimeline() {
  try {
    const db = await getDb();
    if (!db) {
      console.error('❌ Database not available');
      return;
    }
    
    console.log('📅 Checking match creation timeline...\n');
    
    // Get the date range of matches
    const allMatches = await db.select({ createdAt: matches.createdAt }).from(matches)
      .orderBy(desc(matches.createdAt))
      .limit(1);
    
    const oldestMatches = await db.select({ createdAt: matches.createdAt }).from(matches)
      .orderBy(matches.createdAt)
      .limit(1);
    
    if (allMatches.length > 0 && oldestMatches.length > 0) {
      const newest = new Date(allMatches[0].createdAt as any);
      const oldest = new Date(oldestMatches[0].createdAt as any);
      
      console.log(`Newest match: ${newest.toLocaleString()}`);
      console.log(`Oldest match: ${oldest.toLocaleString()}`);
      console.log(`Date range: ${Math.round((newest.getTime() - oldest.getTime()) / (1000 * 60 * 60 * 24))} days\n`);
    }
    
    // Check matches on 11/04/2026
    const apr11Start = new Date('2026-04-11T00:00:00Z');
    const apr11End = new Date('2026-04-11T23:59:59Z');
    
    const apr11Result = await db.select({ count: count() }).from(matches)
      .where(and(
        gte(matches.createdAt, apr11Start),
        lte(matches.createdAt, apr11End)
      ));
    const apr11Count = apr11Result[0]?.count || 0;
    console.log(`Matches created on 11/04/2026: ${apr11Count}`);
    
    // Check today
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
    const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
    
    const todayResult = await db.select({ count: count() }).from(matches)
      .where(and(
        gte(matches.createdAt, todayStart),
        lte(matches.createdAt, todayEnd)
      ));
    const todayCount = todayResult[0]?.count || 0;
    console.log(`Matches created today (${today.toLocaleDateString()}): ${todayCount}`);
    
  } catch (error) {
    console.error('Error:', (error as Error).message);
  }
}

checkTimeline();
