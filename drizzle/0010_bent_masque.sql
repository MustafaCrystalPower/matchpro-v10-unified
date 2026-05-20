-- Custom SQL migration file, put your code below! --

-- Add auto-ingestion pipeline fields to supply table
ALTER TABLE `supply`
  ADD COLUMN `priority` ENUM('high','medium','low') DEFAULT 'medium',
  ADD COLUMN `reviewStatus` ENUM('auto_approved','pending_review','approved','rejected') DEFAULT 'auto_approved',
  ADD COLUMN `reviewedAt` TIMESTAMP NULL,
  ADD COLUMN `reviewedBy` VARCHAR(256) NULL,
  ADD COLUMN `sourceGroup` VARCHAR(256) NULL,
  ADD COLUMN `nlpVersion` VARCHAR(32) DEFAULT 'v2',
  ADD COLUMN `rawMessageText` TEXT NULL;

-- Add auto-ingestion pipeline fields to demand table
ALTER TABLE `demand`
  ADD COLUMN `priority` ENUM('high','medium','low') DEFAULT 'medium',
  ADD COLUMN `reviewStatus` ENUM('auto_approved','pending_review','approved','rejected') DEFAULT 'auto_approved',
  ADD COLUMN `reviewedAt` TIMESTAMP NULL,
  ADD COLUMN `reviewedBy` VARCHAR(256) NULL,
  ADD COLUMN `sourceGroup` VARCHAR(256) NULL,
  ADD COLUMN `nlpVersion` VARCHAR(32) DEFAULT 'v2',
  ADD COLUMN `rawMessageText` TEXT NULL;