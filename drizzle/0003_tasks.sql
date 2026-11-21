CREATE TABLE `tasks` (
	`id` varchar(36) NOT NULL,
	`customer_id` varchar(36) NOT NULL,
	`content_id` varchar(36) NOT NULL,
	`task_type_id` varchar(36) NOT NULL,
	`status_id` varchar(36) NOT NULL,
	`assignee_id` varchar(36),
	`due_date` date NOT NULL,
	`description` text,
	`note` varchar(500) NOT NULL DEFAULT '',
	`archived` boolean NOT NULL DEFAULT false,
	`finished_at` datetime(3),
	`created_by` varchar(36),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_content_id_contents_id_fk` FOREIGN KEY (`content_id`) REFERENCES `contents`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_task_type_id_task_types_id_fk` FOREIGN KEY (`task_type_id`) REFERENCES `task_types`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_status_id_statuses_id_fk` FOREIGN KEY (`status_id`) REFERENCES `statuses`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_assignee_id_users_id_fk` FOREIGN KEY (`assignee_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `tasks_due_idx` ON `tasks` (`due_date`,`archived`);--> statement-breakpoint
CREATE INDEX `tasks_customer_idx` ON `tasks` (`customer_id`,`due_date`);--> statement-breakpoint
CREATE INDEX `tasks_content_idx` ON `tasks` (`content_id`);--> statement-breakpoint
CREATE INDEX `tasks_assignee_idx` ON `tasks` (`assignee_id`,`due_date`);