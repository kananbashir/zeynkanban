CREATE TABLE `finished_works` (
	`content_id` varchar(36) NOT NULL,
	`links` text NOT NULL,
	`created_by` varchar(36),
	`updated_by` varchar(36),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `finished_works_content_id` PRIMARY KEY(`content_id`)
);
--> statement-breakpoint
ALTER TABLE `notifications` MODIFY COLUMN `kind` enum('assigned','moved','changed','review','overdue','summary','status','reminder','note','personal','deadline','brief','finished') NOT NULL;--> statement-breakpoint
ALTER TABLE `finished_works` ADD CONSTRAINT `finished_works_content_id_contents_id_fk` FOREIGN KEY (`content_id`) REFERENCES `contents`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `finished_works` ADD CONSTRAINT `finished_works_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `finished_works` ADD CONSTRAINT `finished_works_updated_by_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;