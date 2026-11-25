ALTER TABLE `notifications` MODIFY COLUMN `kind` enum('assigned','moved','changed','review','overdue','summary','status','reminder','note','personal','deadline','brief','finished','contentNote','nudge') NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `nudged_at` datetime(3);--> statement-breakpoint
ALTER TABLE `tasks` ADD `nudged_by` varchar(36);--> statement-breakpoint
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_nudged_by_users_id_fk` FOREIGN KEY (`nudged_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;