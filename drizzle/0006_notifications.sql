CREATE TABLE `app_values` (
	`key` varchar(80) NOT NULL,
	`value` text NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `app_values_key` PRIMARY KEY(`key`)
);
--> statement-breakpoint
CREATE TABLE `notification_prefs` (
	`user_id` varchar(36) NOT NULL,
	`assigned` boolean NOT NULL DEFAULT true,
	`changed` boolean NOT NULL DEFAULT true,
	`summary` boolean NOT NULL DEFAULT true,
	`review` boolean NOT NULL DEFAULT true,
	`overdue` boolean NOT NULL DEFAULT true,
	CONSTRAINT `notification_prefs_user_id` PRIMARY KEY(`user_id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`kind` enum('assigned','moved','changed','review','overdue','summary') NOT NULL,
	`task_id` varchar(36),
	`data` text NOT NULL,
	`read_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`endpoint_hash` varchar(64) NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh` varchar(255) NOT NULL,
	`auth` varchar(255) NOT NULL,
	`locale` varchar(5) NOT NULL DEFAULT 'az',
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `push_subscriptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `push_endpoint_idx` UNIQUE(`endpoint_hash`)
);
--> statement-breakpoint
ALTER TABLE `statuses` ADD `notify_review` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `notification_prefs` ADD CONSTRAINT `notification_prefs_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `push_subscriptions` ADD CONSTRAINT `push_subscriptions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `notifications_user_idx` ON `notifications` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `push_user_idx` ON `push_subscriptions` (`user_id`);--> statement-breakpoint
UPDATE `statuses` SET `notify_review` = true WHERE `name` = 'Ready for review' AND `deleted_at` IS NULL;
