ALTER TABLE `demand` MODIFY COLUMN `contact` varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE `demand` MODIFY COLUMN `contactName` varchar(256) NOT NULL;--> statement-breakpoint
ALTER TABLE `matches` MODIFY COLUMN `contactsVerified` int DEFAULT 1;--> statement-breakpoint
ALTER TABLE `supply` MODIFY COLUMN `contact` varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE `supply` MODIFY COLUMN `contactName` varchar(256) NOT NULL;--> statement-breakpoint
ALTER TABLE `matches` ADD `supplyContactPhone` varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE `matches` ADD `supplyContactName` varchar(256) NOT NULL;--> statement-breakpoint
ALTER TABLE `matches` ADD `demandContactPhone` varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE `matches` ADD `demandContactName` varchar(256) NOT NULL;