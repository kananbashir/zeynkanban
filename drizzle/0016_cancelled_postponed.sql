ALTER TABLE `statuses` ADD `is_cancelled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `statuses` ADD `is_postponed` boolean DEFAULT false NOT NULL;