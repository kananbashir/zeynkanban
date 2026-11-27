CREATE TABLE `bank_approvers` (
	`bank_brief_id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`approved_at` datetime(3),
	`edited` boolean NOT NULL DEFAULT false,
	CONSTRAINT `bank_approvers_bank_brief_id_user_id_pk` PRIMARY KEY(`bank_brief_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `bank_notes` (
	`id` varchar(36) NOT NULL,
	`bank_brief_id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`body` varchar(1000) NOT NULL,
	`edited` boolean NOT NULL DEFAULT false,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `bank_notes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `notifications` MODIFY COLUMN `kind` enum('assigned','moved','changed','review','overdue','summary','status','reminder','note','personal','deadline','brief','finished','contentNote','nudge','bank') NOT NULL;--> statement-breakpoint
ALTER TABLE `bank_briefs` ADD `approved_at` datetime(3);--> statement-breakpoint
ALTER TABLE `bank_briefs` ADD `approved_by` varchar(36);--> statement-breakpoint
ALTER TABLE `bank_approvers` ADD CONSTRAINT `bank_approvers_bank_brief_id_bank_briefs_id_fk` FOREIGN KEY (`bank_brief_id`) REFERENCES `bank_briefs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bank_approvers` ADD CONSTRAINT `bank_approvers_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bank_notes` ADD CONSTRAINT `bank_notes_bank_brief_id_bank_briefs_id_fk` FOREIGN KEY (`bank_brief_id`) REFERENCES `bank_briefs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bank_notes` ADD CONSTRAINT `bank_notes_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `bank_approvers_user_idx` ON `bank_approvers` (`user_id`);--> statement-breakpoint
CREATE INDEX `bank_notes_brief_idx` ON `bank_notes` (`bank_brief_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `bank_briefs` ADD CONSTRAINT `bank_briefs_approved_by_users_id_fk` FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;