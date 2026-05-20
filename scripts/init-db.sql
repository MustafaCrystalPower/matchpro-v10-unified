-- MatchPro Unified — Additional schema for local auth
-- This runs on top of the Drizzle-managed schema

CREATE TABLE IF NOT EXISTS userPasswords (
  id INT AUTO_INCREMENT PRIMARY KEY,
  openId VARCHAR(64) NOT NULL UNIQUE,
  passwordHash VARCHAR(256) NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_openId (openId)
);

-- Market configuration (multi-market support from V3)
CREATE TABLE IF NOT EXISTS marketConfig (
  id INT AUTO_INCREMENT PRIMARY KEY,
  marketKey VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(128) NOT NULL,
  icon VARCHAR(16),
  supplyLabel VARCHAR(128),
  demandLabel VARCHAR(128),
  currency VARCHAR(16) DEFAULT 'EGP',
  fields JSON,
  isActive TINYINT DEFAULT 0,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed default market configs
INSERT IGNORE INTO marketConfig (marketKey, name, icon, supplyLabel, demandLabel, currency, fields, isActive) VALUES
('real_estate', 'Real Estate', '🏠', 'Property Listing', 'Buyer/Renter Request', 'EGP', '["location","price","propertyType","bedrooms","purpose"]', 1),
('jobs', 'Job Market', '💼', 'Job Opening', 'Job Seeker', 'USD', '["role","salary","location","experience","type"]', 0),
('logistics', 'Logistics', '🚛', 'Available Truck/Route', 'Shipping Request', 'USD', '["route","weight","date","type","price"]', 0),
('wholesale', 'Wholesale Trade', '📦', 'Product Available', 'Buyer Need', 'USD', '["product","quantity","price","location","quality"]', 0),
('medical_equipment', 'Medical Equipment', '🏥', 'Equipment Available', 'Hospital Need', 'USD', '["equipment","condition","quantity","price","location"]', 0);
