CREATE TABLE `aff_referrals` (
	`id` text PRIMARY KEY NOT NULL,
	`inviter_user_id` text NOT NULL,
	`invitee_user_id` text NOT NULL,
	`inviter_granted_at` integer,
	`invitee_granted_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`inviter_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`invitee_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "aff_referrals_not_self_invite" CHECK("aff_referrals"."inviter_user_id" != "aff_referrals"."invitee_user_id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `aff_referrals_invitee_user_id_unique` ON `aff_referrals` (`invitee_user_id`);--> statement-breakpoint
CREATE INDEX `aff_referrals_inviter_user_id_idx` ON `aff_referrals` (`inviter_user_id`);--> statement-breakpoint
CREATE TABLE `beta_code` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`used_by` text,
	`used_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `beta_code_code_unique` ON `beta_code` (`code`);--> statement-breakpoint
CREATE TABLE `checkout_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`status` text NOT NULL,
	`product_id` text NOT NULL,
	`provider` text NOT NULL,
	`provider_product_id` text NOT NULL,
	`product_name` text DEFAULT '' NOT NULL,
	`product_description` text,
	`amount` integer DEFAULT 0 NOT NULL,
	`currency` text DEFAULT '' NOT NULL,
	`credits_amount` integer,
	`subscription_plan` text,
	`period_credits_amount` integer,
	`provider_checkout_session_id` text,
	`provider_payment_id` text,
	`checkout_url` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `checkout_orders_user_id_idx` ON `checkout_orders` (`user_id`);--> statement-breakpoint
CREATE INDEX `checkout_orders_provider_checkout_session_id_idx` ON `checkout_orders` (`provider`,`provider_checkout_session_id`);--> statement-breakpoint
CREATE INDEX `checkout_orders_provider_payment_id_idx` ON `checkout_orders` (`provider`,`provider_payment_id`);--> statement-breakpoint
CREATE TABLE `credit_redemption_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`amount` integer NOT NULL,
	`status` text DEFAULT 'unused' NOT NULL,
	`expires_at` integer,
	`claimed_by` text,
	`claimed_at` integer,
	`granted_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`claimed_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "credit_redemption_codes_amount_gt_zero" CHECK("credit_redemption_codes"."amount" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `credit_redemption_codes_code_unique` ON `credit_redemption_codes` (`code`);--> statement-breakpoint
CREATE INDEX `credit_redemption_codes_status_claimed_at_idx` ON `credit_redemption_codes` (`status`,`claimed_at`);--> statement-breakpoint
CREATE INDEX `credit_redemption_codes_expires_at_idx` ON `credit_redemption_codes` (`expires_at`);--> statement-breakpoint
CREATE INDEX `credit_redemption_codes_claimed_by_idx` ON `credit_redemption_codes` (`claimed_by`);--> statement-breakpoint
CREATE INDEX `credit_redemption_codes_created_at_idx` ON `credit_redemption_codes` (`created_at`);--> statement-breakpoint
CREATE TABLE `d1_shards` (
	`id` text PRIMARY KEY NOT NULL,
	`binding_name` text NOT NULL,
	`database_name` text NOT NULL,
	`database_id` text NOT NULL,
	`region` text NOT NULL,
	`status` text NOT NULL,
	`assigned_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `d1_shards_binding_name_unique` ON `d1_shards` (`binding_name`);--> statement-breakpoint
CREATE UNIQUE INDEX `d1_shards_database_name_unique` ON `d1_shards` (`database_name`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`target_user_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`target_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `notifications_target_user_id_idx` ON `notifications` (`target_user_id`);--> statement-breakpoint
CREATE INDEX `notifications_created_at_idx` ON `notifications` (`created_at`);--> statement-breakpoint
CREATE TABLE `payment_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`checkout_order_id` text,
	`subscription_id` text,
	`type` text NOT NULL,
	`status` text NOT NULL,
	`product_id` text NOT NULL,
	`provider` text NOT NULL,
	`provider_payment_id` text,
	`provider_refund_id` text,
	`provider_dispute_id` text,
	`amount` integer NOT NULL,
	`currency` text NOT NULL,
	`credits_granted` integer DEFAULT 0 NOT NULL,
	`credits_reversed_at` integer,
	`paid_at` integer,
	`refunded_at` integer,
	`disputed_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `payment_transactions_user_id_idx` ON `payment_transactions` (`user_id`);--> statement-breakpoint
CREATE INDEX `payment_transactions_checkout_order_id_idx` ON `payment_transactions` (`checkout_order_id`);--> statement-breakpoint
CREATE INDEX `payment_transactions_subscription_id_idx` ON `payment_transactions` (`subscription_id`);--> statement-breakpoint
CREATE INDEX `payment_transactions_created_at_idx` ON `payment_transactions` (`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `payment_transactions_provider_payment_id_unique` ON `payment_transactions` (`provider`,`provider_payment_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `payment_transactions_provider_refund_id_unique` ON `payment_transactions` (`provider`,`provider_refund_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `payment_transactions_provider_dispute_id_unique` ON `payment_transactions` (`provider`,`provider_dispute_id`);--> statement-breakpoint
CREATE TABLE `payment_webhook_events` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`webhook_id` text NOT NULL,
	`event_type` text NOT NULL,
	`processed_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_webhook_events_provider_webhook_id_unique` ON `payment_webhook_events` (`provider`,`webhook_id`);--> statement-breakpoint
CREATE INDEX `payment_webhook_events_processed_at_idx` ON `payment_webhook_events` (`processed_at`);--> statement-breakpoint
CREATE TABLE `user_shards` (
	`user_id` text PRIMARY KEY NOT NULL,
	`shard_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`shard_id`) REFERENCES `d1_shards`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `user_shards_shard_id_idx` ON `user_shards` (`shard_id`);--> statement-breakpoint
CREATE TABLE `user_subscriptions` (
	`user_id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`provider_subscription_id` text NOT NULL,
	`product_id` text NOT NULL,
	`subscription_plan` text NOT NULL,
	`period_credits_amount` integer NOT NULL,
	`current_period_start` integer NOT NULL,
	`current_period_end` integer NOT NULL,
	`status` text NOT NULL,
	`canceled_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_subscriptions_provider_subscription_id_unique` ON `user_subscriptions` (`provider`,`provider_subscription_id`);--> statement-breakpoint
CREATE INDEX `user_subscriptions_current_period_end_idx` ON `user_subscriptions` (`current_period_end`);--> statement-breakpoint
CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`aff_code` text,
	`registration_utm_source` text,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_aff_code_unique` ON `user` (`aff_code`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);