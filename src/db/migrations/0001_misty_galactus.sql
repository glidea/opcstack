CREATE TABLE `credit_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`amount` integer NOT NULL,
	`remaining_amount` integer NOT NULL,
	`source_type` text NOT NULL,
	`source_id` text NOT NULL,
	`expires_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
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
CREATE TABLE `credit_redemption_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`amount` integer NOT NULL,
	`expires_at` integer,
	`used_by` text,
	`used_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`used_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "credit_redemption_codes_amount_gt_zero" CHECK("credit_redemption_codes"."amount" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `credit_redemption_codes_code_unique` ON `credit_redemption_codes` (`code`);--> statement-breakpoint
CREATE INDEX `credit_redemption_codes_expires_at_idx` ON `credit_redemption_codes` (`expires_at`);--> statement-breakpoint
CREATE INDEX `credit_redemption_codes_used_by_idx` ON `credit_redemption_codes` (`used_by`);--> statement-breakpoint
CREATE INDEX `credit_redemption_codes_created_at_idx` ON `credit_redemption_codes` (`created_at`);--> statement-breakpoint
CREATE TABLE `credit_referrals` (
	`id` text PRIMARY KEY NOT NULL,
	`inviter_user_id` text NOT NULL,
	`invitee_user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`inviter_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`invitee_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "credit_referrals_not_self_invite" CHECK("credit_referrals"."inviter_user_id" != "credit_referrals"."invitee_user_id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `credit_referrals_invitee_user_id_unique` ON `credit_referrals` (`invitee_user_id`);--> statement-breakpoint
CREATE INDEX `credit_referrals_inviter_user_id_idx` ON `credit_referrals` (`inviter_user_id`);--> statement-breakpoint
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
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "credit_transactions_amount_not_zero" CHECK("credit_transactions"."amount" != 0)
);
--> statement-breakpoint
CREATE INDEX `credit_transactions_user_id_idx` ON `credit_transactions` (`user_id`);--> statement-breakpoint
CREATE INDEX `credit_transactions_type_idx` ON `credit_transactions` (`type`);--> statement-breakpoint
CREATE INDEX `credit_transactions_created_at_idx` ON `credit_transactions` (`created_at`);--> statement-breakpoint
CREATE INDEX `credit_transactions_user_id_created_at_idx` ON `credit_transactions` (`user_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `user` ADD `referral_code` text;--> statement-breakpoint
ALTER TABLE `user` ADD `credit_balance` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `user_referral_code_unique` ON `user` (`referral_code`);