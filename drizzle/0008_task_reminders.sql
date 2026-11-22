CREATE TABLE `task_reminders` (
	`task_id` varchar(36) NOT NULL,
	`days_before` int NOT NULL,
	`sent_at` datetime(3),
	CONSTRAINT `task_reminders_task_id_days_before_pk` PRIMARY KEY(`task_id`,`days_before`)
);
--> statement-breakpoint
ALTER TABLE `task_reminders` ADD CONSTRAINT `task_reminders_task_id_tasks_id_fk` FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
INSERT INTO `task_reminders` (`task_id`, `days_before`, `sent_at`) SELECT `id`, `remind_days`, `reminded_at` FROM `tasks` WHERE `remind_days` IS NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` DROP COLUMN `remind_days`;--> statement-breakpoint
ALTER TABLE `tasks` DROP COLUMN `reminded_at`;