CREATE TABLE `authorizedAdmins` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`name` varchar(256),
	`isActive` int DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `authorizedAdmins_id` PRIMARY KEY(`id`),
	CONSTRAINT `authorizedAdmins_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `investorSubscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`plan` enum('free','basic','premium','enterprise') DEFAULT 'free',
	`accessLevel` enum('none','limited','full') DEFAULT 'none',
	`locationsAccess` json,
	`expiresAt` timestamp,
	`isActive` int DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `investorSubscriptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `marketIntelligence` (
	`id` int AUTO_INCREMENT NOT NULL,
	`location` varchar(256) NOT NULL,
	`area` varchar(128),
	`city` varchar(128) DEFAULT 'Cairo',
	`supplyCount` int DEFAULT 0,
	`demandCount` int DEFAULT 0,
	`avgSupplyPrice` decimal(15,2),
	`avgDemandPriceMin` decimal(15,2),
	`avgDemandPriceMax` decimal(15,2),
	`supplyDemandRatio` decimal(5,2),
	`hotScore` int DEFAULT 0,
	`propertyTypes` json,
	`lastUpdated` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `marketIntelligence_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notificationPreferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`emailEnabled` int DEFAULT 1,
	`emailAddress` varchar(320),
	`whatsappEnabled` int DEFAULT 1,
	`whatsappNumber` varchar(20),
	`highMatchThreshold` int DEFAULT 85,
	`notifyNewSupply` int DEFAULT 0,
	`notifyNewDemand` int DEFAULT 0,
	`notifyHighMatch` int DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `notificationPreferences_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `investorSubscriptions` ADD CONSTRAINT `investorSubscriptions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notificationPreferences` ADD CONSTRAINT `notificationPreferences_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;