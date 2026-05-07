PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_checkout_orders` (
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
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_checkout_orders`("id", "user_id", "type", "status", "product_id", "provider", "provider_product_id", "provider_checkout_session_id", "provider_payment_id", "checkout_url", "created_at", "updated_at") SELECT "id", "user_id", "type", "status", "product_id", "provider", "provider_product_id", "provider_checkout_session_id", "provider_payment_id", "checkout_url", "created_at", "updated_at" FROM `checkout_orders`;--> statement-breakpoint
DROP TABLE `checkout_orders`;--> statement-breakpoint
ALTER TABLE `__new_checkout_orders` RENAME TO `checkout_orders`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `checkout_orders_user_id_idx` ON `checkout_orders` (`user_id`);--> statement-breakpoint
CREATE INDEX `checkout_orders_provider_checkout_session_id_idx` ON `checkout_orders` (`provider`,`provider_checkout_session_id`);--> statement-breakpoint
CREATE INDEX `checkout_orders_provider_payment_id_idx` ON `checkout_orders` (`provider`,`provider_payment_id`);--> statement-breakpoint
CREATE TABLE `__new_payment_transactions` (
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
INSERT INTO `__new_payment_transactions`("id", "user_id", "checkout_order_id", "subscription_id", "type", "status", "product_id", "provider", "provider_payment_id", "provider_refund_id", "provider_dispute_id", "amount", "currency", "credits_granted", "credits_reversed_at", "paid_at", "refunded_at", "disputed_at", "created_at", "updated_at") SELECT "id", "user_id", "checkout_order_id", "subscription_id", "type", "status", "product_id", "provider", "provider_payment_id", "provider_refund_id", "provider_dispute_id", "amount", "currency", "credits_granted", "credits_reversed_at", "paid_at", "refunded_at", "disputed_at", "created_at", "updated_at" FROM `payment_transactions`;--> statement-breakpoint
DROP TABLE `payment_transactions`;--> statement-breakpoint
ALTER TABLE `__new_payment_transactions` RENAME TO `payment_transactions`;--> statement-breakpoint
CREATE INDEX `payment_transactions_user_id_idx` ON `payment_transactions` (`user_id`);--> statement-breakpoint
CREATE INDEX `payment_transactions_checkout_order_id_idx` ON `payment_transactions` (`checkout_order_id`);--> statement-breakpoint
CREATE INDEX `payment_transactions_subscription_id_idx` ON `payment_transactions` (`subscription_id`);--> statement-breakpoint
CREATE INDEX `payment_transactions_created_at_idx` ON `payment_transactions` (`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `payment_transactions_provider_payment_id_unique` ON `payment_transactions` (`provider`,`provider_payment_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `payment_transactions_provider_refund_id_unique` ON `payment_transactions` (`provider`,`provider_refund_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `payment_transactions_provider_dispute_id_unique` ON `payment_transactions` (`provider`,`provider_dispute_id`);--> statement-breakpoint
CREATE TABLE `__new_user_subscriptions` (
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
INSERT INTO `__new_user_subscriptions`("user_id", "provider", "provider_subscription_id", "product_id", "subscription_plan", "period_credits_amount", "current_period_start", "current_period_end", "status", "canceled_at", "created_at", "updated_at") SELECT "user_id", "provider", "provider_subscription_id", "product_id", "subscription_plan", "period_credits_amount", "current_period_start", "current_period_end", "status", "canceled_at", "created_at", "updated_at" FROM `user_subscriptions`;--> statement-breakpoint
DROP TABLE `user_subscriptions`;--> statement-breakpoint
ALTER TABLE `__new_user_subscriptions` RENAME TO `user_subscriptions`;--> statement-breakpoint
CREATE UNIQUE INDEX `user_subscriptions_provider_subscription_id_unique` ON `user_subscriptions` (`provider`,`provider_subscription_id`);--> statement-breakpoint
CREATE INDEX `user_subscriptions_current_period_end_idx` ON `user_subscriptions` (`current_period_end`);