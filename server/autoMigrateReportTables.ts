import { getDb } from './db';

export async function autoMigrateReportTables() {
  const db = await getDb();
  if (!db) {
    console.warn('⚠️ Database connection not available for auto-migration');
    return false;
  }

  try {
    console.log('🔄 Checking for report tables...');

    // Check if reportHistory table exists
    const checkReportHistory = await (db as any).$client
      .promise()
      .execute(
        `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reportHistory'`
      );

    if ((checkReportHistory as any[])[0].length === 0) {
      console.log('📝 Creating reportHistory table...');
      await (db as any).$client.promise().execute(`
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
      console.log('✅ reportHistory table created');
    } else {
      console.log('✅ reportHistory table already exists');
    }

    // Check if reportNotifications table exists
    const checkNotifications = await (db as any).$client
      .promise()
      .execute(
        `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reportNotifications'`
      );

    if ((checkNotifications as any[])[0].length === 0) {
      console.log('📝 Creating reportNotifications table...');
      await (db as any).$client.promise().execute(`
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
      console.log('✅ reportNotifications table created');
    } else {
      console.log('✅ reportNotifications table already exists');
    }

    console.log('✅ Report tables migration completed successfully');
    return true;
  } catch (error: any) {
    console.error('❌ Auto-migration failed:', error.message);
    return false;
  }
}

// Run migration on module load
autoMigrateReportTables().catch(console.error);
