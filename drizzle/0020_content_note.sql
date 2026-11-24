ALTER TABLE `notifications` MODIFY COLUMN `kind` enum('assigned','moved','changed','review','overdue','summary','status','reminder','note','personal','deadline','brief','finished','contentNote') NOT NULL;--> statement-breakpoint
ALTER TABLE `contents` ADD `note` text;--> statement-breakpoint
ALTER TABLE `contents` ADD `note_by` varchar(36);--> statement-breakpoint
ALTER TABLE `contents` ADD `note_at` datetime(3);--> statement-breakpoint
ALTER TABLE `contents` ADD CONSTRAINT `contents_note_by_users_id_fk` FOREIGN KEY (`note_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;