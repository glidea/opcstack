CREATE TABLE `ai_channels` (
	`id` text PRIMARY KEY NOT NULL,
	`area` text NOT NULL,
	`provider` text NOT NULL,
	`name` text NOT NULL,
	`base_url` text NOT NULL,
	`models` text NOT NULL,
	`price_multiplier` real NOT NULL,
	`api_key_ciphertext` text NOT NULL,
	`api_key_iv` text NOT NULL,
	`enabled` integer NOT NULL,
	`version` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "ai_channels_area_check" CHECK("ai_channels"."area" in ('image', 'tts', 'video')),
	CONSTRAINT "ai_channels_name_check" CHECK(length("ai_channels"."name") > 0),
	CONSTRAINT "ai_channels_price_multiplier_check" CHECK("ai_channels"."price_multiplier" > 0),
	CONSTRAINT "ai_channels_version_check" CHECK("ai_channels"."version" >= 1)
);
--> statement-breakpoint
CREATE INDEX `ai_channels_enabled_area_provider_idx` ON `ai_channels` (`enabled`,`area`,`provider`);--> statement-breakpoint
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
	`type` text NOT NULL,
	`credits_amount` integer,
	`subscription_plan` text,
	`upgrade_rank` integer,
	`period_credits_amount` integer,
	`dodo_product_id` text,
	`creem_product_id` text,
	`version` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "payment_products_type_check" CHECK("payment_products"."type" in ('one_time', 'subscription')),
	CONSTRAINT "payment_products_provider_check" CHECK("payment_products"."dodo_product_id" is not null or "payment_products"."creem_product_id" is not null),
	CONSTRAINT "payment_products_fields_check" CHECK(("payment_products"."type" = 'one_time' and "payment_products"."credits_amount" > 0 and "payment_products"."subscription_plan" is null and "payment_products"."upgrade_rank" is null and "payment_products"."period_credits_amount" is null) or ("payment_products"."type" = 'subscription' and "payment_products"."credits_amount" is null and "payment_products"."subscription_plan" is not null and length("payment_products"."subscription_plan") > 0 and "payment_products"."upgrade_rank" >= 0 and "payment_products"."period_credits_amount" > 0)),
	CONSTRAINT "payment_products_version_check" CHECK("payment_products"."version" >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_products_dodo_product_id_unique` ON `payment_products` (`dodo_product_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `payment_products_creem_product_id_unique` ON `payment_products` (`creem_product_id`);--> statement-breakpoint
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
	`storage_config` text NOT NULL,
	`storage_version` integer NOT NULL,
	`storage_updated_at` integer NOT NULL,
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
	CONSTRAINT "system_settings_versions_check" CHECK("system_settings"."general_version" >= 1 and "system_settings"."authentication_version" >= 1 and "system_settings"."email_version" >= 1 and "system_settings"."storage_version" >= 1 and "system_settings"."credits_version" >= 1 and "system_settings"."affiliate_version" >= 1 and "system_settings"."payment_version" >= 1 and "system_settings"."ai_version" >= 1),
	CONSTRAINT "system_settings_json_check" CHECK(json_valid("system_settings"."general_config") and json_type("system_settings"."general_config") = 'object' and json_valid("system_settings"."authentication_config") and json_type("system_settings"."authentication_config") = 'object' and json_valid("system_settings"."email_config") and json_type("system_settings"."email_config") = 'object' and json_valid("system_settings"."storage_config") and json_type("system_settings"."storage_config") = 'object' and json_valid("system_settings"."credits_config") and json_type("system_settings"."credits_config") = 'object' and json_valid("system_settings"."affiliate_config") and json_type("system_settings"."affiliate_config") = 'object' and json_valid("system_settings"."payment_config") and json_type("system_settings"."payment_config") = 'object' and json_valid("system_settings"."ai_config") and json_type("system_settings"."ai_config") = 'object')
);
--> statement-breakpoint
CREATE INDEX `oauthAccessToken_referenceId_idx` ON `oauth_access_token` (`reference_id`);--> statement-breakpoint
CREATE INDEX `oauthRefreshToken_referenceId_idx` ON `oauth_refresh_token` (`reference_id`);