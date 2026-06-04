CREATE TABLE `ai_tts_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`status` text NOT NULL,
	`provider` text NOT NULL,
	`model` text,
	`instruction` text,
	`speakers_json` text NOT NULL,
	`lines_json` text NOT NULL,
	`upload_to_r2` integer NOT NULL,
	`result_json` text,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`last_error_message` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`completed_at` integer
);
--> statement-breakpoint
CREATE INDEX `ai_tts_tasks_user_id_created_at_idx` ON `ai_tts_tasks` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `ai_tts_tasks_user_id_status_idx` ON `ai_tts_tasks` (`user_id`,`status`);