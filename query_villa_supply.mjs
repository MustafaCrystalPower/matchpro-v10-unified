import mysql from 'mysql2/promise';
import fs from 'fs';

const dbUrl = new URL(process.env.DATABASE_URL.replace('mysql://','http://'));
const conn = await mysql.createConnection({
  host: dbUrl.hostname,
  port: parseInt(dbUrl.port) || 3306,
  user: dbUrl.username,
  password: dbUrl.password,
  database: dbUrl.pathname.slice(1),
  ssl: { rejectUnauthorized: false }
});

// First check what columns exist in supply table
const [cols] = await conn.execute(`DESCRIBE supply`);
console.log('Supply columns:', cols.map(c => c.Field).join(', '));

// Query all villa supply in Rehab and Madinaty
const [rows] = await conn.execute(`
  SELECT s.*, m.messageText as fullMessage, m.groupName, m.senderName, m.createdAt as msgTime
  FROM supply s
  LEFT JOIN messages m ON s.messageId = m.id
  WHERE (
    s.rawMessageText LIKE '%فيلا%' OR
    s.rawMessageText LIKE '%فلل%' OR
    s.rawMessageText LIKE '%villa%' OR
    s.rawMessageText LIKE '%فيلل%' OR
    s.propertyType LIKE '%villa%' OR
    s.propertyType LIKE '%فيلا%'
  )
  AND (
    s.rawMessageText LIKE '%مدينتي%' OR
    s.rawMessageText LIKE '%الرحاب%' OR
    s.rawMessageText LIKE '%رحاب%' OR
    s.location LIKE '%مدينتي%' OR
    s.location LIKE '%الرحاب%' OR
    s.area LIKE '%مدينتي%' OR
    s.area LIKE '%الرحاب%' OR
    s.city LIKE '%مدينتي%' OR
    s.city LIKE '%الرحاب%'
  )
  ORDER BY s.createdAt DESC
`);

console.log(`Found ${rows.length} villa supply records`);

// Also get 45M budget villas in Madinaty specifically
const [rows45] = await conn.execute(`
  SELECT s.*, m.messageText as fullMessage, m.groupName, m.senderName, m.createdAt as msgTime
  FROM supply s
  LEFT JOIN messages m ON s.messageId = m.id
  WHERE (
    s.rawMessageText LIKE '%فيلا%' OR
    s.rawMessageText LIKE '%فلل%' OR
    s.rawMessageText LIKE '%villa%' OR
    s.propertyType LIKE '%villa%'
  )
  AND (
    s.rawMessageText LIKE '%مدينتي%' OR
    s.location LIKE '%مدينتي%' OR
    s.area LIKE '%مدينتي%' OR
    s.city LIKE '%مدينتي%'
  )
  AND (
    s.price BETWEEN 35000000 AND 55000000 OR
    s.rawMessageText LIKE '%45 مليون%' OR
    s.rawMessageText LIKE '%٤٥ مليون%' OR
    s.rawMessageText LIKE '%45m%' OR
    s.rawMessageText LIKE '%45M%'
  )
  ORDER BY s.createdAt DESC
`);

console.log(`Found ${rows45.length} Madinaty villa ~45M records`);

fs.writeFileSync('/home/ubuntu/villa_supply.json', JSON.stringify(rows));
fs.writeFileSync('/home/ubuntu/villa_45m.json', JSON.stringify(rows45));
console.log('DONE');
await conn.end();
