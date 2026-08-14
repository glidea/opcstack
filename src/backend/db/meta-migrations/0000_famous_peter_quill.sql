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
CREATE TABLE `ai_providers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`base_url` text,
	`models` text NOT NULL,
	`price_multiplier` real NOT NULL,
	`api_key_ciphertext` text NOT NULL,
	`api_key_iv` text NOT NULL,
	`enabled` integer NOT NULL,
	`version` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "ai_providers_type_check" CHECK("ai_providers"."type" in ('chat_openai', 'image_gemini', 'image_openai', 'image_seedream', 'image_aliyun', 'tts_gemini', 'tts_seed', 'realtime_doubao', 'video_seedance')),
	CONSTRAINT "ai_providers_name_check" CHECK(length("ai_providers"."name") > 0),
	CONSTRAINT "ai_providers_price_multiplier_check" CHECK("ai_providers"."price_multiplier" > 0),
	CONSTRAINT "ai_providers_version_check" CHECK("ai_providers"."version" >= 1)
);
--> statement-breakpoint
CREATE INDEX `ai_providers_enabled_type_idx` ON `ai_providers` (`enabled`,`type`);--> statement-breakpoint
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
	`archived_at` integer,
	FOREIGN KEY (`target_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `notifications_target_user_id_idx` ON `notifications` (`target_user_id`);--> statement-breakpoint
