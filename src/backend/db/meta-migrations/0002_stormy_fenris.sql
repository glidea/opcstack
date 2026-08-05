CREATE TABLE `agent_authorization_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`device_code_hash` text NOT NULL,
	`user_code_hash` text NOT NULL,
	`state_hash` text NOT NULL,
	`code_challenge` text NOT NULL,
	`code_challenge_method` text DEFAULT 'S256' NOT NULL,
	`scopes` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`authorization_code` text,
	`expires_at` integer NOT NULL,
	`code_expires_at` integer,
	`last_polled_at` integer,
	`created_at` integer NOT NULL,
	`consumed_at` integer,
	CONSTRAINT "agent_authorization_requests_code_challenge_method_check" CHECK("agent_authorization_requests"."code_challenge_method" = 'S256'),
	CONSTRAINT "agent_authorization_requests_status_check" CHECK("agent_authorization_requests"."status" in ('pending', 'authorized', 'denied', 'expired', 'consumed')),
	CONSTRAINT "agent_authorization_requests_expiry_check" CHECK("agent_authorization_requests"."expires_at" > "agent_authorization_requests"."created_at")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `agent_authorization_requests_device_code_hash_unique` ON `agent_authorization_requests` (`device_code_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `agent_authorization_requests_user_code_hash_unique` ON `agent_authorization_requests` (`user_code_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `agent_authorization_requests_state_hash_unique` ON `agent_authorization_requests` (`state_hash`);--> statement-breakpoint
CREATE INDEX `agent_authorization_requests_status_expires_at_idx` ON `agent_authorization_requests` (`status`,`expires_at`);--> statement-breakpoint
CREATE TABLE `agent_grants` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`client_id` text NOT NULL,
	`scopes` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`approved_at` integer NOT NULL,
	`revoked_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "agent_grants_status_check" CHECK("agent_grants"."status" in ('active', 'revoked'))
);
--> statement-breakpoint
CREATE INDEX `agent_grants_user_id_status_idx` ON `agent_grants` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `agent_grants_client_id_status_idx` ON `agent_grants` (`client_id`,`status`);