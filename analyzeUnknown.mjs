import mysql from 'mysql2/promise';

async function analyzeUnknownMessages() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL || '');
  
  try {
    // Get sample of unknown messages
    const [unknownMessages] = await connection.execute(`
      SELECT 
        id,
        messageText,
        createdAt,
        groupName
      FROM messages
      WHERE classification = 'unknown'
      LIMIT 20
    `);
    
    console.log('\n📋 عينة من الرسائل غير المصنفة (20 رسالة):\n');
    
    for (let i = 0; i < unknownMessages.length; i++) {
      const msg = unknownMessages[i];
      console.log(`${i + 1}. "${msg.messageText.substring(0, 80)}..."`);
      console.log(`   📍 المجموعة: ${msg.groupName}`);
      console.log(`   ⏰ الوقت: ${msg.createdAt}\n`);
    }
    
    // Count unknown messages
    const [countResult] = await connection.execute(`
      SELECT COUNT(*) as total FROM messages WHERE classification = 'unknown'
    `);
    
    console.log(`\n📊 إجمالي الرسائل غير المصنفة: ${countResult[0].total}`);
    
  } finally {
    await connection.end();
  }
}

analyzeUnknownMessages();
