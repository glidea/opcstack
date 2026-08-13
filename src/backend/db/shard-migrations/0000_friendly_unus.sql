CREATE TABLE `ai_image_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`status` text NOT NULL,
	`provider_type` text NOT NULL,
	`model` text,
	`provider_id` text,
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
CREATE INDEX `ai_image_tasks_user_id_status_idx` ON `ai_image_tasks` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `ai_image_tasks_status_updated_at_idx` ON `ai_image_tasks` (`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `ai_provider_metric_buckets` (
	`provider_id` text NOT NULL,
	`model` text NOT NULL,
	`bucket_start` integer NOT NULL,
	`success_count` integer DEFAULT 0 NOT NULL,
	`error_count` integer DEFAULT 0 NOT NULL,
	`success_latency_ms_total` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`provider_id`, `model`, `bucket_start`)
);
--> statement-breakpoint
CREATE INDEX `ai_provider_metric_buckets_bucket_start_idx` ON `ai_provider_metric_buckets` (`bucket_start`);--> statement-breakpoint
CREATE TABLE `ai_tts_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`status` text NOT NULL,
	`provider_type` text NOT NULL,
	`model` text,
	`provider_id` text,
	`source_json` text,
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
CREATE INDEX `ai_tts_tasks_user_id_status_idx` ON `ai_tts_tasks` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `ai_tts_tasks_status_updated_at_idx` ON `ai_tts_tasks` (`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `ai_video_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`status` text NOT NULL,
	`provider_type` text NOT NULL,
	`model` text,
	`provider_id` text,
	`prompt` text NOT NULL,
	`ratio` text,
	`resolution` text,
	`duration` integer NOT NULL,
	`r2_upload_dir` text,
	`r2_upload_is_public` integer DEFAULT 0 NOT NULL,
	`references_json` text NOT NULL,
	`provider_task_id` text,
	`provider_started_at` integer,
	`failed_provider_ids_json` text DEFAULT '[]' NOT NULL,
	`result_json` text,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`last_error_message` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`completed_at` integer
);
--> statement-breakpoint
CREATE INDEX `ai_video_tasks_user_id_created_at_idx` ON `ai_video_tasks` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `ai_video_tasks_user_id_status_idx` ON `ai_video_tasks` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `ai_video_tasks_status_updated_at_idx` ON `ai_video_tasks` (`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `credit_balances` (
	`user_id` text PRIMARY KEY NOT NULL,
	`balance` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `credit_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`amount` integer NOT NULL,
	`remaining_amount` integer NOT NULL,
	`source_type` text NOT NULL,
	`source_id` text NOT NULL,
	`expires_at` integer,
	`created_at` integer NOT NULL,
	CONSTRAINT "credit_entries_amount_gt_zero" CHECK("credit_entries"."amount" > 0),
	CONSTRAINT "credit_entries_remaining_amount_non_negative" CHECK("credit_entries"."remaining_amount" >= 0),
	CONSTRAINT "credit_entries_remaining_amount_lte_amount" CHECK("credit_entries"."remaining_amount" <= "credit_entries"."amount")
);
--> statement-breakpoint
CREATE INDEX `credit_entries_user_id_idx` ON `credit_entries` (`user_id`);--> statement-breakpoint
CREATE INDEX `credit_entries_remaining_amount_idx` ON `credit_entries` (`remaining_amount`);--> statement-breakpoint
CREATE INDEX `credit_entries_expires_at_idx` ON `credit_entries` (`expires_at`);--> statement-breakpoint
CREATE INDEX `credit_entries_created_at_idx` ON `credit_entries` (`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `credit_entries_source_type_source_id_unique` ON `credit_entries` (`source_type`,`source_id`);--> statement-breakpoint
CREATE TABLE `credit_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`amount` integer NOT NULL,
	`balance_after` integer NOT NULL,
	`source_type` text,
	`source_id` text,
	`description` text,
	`expires_at` integer,
	`created_at` integer NOT NULL,
	CONSTRAINT "credit_transactions_amount_not_zero" CHECK("credit_transactions"."amount" != 0)
);
--> statement-breakpoint
CREATE INDEX `credit_transactions_user_id_idx` ON `credit_transactions` (`user_id`);--> statement-breakpoint
CREATE INDEX `credit_transactions_type_idx` ON `credit_transactions` (`type`);--> statement-breakpoint
CREATE INDEX `credit_transactions_created_at_idx` ON `credit_transactions` (`created_at`);--> statement-breakpoint
CREATE INDEX `credit_transactions_user_id_created_at_idx` ON `credit_transactions` (`user_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `credit_transactions_source_type_source_id_unique` ON `credit_transactions` (`source_type`,`source_id`);--> statement-breakpoint
CREATE TABLE `feedbacks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `feedbacks_user_id_idx` ON `feedbacks` (`user_id`);--> statement-breakpoint
CREATE INDEX `feedbacks_created_at_idx` ON `feedbacks` (`created_at`);--> statement-breakpoint
CREATE TABLE `notification_reads` (
	`notification_id` text NOT NULL,
	`user_id` text NOT NULL,
	`read_at` integer NOT NULL,
	PRIMARY KEY(`notification_id`, `user_id`)
);
--> statement-breakpoint
CREATE INDEX `notification_reads_user_id_idx` ON `notification_reads` (`user_id`);