CREATE INDEX `notifications_created_at_idx` ON `notifications` (`created_at`);--> statement-breakpoint
CREATE INDEX `notifications_archived_at_idx` ON `notifications` (`archived_at`);--> statement-breakpoint
CREATE TABLE `oauth_authorization_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`device_code_hash` text NOT NULL,
	`user_code_hash` text NOT NULL,
	`state_hash` text NOT NULL,
	`code_challenge` text NOT NULL,
	`code_challenge_method` text NOT NULL,
	`requested_scopes` text NOT NULL,
	`status` text NOT NULL,
	`grant_id` text,
	`authorization_code` text,
	`expires_at` integer NOT NULL,
	`code_expires_at` integer,
	`last_polled_at` integer,
	`created_at` integer NOT NULL,
	`consumed_at` integer,
	FOREIGN KEY (`client_id`) REFERENCES `oauth_client`(`client_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`grant_id`) REFERENCES `oauth_grants`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "oauth_authorization_requests_code_challenge_method_check" CHECK("oauth_authorization_requests"."code_challenge_method" = 'S256'),
	CONSTRAINT "oauth_authorization_requests_status_check" CHECK("oauth_authorization_requests"."status" in ('pending', 'authorized', 'denied', 'expired', 'consumed')),
	CONSTRAINT "oauth_authorization_requests_expiry_check" CHECK("oauth_authorization_requests"."expires_at" > "oauth_authorization_requests"."created_at")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oauth_authorization_requests_device_code_hash_unique` ON `oauth_authorization_requests` (`device_code_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `oauth_authorization_requests_user_code_hash_unique` ON `oauth_authorization_requests` (`user_code_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `oauth_authorization_requests_state_hash_unique` ON `oauth_authorization_requests` (`state_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `oauth_authorization_requests_grant_id_unique` ON `oauth_authorization_requests` (`grant_id`);--> statement-breakpoint
CREATE INDEX `oauth_authorization_requests_status_expires_at_idx` ON `oauth_authorization_requests` (`status`,`expires_at`);--> statement-breakpoint
CREATE TABLE `oauth_grants` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`client_id` text NOT NULL,
	`scopes` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`approved_at` integer,
	`revoked_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`client_id`) REFERENCES `oauth_client`(`client_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "oauth_grants_status_check" CHECK("oauth_grants"."status" in ('pending', 'active', 'revoked'))
);
--> statement-breakpoint
CREATE INDEX `oauth_grants_user_id_status_idx` ON `oauth_grants` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `oauth_grants_client_id_status_idx` ON `oauth_grants` (`client_id`,`status`);--> statement-breakpoint
CREATE TABLE `payment_products` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`test_mode` integer NOT NULL,
	`provider_product_id` text NOT NULL,
	`type` text NOT NULL,
	`credits_amount` integer,
	`subscription_plan` text,
	`upgrade_rank` integer,
	`period_credits_amount` integer,
	`version` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "payment_products_type_check" CHECK("payment_products"."type" in ('one_time', 'subscription')),
	CONSTRAINT "payment_products_provider_check" CHECK("payment_products"."provider" in ('dodo', 'creem')),
	CONSTRAINT "payment_products_fields_check" CHECK(("payment_products"."type" = 'one_time' and "payment_products"."credits_amount" > 0 and "payment_products"."subscription_plan" is null and "payment_products"."upgrade_rank" is null and "payment_products"."period_credits_amount" is null) or ("payment_products"."type" = 'subscription' and "payment_products"."credits_amount" is null and "payment_products"."subscription_plan" is not null and length("payment_products"."subscription_plan") > 0 and "payment_products"."upgrade_rank" >= 0 and "payment_products"."period_credits_amount" > 0)),
	CONSTRAINT "payment_products_version_check" CHECK("payment_products"."version" >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_products_provider_environment_product_id_unique` ON `payment_products` (`provider`,`test_mode`,`provider_product_id`);--> statement-breakpoint
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
CREATE TABLE `system_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`general_config` text NOT NULL,
	`general_version` integer NOT NULL,
	`general_updated_at` integer NOT NULL,
	`authentication_config` text NOT NULL,
	`authentication_version` integer NOT NULL,
	`authentication_updated_at` integer NOT NULL,
	`email_config` text NOT NULL,
	`email_version` integer NOT NULL,
	`email_updated_at` integer NOT NULL,
	`credits_config` text NOT NULL,
	`credits_version` integer NOT NULL,
	`credits_updated_at` integer NOT NULL,
	`affiliate_config` text NOT NULL,
	`affiliate_version` integer NOT NULL,
	`affiliate_updated_at` integer NOT NULL,
	`payment_config` text NOT NULL,
	`payment_version` integer NOT NULL,
	`payment_updated_at` integer NOT NULL,
	`ai_config` text NOT NULL,
	`ai_version` integer NOT NULL,
	`ai_updated_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT "system_settings_singleton_check" CHECK("system_settings"."id" = 1),
	CONSTRAINT "system_settings_versions_check" CHECK("system_settings"."general_version" >= 1 and "system_settings"."authentication_version" >= 1 and "system_settings"."email_version" >= 1 and "system_settings"."credits_version" >= 1 and "system_settings"."affiliate_version" >= 1 and "system_settings"."payment_version" >= 1 and "system_settings"."ai_version" >= 1),
	CONSTRAINT "system_settings_json_check" CHECK(json_valid("system_settings"."general_config") and json_type("system_settings"."general_config") = 'object' and json_valid("system_settings"."authentication_config") and json_type("system_settings"."authentication_config") = 'object' and json_valid("system_settings"."email_config") and json_type("system_settings"."email_config") = 'object' and json_valid("system_settings"."credits_config") and json_type("system_settings"."credits_config") = 'object' and json_valid("system_settings"."affiliate_config") and json_type("system_settings"."affiliate_config") = 'object' and json_valid("system_settings"."payment_config") and json_type("system_settings"."payment_config") = 'object' and json_valid("system_settings"."ai_config") and json_type("system_settings"."ai_config") = 'object')
);
--> statement-breakpoint
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
CREATE TABLE `jwks` (
	`id` text PRIMARY KEY NOT NULL,
	`public_key` text NOT NULL,
	`private_key` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer
);
--> statement-breakpoint
CREATE TABLE `oauth_access_token` (
	`id` text PRIMARY KEY NOT NULL,
	`token` text,
	`client_id` text NOT NULL,
	`session_id` text,
	`user_id` text,
	`reference_id` text,
	`refresh_id` text,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`scopes` text NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `oauth_client`(`client_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`session_id`) REFERENCES `session`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`refresh_id`) REFERENCES `oauth_refresh_token`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oauth_access_token_token_unique` ON `oauth_access_token` (`token`);--> statement-breakpoint
CREATE INDEX `oauthAccessToken_clientId_idx` ON `oauth_access_token` (`client_id`);--> statement-breakpoint
CREATE INDEX `oauthAccessToken_sessionId_idx` ON `oauth_access_token` (`session_id`);--> statement-breakpoint
CREATE INDEX `oauthAccessToken_userId_idx` ON `oauth_access_token` (`user_id`);--> statement-breakpoint
CREATE INDEX `oauthAccessToken_refreshId_idx` ON `oauth_access_token` (`refresh_id`);--> statement-breakpoint
CREATE INDEX `oauthAccessToken_referenceId_idx` ON `oauth_access_token` (`reference_id`);--> statement-breakpoint
CREATE TABLE `oauth_client` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`client_secret` text,
	`disabled` integer DEFAULT false,
	`skip_consent` integer,
	`enable_end_session` integer,
	`subject_type` text,
	`scopes` text,
	`user_id` text,
	`created_at` integer,
	`updated_at` integer,
	`name` text,
	`uri` text,
	`icon` text,
	`contacts` text,
	`tos` text,
	`policy` text,
	`software_id` text,
	`software_version` text,
	`software_statement` text,
	`redirect_uris` text NOT NULL,
	`post_logout_redirect_uris` text,
	`token_endpoint_auth_method` text,
	`grant_types` text,
	`response_types` text,
	`public` integer,
	`type` text,
	`require_pkce` integer,
	`reference_id` text,
	`metadata` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oauth_client_client_id_unique` ON `oauth_client` (`client_id`);--> statement-breakpoint
