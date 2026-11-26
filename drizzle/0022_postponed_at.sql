ALTER TABLE `tasks` ADD `postponed_at` datetime(3);--> statement-breakpoint
UPDATE `tasks` t JOIN `statuses` s ON s.`id` = t.`status_id` SET t.`postponed_at` = t.`updated_at` WHERE s.`is_postponed` = 1 AND t.`postponed_at` IS NULL;
