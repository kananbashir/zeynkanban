-- Starting values so a fresh installation works at once. All of them can be renamed,
-- reordered or removed in Settings.
INSERT INTO `statuses` (`id`, `name`, `color`, `is_finished`, `position`) VALUES
  (UUID(), 'To do', '#b04fb8', false, 0),
  (UUID(), 'In progress', '#2a7de1', false, 1),
  (UUID(), 'Ready for review', '#c47a00', false, 2),
  (UUID(), 'Done', '#0c9b8d', true, 3);
--> statement-breakpoint
INSERT INTO `task_types` (`id`, `name`, `position`, `is_publishing`) VALUES
  (UUID(), 'Video shoot', 0, false),
  (UUID(), 'Video edit', 1, false),
  (UUID(), 'Graphic design', 2, false),
  (UUID(), 'Caption writing', 3, false),
  (UUID(), 'Post publishing', 4, true);
--> statement-breakpoint
INSERT INTO `content_types` (`id`, `code`, `name`) VALUES
  (UUID(), 'vid', 'Video'),
  (UUID(), 'gpost', 'Graphic post');
