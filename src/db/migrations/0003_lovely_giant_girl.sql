CREATE TABLE `checkout_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`status` text NOT NULL,
	`product_id` text NOT NULL,
	`provider` text NOT NULL,
	`provider_product_id` text NOT NULL,
	`provider_checkout_session_id` text,
	`provider_payment_id` text,
	`checkout_url` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `checkout_orders_user_id_idx` ON `checkout_orders` (`user_id`);--> statement-breakpoint
CREATE INDEX `checkout_orders_provider_checkout_session_id_idx` ON `checkout_orders` (`provider`,`provider_checkout_session_id`);--> statement-breakpoint
CREATE INDEX `checkout_orders_provider_payment_id_idx` ON `checkout_orders` (`provider`,`provider_payment_id`);--> statement-breakpoint
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
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
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
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_subscriptions_provider_subscription_id_unique` ON `user_subscriptions` (`provider`,`provider_subscription_id`);--> statement-breakpoint
CREATE INDEX `user_subscriptions_current_period_end_idx` ON `user_subscriptions` (`current_period_end`);