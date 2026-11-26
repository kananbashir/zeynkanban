CREATE TABLE `bank_access` (
	`user_id` varchar(36) NOT NULL,
	`customer_id` varchar(36) NOT NULL,
	CONSTRAINT `bank_access_user_id_customer_id_pk` PRIMARY KEY(`user_id`,`customer_id`)
);
--> statement-breakpoint
CREATE TABLE `bank_briefs` (
	`id` varchar(36) NOT NULL,
	`customer_id` varchar(36) NOT NULL,
	`title` varchar(120) NOT NULL,
	`fields` mediumtext NOT NULL,
	`created_by` varchar(36) NOT NULL,
	`updated_by` varchar(36),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `bank_briefs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('admin','manager','employee','designer') NOT NULL DEFAULT 'employee';--> statement-breakpoint
ALTER TABLE `content_briefs` ADD `bank_brief_id` varchar(36);--> statement-breakpoint
ALTER TABLE `content_briefs` ADD CONSTRAINT `content_briefs_bank_brief_id_unique` UNIQUE(`bank_brief_id`);--> statement-breakpoint
ALTER TABLE `bank_access` ADD CONSTRAINT `bank_access_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bank_access` ADD CONSTRAINT `bank_access_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bank_briefs` ADD CONSTRAINT `bank_briefs_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bank_briefs` ADD CONSTRAINT `bank_briefs_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bank_briefs` ADD CONSTRAINT `bank_briefs_updated_by_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `bank_briefs_customer_idx` ON `bank_briefs` (`customer_id`,`created_at`);--> statement-breakpoint
INSERT IGNORE INTO `bank_access` (`user_id`, `customer_id`) SELECT u.`id`, c.`id` FROM `users` u CROSS JOIN `customers` c WHERE u.`role` = 'employee' AND c.`archived` = 0;