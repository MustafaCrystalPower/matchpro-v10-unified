CREATE TABLE `brokerAnalytics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`brokerPhone` varchar(20) NOT NULL,
	`brokerName` varchar(256),
	`groupChatId` varchar(128),
	`totalMessages` int DEFAULT 0,
	`supplyCount` int DEFAULT 0,
	`demandCount` int DEFAULT 0,
	`successfulMatches` int DEFAULT 0,
	`lastActive` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `brokerAnalytics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `brokerPreferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`brokerAnalyticsId` int,
	`propertyType` varchar(64),
	`location` varchar(256),
	`priceRange` varchar(64),
	`frequency` int DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `brokerPreferences_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `geoMarketData` (
	`id` int AUTO_INCREMENT NOT NULL,
	`location` varchar(256) NOT NULL,
	`locationNormalized` varchar(256),
	`latitude` decimal(10,7),
	`longitude` decimal(10,7),
	`totalSupply` int DEFAULT 0,
	`totalDemand` int DEFAULT 0,
	`avgSupplyPrice` decimal(15,2),
	`avgDemandBudget` decimal(15,2),
	`marketTemperature` enum('hot','warm','cool','cold') DEFAULT 'cool',
	`investmentScore` int DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `geoMarketData_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `demand` ADD `contactVerified` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `demand` ADD `verifiedAt` timestamp;--> statement-breakpoint
ALTER TABLE `matches` ADD `qualificationStatus` enum('pending','qualified','rejected') DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `matches` ADD `contactsVerified` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `supply` ADD `contactVerified` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `supply` ADD `verifiedAt` timestamp;--> statement-breakpoint
ALTER TABLE `brokerPreferences` ADD CONSTRAINT `brokerPreferences_brokerAnalyticsId_brokerAnalytics_id_fk` FOREIGN KEY (`brokerAnalyticsId`) REFERENCES `brokerAnalytics`(`id`) ON DELETE no action ON UPDATE no action;