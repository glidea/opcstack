CREATE TABLE `aff_referrals` (
	`id` text PRIMARY KEY NOT NULL,
	`inviter_user_id` text NOT NULL,
	`invitee_user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`inviter_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`invitee_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "aff_referrals_not_self_invite" CHECK("aff_referrals"."inviter_user_id" != "aff_referrals"."invitee_user_id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `aff_referrals_invitee_user_id_unique` ON `aff_referrals` (`invitee_user_id`);--> statement-breakpoint
CREATE INDEX `aff_referrals_inviter_user_id_idx` ON `aff_referrals` (`inviter_user_id`);--> statement-breakpoint
DROP TABLE `credit_referrals`;--> statement-breakpoint
DROP INDEX `user_referral_code_unique`;--> statement-breakpoint
ALTER TABLE `user` ADD `aff_code` text;--> statement-breakpoint
CREATE UNIQUE INDEX `user_aff_code_unique` ON `user` (`aff_code`);--> statement-breakpoint
ALTER TABLE `user` DROP COLUMN `referral_code`;