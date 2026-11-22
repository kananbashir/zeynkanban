ALTER TABLE `notifications` MODIFY COLUMN `kind` enum('assigned','moved','changed','review','overdue','summary','status','reminder') NOT NULL;--> statement-breakpoint
ALTER TABLE `notification_prefs` ADD `status` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `notification_prefs` ADD `reminder` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `remind_days` int;--> statement-breakpoint
ALTER TABLE `tasks` ADD `remind_time` varchar(5);--> statement-breakpoint
ALTER TABLE `tasks` ADD `reminded_at` datetime(3);