CREATE TABLE `brief_fields` (
	`id` varchar(36) NOT NULL,
	`position` int NOT NULL DEFAULT 0,
	`label` varchar(60) NOT NULL,
	`label_en` varchar(60),
	`type` enum('short','long','links','checklist','date') NOT NULL,
	`hint` varchar(200) NOT NULL DEFAULT '',
	`hint_en` varchar(200),
	`visible` boolean NOT NULL DEFAULT true,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `brief_fields_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `content_briefs` (
	`content_id` varchar(36) NOT NULL,
	`fields` mediumtext NOT NULL,
	`created_by` varchar(36),
	`updated_by` varchar(36),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `content_briefs_content_id` PRIMARY KEY(`content_id`)
);
--> statement-breakpoint
ALTER TABLE `notifications` MODIFY COLUMN `kind` enum('assigned','moved','changed','review','overdue','summary','status','reminder','note','personal','deadline','brief') NOT NULL;--> statement-breakpoint
ALTER TABLE `content_briefs` ADD CONSTRAINT `content_briefs_content_id_contents_id_fk` FOREIGN KEY (`content_id`) REFERENCES `contents`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `content_briefs` ADD CONSTRAINT `content_briefs_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `content_briefs` ADD CONSTRAINT `content_briefs_updated_by_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- The five starting fields, in Azerbaijani with English names and hints.
INSERT INTO `brief_fields` (`id`, `position`, `label`, `label_en`, `type`, `hint`, `hint_en`, `visible`) VALUES
  (UUID(), 0, 'Məqsəd', 'Goal', 'long', 'Bu kontent nəyə nail olmalıdır?', 'What should this content achieve?', true),
  (UUID(), 1, 'Əsas mesaj', 'Key message', 'short', 'İnsanların yadında qalmalı olan bir fikir', 'The one thing people should remember', true),
  (UUID(), 2, 'Ssenari / mətn', 'Script / caption', 'long', 'Ssenarini və ya paylaşım mətnini yazın…', 'Write the script or caption…', true),
  (UUID(), 3, 'Materiallar', 'Materials', 'links', 'Link (Drive, Instagram, YouTube…)', 'Link (Drive, Instagram, YouTube…)', true),
  (UUID(), 4, 'Nümunələr', 'References', 'links', 'Bəyəndiyiniz nümunənin linki', 'Link to an example you like', true);
