ALTER TABLE `matches` MODIFY COLUMN `status` enum('new','viewed','contacted','viewing_scheduled','negotiating','closed') DEFAULT 'new';--> statement-breakpoint
ALTER TABLE `matches` ADD `matchSummary` text;--> statement-breakpoint
ALTER TABLE `matches` ADD `matchExplanation` text;--> statement-breakpoint
ALTER TABLE `matches` ADD `viewingScheduledAt` timestamp;