CREATE INDEX `oauthClient_userId_idx` ON `oauth_client` (`user_id`);--> statement-breakpoint
CREATE TABLE `oauth_consent` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`user_id` text,
	`reference_id` text,
	`scopes` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `oauth_client`(`client_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `oauthConsent_clientId_idx` ON `oauth_consent` (`client_id`);--> statement-breakpoint
CREATE INDEX `oauthConsent_userId_idx` ON `oauth_consent` (`user_id`);--> statement-breakpoint
CREATE TABLE `oauth_refresh_token` (
	`id` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`client_id` text NOT NULL,
	`session_id` text,
	`user_id` text NOT NULL,
	`reference_id` text,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`revoked` integer,
	`auth_time` integer,
	`scopes` text NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `oauth_client`(`client_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`session_id`) REFERENCES `session`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oauth_refresh_token_token_unique` ON `oauth_refresh_token` (`token`);--> statement-breakpoint
CREATE INDEX `oauthRefreshToken_clientId_idx` ON `oauth_refresh_token` (`client_id`);--> statement-breakpoint
CREATE INDEX `oauthRefreshToken_sessionId_idx` ON `oauth_refresh_token` (`session_id`);--> statement-breakpoint
CREATE INDEX `oauthRefreshToken_userId_idx` ON `oauth_refresh_token` (`user_id`);--> statement-breakpoint
CREATE INDEX `oauthRefreshToken_referenceId_idx` ON `oauth_refresh_token` (`reference_id`);--> statement-breakpoint
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
	`role` text DEFAULT 'user' NOT NULL,
	`aff_code` text,
	`registration_utm_source` text,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT "user_role_check" CHECK("user"."role" in ('user', 'admin'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_aff_code_unique` ON `user` (`aff_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_single_administrator_idx` ON `user` (`role`) WHERE "user"."role" = 'admin';--> statement-breakpoint
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
