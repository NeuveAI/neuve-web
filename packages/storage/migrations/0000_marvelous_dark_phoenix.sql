CREATE TABLE `briefings` (
	`briefing_id` text PRIMARY KEY NOT NULL,
	`capture_id` text NOT NULL,
	`unit_id` text NOT NULL,
	`revision` text NOT NULL,
	`briefing` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`capture_id`) REFERENCES `query_captures`(`capture_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `briefing_unit_revision_idx` ON `briefings` (`unit_id`,`revision`);--> statement-breakpoint
CREATE TABLE `query_captures` (
	`capture_id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`tool_call_id` text NOT NULL,
	`repository` text NOT NULL,
	`revision` text NOT NULL,
	`result` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `capture_revision_idx` ON `query_captures` (`repository`,`revision`);--> statement-breakpoint
CREATE INDEX `capture_session_idx` ON `query_captures` (`session_id`);--> statement-breakpoint
CREATE TABLE `review_checkpoints` (
	`key` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL
);
