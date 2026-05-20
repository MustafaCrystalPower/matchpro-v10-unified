CREATE TABLE `customNotifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`matchId` int,
	`title` varchar(256) NOT NULL,
	`message` text,
	`notificationType` enum('personalized_match','price_update','new_property','custom') NOT NULL,
	`channel` enum('in_app','whatsapp','email','all') DEFAULT 'in_app',
	`isRead` int DEFAULT 0,
	`sentViaWhatsapp` int DEFAULT 0,
	`sentViaEmail` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`readAt` timestamp,
	CONSTRAINT `customNotifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `userOnboarding` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`qrCode` text,
	`qrCodeUrl` text,
	`invitationToken` varchar(256),
	`invitationUrl` text,
	`referrerUserId` int,
	`signupSource` varchar(64),
	`isCompleted` int DEFAULT 0,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `userOnboarding_id` PRIMARY KEY(`id`),
	CONSTRAINT `userOnboarding_invitationToken_unique` UNIQUE(`invitationToken`)
);
--> statement-breakpoint
CREATE TABLE `userProfiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`phoneNumber` varchar(20),
	`whatsappNumber` varchar(20),
	`userType` enum('buyer','seller','investor','agent') NOT NULL,
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
	`requirements` json,
	`notifyOnMatch` int DEFAULT 1,
	`notifyViaWhatsapp` int DEFAULT 1,
	`notifyViaEmail` int DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `userProfiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `userProfiles_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
ALTER TABLE `customNotifications` ADD CONSTRAINT `customNotifications_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customNotifications` ADD CONSTRAINT `customNotifications_matchId_matches_id_fk` FOREIGN KEY (`matchId`) REFERENCES `matches`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `userOnboarding` ADD CONSTRAINT `userOnboarding_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `userOnboarding` ADD CONSTRAINT `userOnboarding_referrerUserId_users_id_fk` FOREIGN KEY (`referrerUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `userProfiles` ADD CONSTRAINT `userProfiles_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;