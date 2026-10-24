CREATE TABLE `credentials` (
	`user_id` text PRIMARY KEY NOT NULL,
	`encrypted_garmin_key` text NOT NULL,
	`last_pull` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`state` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL
);
