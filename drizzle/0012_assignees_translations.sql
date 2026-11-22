CREATE TABLE `task_assignees` (
	`task_id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`position` int NOT NULL DEFAULT 0,
	CONSTRAINT `task_assignees_task_id_user_id_pk` PRIMARY KEY(`task_id`,`user_id`)
);
--> statement-breakpoint
ALTER TABLE `tasks` DROP FOREIGN KEY `tasks_assignee_id_users_id_fk`;
--> statement-breakpoint
DROP INDEX `tasks_assignee_idx` ON `tasks`;--> statement-breakpoint
ALTER TABLE `special_days` ADD `name_en` varchar(120);--> statement-breakpoint
ALTER TABLE `statuses` ADD `name_en` varchar(120);--> statement-breakpoint
ALTER TABLE `task_types` ADD `name_en` varchar(120);--> statement-breakpoint
ALTER TABLE `task_assignees` ADD CONSTRAINT `task_assignees_task_id_tasks_id_fk` FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `task_assignees` ADD CONSTRAINT `task_assignees_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `task_assignees_user_idx` ON `task_assignees` (`user_id`);--> statement-breakpoint
-- Everyone who was assigned to a task keeps it, now in task_assignees.
INSERT INTO `task_assignees` (`task_id`, `user_id`, `position`) SELECT `id`, `assignee_id`, 0 FROM `tasks` WHERE `assignee_id` IS NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` DROP COLUMN `assignee_id`;--> statement-breakpoint
-- The starting statuses and task types were in English. Keep that as the English name and give them Azerbaijani names
-- (only rows still named exactly as they started; anything renamed is left alone).
UPDATE `statuses` SET `name_en` = `name`, `name` = CASE `name` WHEN 'To do' THEN 'Ediləcək' WHEN 'In progress' THEN 'İcrada' WHEN 'Ready for review' THEN 'Yoxlamaya hazır' WHEN 'Done' THEN 'Tamamlandı' END WHERE `name_en` IS NULL AND `name` IN ('To do', 'In progress', 'Ready for review', 'Done');--> statement-breakpoint
UPDATE `task_types` SET `name_en` = `name`, `name` = CASE `name` WHEN 'Video shoot' THEN 'Video çəkilişi' WHEN 'Video edit' THEN 'Video montajı' WHEN 'Graphic design' THEN 'Qrafik dizayn' WHEN 'Caption writing' THEN 'Mətnin yazılması' WHEN 'Post publishing' THEN 'Postun paylaşılması' END WHERE `name_en` IS NULL AND `name` IN ('Video shoot', 'Video edit', 'Graphic design', 'Caption writing', 'Post publishing');