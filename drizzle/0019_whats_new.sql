ALTER TABLE `users` ADD `seen_version` varchar(20);--> statement-breakpoint
UPDATE `users` SET `seen_version` = '0.13.1';