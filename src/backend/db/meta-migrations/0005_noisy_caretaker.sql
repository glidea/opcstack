PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`aff_code` text,
	`registration_utm_source` text,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT "user_role_check" CHECK("__new_user"."role" in ('user', 'admin'))
);
--> statement-breakpoint
INSERT INTO `__new_user`("id", "name", "email", "role", "aff_code", "registration_utm_source", "email_verified", "image", "created_at", "updated_at") SELECT "id", "name", "email", 'user', "aff_code", "registration_utm_source", "email_verified", "image", "created_at", "updated_at" FROM `user`;--> statement-breakpoint
DROP TABLE `user`;--> statement-breakpoint
ALTER TABLE `__new_user` RENAME TO `user`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_aff_code_unique` ON `user` (`aff_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_single_administrator_idx` ON `user` (`role`) WHERE "user"."role" = 'admin';
