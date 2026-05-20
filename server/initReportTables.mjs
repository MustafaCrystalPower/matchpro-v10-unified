import mysql from 'mysql2/promise';

const connectionConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'matchpro',
};

async function initReportTables() {
  let connection;
  try {
    connection = await mysql.createConnection(connectionConfig);
    console.log('✅ Connected to database');

    // Create reportHistory table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS reportHistory (
        id INT AUTO_INCREMENT PRIMARY KEY,
        reportName VARCHAR(256) NOT NULL,
        filePath TEXT NOT NULL,
        fileSize INT,
        demandsCount INT DEFAULT 0,
        sheetsCount INT DEFAULT 21,
        generatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        sentAt TIMESTAMP NULL,
        deliveryStatus ENUM('pending', 'sent', 'delivered', 'failed', 'resent') DEFAULT 'pending',
        deliveryError TEXT,
        recipientEmail VARCHAR(256) NOT NULL,
        sentVia ENUM('email', 'whatsapp', 'both') DEFAULT 'email',
        whatsappStatus ENUM('pending', 'sent', 'delivered', 'read', 'failed'),
        whatsappMessageId VARCHAR(256),
        whatsappError TEXT,
        manuallyTriggered INT DEFAULT 0,
        triggeredBy VARCHAR(256),
        notes TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
        INDEX idx_deliveryStatus (deliveryStatus),
        INDEX idx_generatedAt (generatedAt),
        INDEX idx_recipientEmail (recipientEmail)
      )
    `);
    console.log('✅ reportHistory table created/verified');

    // Create reportNotifications table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS reportNotifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        reportId INT,
        notificationType ENUM('generation_started', 'generation_completed', 'delivery_success', 'delivery_failed', 'resend_requested') NOT NULL,
        channel ENUM('whatsapp', 'slack', 'email') NOT NULL,
        recipientPhone VARCHAR(20),
        recipientSlackId VARCHAR(256),
        messageContent TEXT,
        messageId VARCHAR(256),
        status ENUM('pending', 'sent', 'delivered', 'failed') DEFAULT 'pending',
        errorMessage TEXT,
        sentAt TIMESTAMP NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (reportId) REFERENCES reportHistory(id) ON DELETE CASCADE,
        INDEX idx_reportId (reportId),
        INDEX idx_channel (channel),
        INDEX idx_status (status),
        INDEX idx_createdAt (createdAt)
      )
    `);
    console.log('✅ reportNotifications table created/verified');

    console.log('\n✅ All report tables initialized successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

initReportTables();
