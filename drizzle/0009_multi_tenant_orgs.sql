-- Migration: Multi-tenant organizations + organizationId columns
-- Generated: Feb 23, 2026

-- 1. Create organizations table
CREATE TABLE `organizations` (
  `id` int AUTO_INCREMENT NOT NULL,
  `name` varchar(255) NOT NULL,
  `slug` varchar(100) NOT NULL,
  `plan` enum('free','starter','pro','enterprise') NOT NULL DEFAULT 'free',
  `ownerId` int,
  `settings` json,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `organizations_id` PRIMARY KEY(`id`),
  CONSTRAINT `organizations_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint

-- 2. Create whatsappMagicLinks table
CREATE TABLE `whatsappMagicLinks` (
  `id` int AUTO_INCREMENT NOT NULL,
  `token` varchar(255) NOT NULL,
  `phoneNumber` varchar(30) NOT NULL,
  `organizationId` int,
  `invitedByUserId` int,
  `expiresAt` timestamp NOT NULL,
  `usedAt` timestamp,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `whatsappMagicLinks_id` PRIMARY KEY(`id`),
  CONSTRAINT `whatsappMagicLinks_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint

-- 3. Add organizationId to users table
ALTER TABLE `users` ADD COLUMN `organizationId` int;
--> statement-breakpoint

-- 4. Add organizationId to supply table
ALTER TABLE `supply` ADD COLUMN `organizationId` int;
--> statement-breakpoint

-- 5. Add organizationId to demand table
ALTER TABLE `demand` ADD COLUMN `organizationId` int;
--> statement-breakpoint

-- 6. Add organizationId to matches table
ALTER TABLE `matches` ADD COLUMN `organizationId` int;
--> statement-breakpoint

-- 7. Add organizationId to messages table
ALTER TABLE `messages` ADD COLUMN `organizationId` int;
--> statement-breakpoint

-- 8. Add indexes for performance
CREATE INDEX `organizations_slug_idx` ON `organizations` (`slug`);
--> statement-breakpoint
CREATE INDEX `users_org_idx` ON `users` (`organizationId`);
--> statement-breakpoint
CREATE INDEX `supply_org_idx` ON `supply` (`organizationId`);
--> statement-breakpoint
CREATE INDEX `demand_org_idx` ON `demand` (`organizationId`);
--> statement-breakpoint
CREATE INDEX `matches_org_idx` ON `matches` (`organizationId`);
--> statement-breakpoint
CREATE INDEX `messages_org_idx` ON `messages` (`organizationId`);
