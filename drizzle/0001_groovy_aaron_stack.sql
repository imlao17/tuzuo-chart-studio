CREATE TABLE `auth_rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`window_start` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `auth_rate_limits_window_start_idx` ON `auth_rate_limits` (`window_start`);--> statement-breakpoint
CREATE INDEX `auth_rate_limits_updated_at_idx` ON `auth_rate_limits` (`updated_at`);