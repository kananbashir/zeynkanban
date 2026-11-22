CREATE TABLE `personal_reminders` (
	`personal_task_id` varchar(36) NOT NULL,
	`minutes_before` int NOT NULL,
	`sent_at` datetime(3),
	CONSTRAINT `personal_reminders_personal_task_id_minutes_before_pk` PRIMARY KEY(`personal_task_id`,`minutes_before`)
);
--> statement-breakpoint
CREATE TABLE `task_notes` (
	`id` varchar(36) NOT NULL,
	`task_id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`body` varchar(500) NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `task_notes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `notifications` MODIFY COLUMN `kind` enum('assigned','moved','changed','review','overdue','summary','status','reminder','note','personal') NOT NULL;--> statement-breakpoint
ALTER TABLE `notification_prefs` ADD `notes` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `personal_tasks` ADD `time` varchar(5);--> statement-breakpoint
ALTER TABLE `personal_reminders` ADD CONSTRAINT `personal_reminders_personal_task_id_personal_tasks_id_fk` FOREIGN KEY (`personal_task_id`) REFERENCES `personal_tasks`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `task_notes` ADD CONSTRAINT `task_notes_task_id_tasks_id_fk` FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `task_notes` ADD CONSTRAINT `task_notes_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `task_notes_task_idx` ON `task_notes` (`task_id`,`created_at`);