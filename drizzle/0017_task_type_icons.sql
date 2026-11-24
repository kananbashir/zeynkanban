ALTER TABLE `task_types` ADD `icon` varchar(20) DEFAULT 'layers' NOT NULL;--> statement-breakpoint
-- Fitting icons for the starting task types (matched by their English names).
UPDATE `task_types` SET `icon` = CASE `name_en` WHEN 'Video shoot' THEN 'camera' WHEN 'Video edit' THEN 'scissors' WHEN 'Graphic design' THEN 'palette' WHEN 'Caption writing' THEN 'text' WHEN 'Post publishing' THEN 'send' ELSE `icon` END;
