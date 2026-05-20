import { getDb } from './server/db.ts';

const db = await getDb();

console.log('Checking message categorization in database...\n');

// Check messages table structure
const messages = await db.query.messages.findMany({
  limit: 5,
});

console.log('Sample messages:');
messages.forEach((msg, i) => {
  console.log(`\n${i + 1}. ${msg.sourceGroup || 'Unknown'}`);
  console.log(`   Category: ${msg.category || 'NOT SET'}`);
  console.log(`   Type: ${msg.type || 'NOT SET'}`);
  console.log(`   Content: ${msg.rawMessageText?.substring(0, 50) || 'N/A'}...`);
});

// Check categorization stats
const stats = await db.execute(`
  SELECT 
    category,
    COUNT(*) as count
  FROM messages
  GROUP BY category
`);

console.log('\n\nCategorization Statistics:');
console.log(stats);

process.exit(0);
