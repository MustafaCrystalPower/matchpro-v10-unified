import { createConnection } from 'mysql2/promise';

async function checkClassification() {
  const connection = await createConnection(process.env.DATABASE_URL || '');
  
  try {
    // Get sample messages from last 24 hours
    const [messages] = await connection.execute(`
      SELECT 
        id,
        messageText,
        classification,
        createdAt
      FROM messages
      WHERE createdAt >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      LIMIT 20
    `) as any;
    
    console.log('\n📊 عينة من الرسائل والتصنيف:\n');
    
    for (const msg of messages) {
      console.log(`[${msg.classification.toUpperCase()}] ${msg.messageText.substring(0, 80)}`);
    }
    
    // Count by classification
    const [counts] = await connection.execute(`
      SELECT 
        classification,
        COUNT(*) as count
      FROM messages
      WHERE createdAt >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      GROUP BY classification
    `) as any;
    
    console.log('\n📈 الإجمالي:\n');
    for (const row of counts) {
      console.log(`${row.classification}: ${row.count}`);
    }
    
  } finally {
    await connection.end();
  }
}

checkClassification();
