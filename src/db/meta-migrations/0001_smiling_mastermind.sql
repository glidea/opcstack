ALTER TABLE `checkout_orders` ADD `product_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `checkout_orders` ADD `product_description` text;--> statement-breakpoint
ALTER TABLE `checkout_orders` ADD `amount` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `checkout_orders` ADD `currency` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `checkout_orders` ADD `credits_amount` integer;--> statement-breakpoint
ALTER TABLE `checkout_orders` ADD `subscription_plan` text;--> statement-breakpoint
ALTER TABLE `checkout_orders` ADD `period_credits_amount` integer;