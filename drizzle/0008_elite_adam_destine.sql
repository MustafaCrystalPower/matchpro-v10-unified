CREATE TABLE `auditLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`entityType` enum('supply','demand','match','user','notification') NOT NULL,
	`entityId` int NOT NULL,
	`action` enum('created','updated','deleted','qualified','contacted') NOT NULL,
	`createdBy` int,
	`createdByEmail` varchar(320),
	`changes` json,
	`reason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`indexEntityId` int,
	CONSTRAINT `auditLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `conversionFunnel` (
	`id` int AUTO_INCREMENT NOT NULL,
	`matchId` int NOT NULL,
	`supplyId` int,
	`demandId` int,
	`matchGeneratedAt` timestamp NOT NULL,
	`firstReplyAt` timestamp,
	`viewingScheduledAt` timestamp,
	`viewingCompletedAt` timestamp,
	`dealClosedAt` timestamp,
	`dealLostAt` timestamp,
	`currentStage` enum('generated','replied','viewing_scheduled','viewing_completed','deal_closed','deal_lost') DEFAULT 'generated',
	`daysToFirstReply` int,
	`daysToViewing` int,
	`daysToDeal` int,
	`notes` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `conversionFunnel_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `segmentedAnalytics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`area` varchar(128),
	`propertyType` varchar(64),
	`priceBand` varchar(64),
	`supplyCount` int DEFAULT 0,
	`demandCount` int DEFAULT 0,
	`matchCount` int DEFAULT 0,
	`avgSupplyPrice` decimal(15,2),
	`avgDemandBudget` decimal(15,2),
	`supplyDemandRatio` decimal(5,2),
	`matchesToReplies` int DEFAULT 0,
	`repliesToViewings` int DEFAULT 0,
	`viewingsToDeal` int DEFAULT 0,
	`insight` text,
	`insightArabic` text,
	`insightType` enum('opportunity','oversupply','balanced','emerging') DEFAULT 'balanced',
	`period` enum('today','7days','30days','90days') DEFAULT '30days',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `segmentedAnalytics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `systemHealth` (
	`id` int AUTO_INCREMENT NOT NULL,
	`whatsappStatus` enum('connected','disconnected','error') DEFAULT 'disconnected',
	`whatsappLastMessageAt` timestamp,
	`whatsappLastErrorAt` timestamp,
	`whatsappErrorMessage` text,
	`whatsappMessageCount` int DEFAULT 0,
	`databaseStatus` enum('ok','error') DEFAULT 'ok',
	`databaseLastCheckAt` timestamp,
	`databaseErrorMessage` text,
	`matchingEngineStatus` enum('ok','error') DEFAULT 'ok',
	`matchingEngineLastRunAt` timestamp,
	`matchingEngineLastErrorAt` timestamp,
	`matchingEngineErrorMessage` text,
	`matchesGeneratedToday` int DEFAULT 0,
	`emailStatus` enum('ok','error') DEFAULT 'ok',
	`emailLastSentAt` timestamp,
	`emailLastErrorAt` timestamp,
	`overallStatus` enum('healthy','degraded','critical') DEFAULT 'healthy',
	`lastUpdatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `systemHealth_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `auditLogs` ADD CONSTRAINT `auditLogs_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `conversionFunnel` ADD CONSTRAINT `conversionFunnel_matchId_matches_id_fk` FOREIGN KEY (`matchId`) REFERENCES `matches`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `conversionFunnel` ADD CONSTRAINT `conversionFunnel_supplyId_supply_id_fk` FOREIGN KEY (`supplyId`) REFERENCES `supply`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `conversionFunnel` ADD CONSTRAINT `conversionFunnel_demandId_demand_id_fk` FOREIGN KEY (`demandId`) REFERENCES `demand`(`id`) ON DELETE no action ON UPDATE no action;