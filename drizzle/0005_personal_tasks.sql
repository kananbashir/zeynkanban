CREATE TABLE `personal_tasks` (
	`id` varchar(36) NOT NULL,
	`owner_id` varchar(36) NOT NULL,
	`title` varchar(200) NOT NULL,
	`note` varchar(500) NOT NULL DEFAULT '',
	`due_date` date NOT NULL,
	`done` boolean NOT NULL DEFAULT false,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `personal_tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `personal_tasks` ADD CONSTRAINT `personal_tasks_owner_id_users_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `personal_owner_idx` ON `personal_tasks` (`owner_id`,`due_date`);