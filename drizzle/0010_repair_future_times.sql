-- One-off repair. Before every connection was set to UTC, rows the database stamped itself got the
-- MySQL server's local time, which the app read as UTC. On a server ahead of UTC (e.g. Baku, +04:00)
-- recent rows therefore looked like they were in the future: notifications showed "now" and stayed
-- at the top, and failed logins kept counting. Rows stamped in the future are moved back by the
-- server's offset. On a server running on UTC, or with nothing in the future, this changes nothing.
UPDATE `notifications`
SET `created_at` = DATE_SUB(`created_at`, INTERVAL GREATEST(0, COALESCE(TIMESTAMPDIFF(MINUTE, UTC_TIMESTAMP(), CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', @@global.time_zone)), 0)) MINUTE)
WHERE `created_at` > UTC_TIMESTAMP() + INTERVAL 1 MINUTE;
--> statement-breakpoint
UPDATE `login_attempts`
SET `created_at` = DATE_SUB(`created_at`, INTERVAL GREATEST(0, COALESCE(TIMESTAMPDIFF(MINUTE, UTC_TIMESTAMP(), CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', @@global.time_zone)), 0)) MINUTE)
WHERE `created_at` > UTC_TIMESTAMP() + INTERVAL 1 MINUTE;
