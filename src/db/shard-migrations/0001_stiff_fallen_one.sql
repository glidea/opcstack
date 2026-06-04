CREATE TABLE `ai_image_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`status` text NOT NULL,
	`provider` text NOT NULL,
	`model` text,
	`prompt` text NOT NULL,
	`number_of_images` integer,
	`aspect_ratio` text,
	`image_size` text,
	`low_censorship` integer NOT NULL,
	`upload_to_r2` integer NOT NULL,
	`r2_upload_dir` text,
	`r2_upload_is_public` integer DEFAULT 0 NOT NULL,
	`references_json` text NOT NULL,
	`result_json` text,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`last_error_message` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`completed_at` integer
);
--> statement-breakpoint
CREATE INDEX `ai_image_tasks_user_id_created_at_idx` ON `ai_image_tasks` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `ai_image_tasks_user_id_status_idx` ON `ai_image_tasks` (`user_id`,`status`);
