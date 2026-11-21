CREATE TABLE `contents` (
	`id` varchar(36) NOT NULL,
	`code` varchar(60) NOT NULL,
	`customer_id` varchar(36) NOT NULL,
	`content_type_id` varchar(36) NOT NULL,
	`contract_id` varchar(36),
	`archived` boolean NOT NULL DEFAULT false,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `contents_id` PRIMARY KEY(`id`),
	CONSTRAINT `contents_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `contracts` (
	`id` varchar(36) NOT NULL,
	`customer_id` varchar(36) NOT NULL,
	`start_month` date NOT NULL,
	`end_month` date NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `contracts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` varchar(36) NOT NULL,
	`name` varchar(120) NOT NULL,
	`short_name` varchar(20) NOT NULL,
	`contact_person` varchar(120) NOT NULL DEFAULT '',
	`phone` varchar(40) NOT NULL DEFAULT '',
	`email` varchar(120) NOT NULL DEFAULT '',
	`social` varchar(200) NOT NULL DEFAULT '',
	`notes` text,
	`color` varchar(7) NOT NULL,
	`archived` boolean NOT NULL DEFAULT false,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `customers_id` PRIMARY KEY(`id`),
	CONSTRAINT `customers_short_name_unique` UNIQUE(`short_name`)
);
--> statement-breakpoint
ALTER TABLE `contents` ADD CONSTRAINT `contents_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `contents` ADD CONSTRAINT `contents_content_type_id_content_types_id_fk` FOREIGN KEY (`content_type_id`) REFERENCES `content_types`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `contents` ADD CONSTRAINT `contents_contract_id_contracts_id_fk` FOREIGN KEY (`contract_id`) REFERENCES `contracts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `contracts` ADD CONSTRAINT `contracts_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `contents_customer_idx` ON `contents` (`customer_id`,`archived`);--> statement-breakpoint
CREATE INDEX `contracts_customer_idx` ON `contracts` (`customer_id`,`start_month`);