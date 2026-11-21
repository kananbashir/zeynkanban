-- Make sure every table stores text as full Unicode (Azerbaijani letters, emoji), whatever the server default is.
ALTER DATABASE CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE `content_types` (
	`id` varchar(36) NOT NULL,
	`code` varchar(10) NOT NULL,
	`name` varchar(120) NOT NULL,
	`archived` boolean NOT NULL DEFAULT false,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `content_types_id` PRIMARY KEY(`id`),
	CONSTRAINT `content_types_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `login_attempts` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`ip` varchar(64) NOT NULL,
	`success` boolean NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `login_attempts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` varchar(36) NOT NULL,
	`token_hash` varchar(64) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`expires_at` datetime(3) NOT NULL,
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `sessions_token_hash_unique` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `special_days` (
	`id` varchar(36) NOT NULL,
	`date` date NOT NULL,
	`name` varchar(120) NOT NULL,
	`kind` enum('holiday','event') NOT NULL DEFAULT 'holiday',
	`yearly` boolean NOT NULL DEFAULT false,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `special_days_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `statuses` (
	`id` varchar(36) NOT NULL,
	`name` varchar(120) NOT NULL,
	`color` varchar(7) NOT NULL,
	`is_finished` boolean NOT NULL DEFAULT false,
	`position` int NOT NULL DEFAULT 0,
	`deleted_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `statuses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `task_types` (
	`id` varchar(36) NOT NULL,
	`name` varchar(120) NOT NULL,
	`position` int NOT NULL DEFAULT 0,
	`is_publishing` boolean NOT NULL DEFAULT false,
	`deleted_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `task_types_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` varchar(36) NOT NULL,
	`name` varchar(120) NOT NULL,
	`role` enum('admin','manager','employee') NOT NULL DEFAULT 'employee',
	`code_hash` varchar(64) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_code_hash_unique` UNIQUE(`code_hash`)
);
--> statement-breakpoint
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `login_attempts_ip_idx` ON `login_attempts` (`ip`,`created_at`);--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);