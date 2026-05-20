CREATE TABLE `demand` (
	`id` int AUTO_INCREMENT NOT NULL,
	`messageId` int,
	`propertyType` varchar(64),
	`location` varchar(256),
	`area` varchar(128),
	`city` varchar(128) DEFAULT 'Cairo',
	`priceMin` decimal(15,2),
	`priceMax` decimal(15,2),
	`sizeMin` int,
	`sizeMax` int,
	`bedrooms` int,
	`bathrooms` int,
	`purpose` enum('sale','rent'),
	`contact` varchar(64),
	`contactName` varchar(256),
	`requirements` json,
	`confidence` decimal(5,2),
	`matched` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `demand_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `matches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`supplyId` int,
	`demandId` int,
	`matchScore` decimal(5,2) NOT NULL,
	`locationScore` decimal(5,2),
	`priceScore` decimal(5,2),
	`specsScore` decimal(5,2),
	`status` enum('new','viewed','contacted','closed') DEFAULT 'new',
	`notified` int DEFAULT 0,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `matches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`messageId` varchar(128),
	`chatId` varchar(128),
	`groupName` varchar(256),
	`sender` varchar(128),
	`senderName` varchar(256),
	`messageText` text,
	`classification` enum('supply','demand','unknown'),
	`language` enum('ar','en','mixed'),
	`hasImage` int DEFAULT 0,
	`imageUrl` text,
	`processed` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `messages_id` PRIMARY KEY(`id`),
	CONSTRAINT `messages_messageId_unique` UNIQUE(`messageId`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type` enum('high_match','new_supply','new_demand','system') NOT NULL,
	`title` varchar(256) NOT NULL,
	`content` text,
	`matchId` int,
	`isRead` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `supply` (
	`id` int AUTO_INCREMENT NOT NULL,
	`messageId` int,
	`propertyType` varchar(64),
	`location` varchar(256),
	`area` varchar(128),
	`city` varchar(128) DEFAULT 'Cairo',
	`price` decimal(15,2),
	`priceUnit` enum('total','per_sqm','per_month') DEFAULT 'total',
	`size` int,
	`bedrooms` int,
	`bathrooms` int,
	`floor` int,
	`purpose` enum('sale','rent'),
	`contact` varchar(64),
	`contactName` varchar(256),
	`features` json,
	`confidence` decimal(5,2),
	`matched` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `supply_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `whatsappGroups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`chatId` varchar(128),
	`groupName` varchar(256),
	`messageCount` int DEFAULT 0,
	`supplyCount` int DEFAULT 0,
	`demandCount` int DEFAULT 0,
	`isActive` int DEFAULT 1,
	`lastMessageAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `whatsappGroups_id` PRIMARY KEY(`id`),
	CONSTRAINT `whatsappGroups_chatId_unique` UNIQUE(`chatId`)
);
--> statement-breakpoint
ALTER TABLE `demand` ADD CONSTRAINT `demand_messageId_messages_id_fk` FOREIGN KEY (`messageId`) REFERENCES `messages`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `matches` ADD CONSTRAINT `matches_supplyId_supply_id_fk` FOREIGN KEY (`supplyId`) REFERENCES `supply`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `matches` ADD CONSTRAINT `matches_demandId_demand_id_fk` FOREIGN KEY (`demandId`) REFERENCES `demand`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_matchId_matches_id_fk` FOREIGN KEY (`matchId`) REFERENCES `matches`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `supply` ADD CONSTRAINT `supply_messageId_messages_id_fk` FOREIGN KEY (`messageId`) REFERENCES `messages`(`id`) ON DELETE no action ON UPDATE no action;