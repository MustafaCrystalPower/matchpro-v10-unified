CREATE TABLE `amenities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`supplyId` int,
	`demandId` int,
	`hasPool` int DEFAULT 0,
	`hasBalcony` int DEFAULT 0,
	`hasGarden` int DEFAULT 0,
	`hasParking` int DEFAULT 0,
	`hasElevator` int DEFAULT 0,
	`hasSecurity` int DEFAULT 0,
	`hasGym` int DEFAULT 0,
	`hasFurnished` int DEFAULT 0,
	`hasAC` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `amenities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bookmarks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`supplyId` int,
	`demandId` int,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bookmarks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `matchFeedback` (
	`id` int AUTO_INCREMENT NOT NULL,
	`matchId` int NOT NULL,
	`userId` int,
	`rating` int NOT NULL,
	`comment` text,
	`helpful` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `matchFeedback_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `amenities` ADD CONSTRAINT `amenities_supplyId_supply_id_fk` FOREIGN KEY (`supplyId`) REFERENCES `supply`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `amenities` ADD CONSTRAINT `amenities_demandId_demand_id_fk` FOREIGN KEY (`demandId`) REFERENCES `demand`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bookmarks` ADD CONSTRAINT `bookmarks_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bookmarks` ADD CONSTRAINT `bookmarks_supplyId_supply_id_fk` FOREIGN KEY (`supplyId`) REFERENCES `supply`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bookmarks` ADD CONSTRAINT `bookmarks_demandId_demand_id_fk` FOREIGN KEY (`demandId`) REFERENCES `demand`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `matchFeedback` ADD CONSTRAINT `matchFeedback_matchId_matches_id_fk` FOREIGN KEY (`matchId`) REFERENCES `matches`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `matchFeedback` ADD CONSTRAINT `matchFeedback_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;