CREATE TABLE `magicLinks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`token` varchar(128) NOT NULL,
	`email` varchar(320),
	`phone` varchar(32),
	`name` varchar(256),
	`role` enum('admin','user') NOT NULL DEFAULT 'user',
	`createdBy` varchar(64) NOT NULL,
	`usedAt` timestamp,
	`usedByOpenId` varchar(64),
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `magicLinks_id` PRIMARY KEY(`id`),
	CONSTRAINT `magicLinks_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `whatsappOtp` (
	`id` int AUTO_INCREMENT NOT NULL,
	`phone` varchar(32) NOT NULL,
	`otp` varchar(8) NOT NULL,
	`openId` varchar(64),
	`used` int NOT NULL DEFAULT 0,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `whatsappOtp_id` PRIMARY KEY(`id`)
);
