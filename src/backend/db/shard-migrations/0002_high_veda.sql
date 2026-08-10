CREATE TABLE `ai_channel_metric_buckets` (
	`channel` text NOT NULL,
	`model` text NOT NULL,
	`bucket_start` integer NOT NULL,
	`success_count` integer DEFAULT 0 NOT NULL,
	`error_count` integer DEFAULT 0 NOT NULL,
	`success_latency_ms_total` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`channel`, `model`, `bucket_start`)
);
--> statement-breakpoint
CREATE INDEX `ai_channel_metric_buckets_bucket_start_idx` ON `ai_channel_metric_buckets` (`bucket_start`);--> statement-breakpoint
ALTER TABLE `ai_image_tasks` ADD `channel` text;--> statement-breakpoint
CREATE INDEX `ai_image_tasks_status_updated_at_idx` ON `ai_image_tasks` (`status`,`updated_at`);--> statement-breakpoint
ALTER TABLE `ai_tts_tasks` ADD `channel` text;--> statement-breakpoint
CREATE INDEX `ai_tts_tasks_status_updated_at_idx` ON `ai_tts_tasks` (`status`,`updated_at`);--> statement-breakpoint
ALTER TABLE `ai_video_tasks` ADD `channel` text;--> statement-breakpoint
ALTER TABLE `ai_video_tasks` ADD `channel_started_at` integer;--> statement-breakpoint
ALTER TABLE `ai_video_tasks` ADD `failed_channels_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
CREATE INDEX `ai_video_tasks_status_updated_at_idx` ON `ai_video_tasks` (`status`,`updated_at`);