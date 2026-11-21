-- Starting values so a fresh installation works at once. All of them can be renamed,
-- reordered or removed in Settings.
INSERT INTO "statuses" ("name", "color", "is_finished", "position") VALUES
  ('To do', '#b04fb8', false, 0),
  ('In progress', '#2a7de1', false, 1),
  ('Ready for review', '#c47a00', false, 2),
  ('Done', '#0c9b8d', true, 3);
--> statement-breakpoint
INSERT INTO "task_types" ("name", "position", "is_publishing") VALUES
  ('Video shoot', 0, false),
  ('Video edit', 1, false),
  ('Graphic design', 2, false),
  ('Caption writing', 3, false),
  ('Post publishing', 4, true);
--> statement-breakpoint
INSERT INTO "content_types" ("code", "name") VALUES
  ('vid', 'Video'),
  ('gpost', 'Graphic post');
