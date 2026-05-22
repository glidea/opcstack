CREATE TABLE `d1_shards` (
	`id` text PRIMARY KEY NOT NULL,
	`binding_name` text NOT NULL,
	`database_name` text NOT NULL,
	`database_id` text NOT NULL,
	`status` text NOT NULL,
	`assigned_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `d1_shards_binding_name_unique` ON `d1_shards` (`binding_name`);--> statement-breakpoint
CREATE UNIQUE INDEX `d1_shards_database_name_unique` ON `d1_shards` (`database_name`);--> statement-breakpoint
CREATE TABLE `user_shards` (
	`user_id` text PRIMARY KEY NOT NULL,
	`shard_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`shard_id`) REFERENCES `d1_shards`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `user_shards_shard_id_idx` ON `user_shards` (`shard_id`);