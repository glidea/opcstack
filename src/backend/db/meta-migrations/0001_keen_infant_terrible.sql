PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_ai_providers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`base_url` text NOT NULL,
	`models` text NOT NULL,
	`price_multiplier` real NOT NULL,
	`api_key_ciphertext` text NOT NULL,
	`api_key_iv` text NOT NULL,
	`enabled` integer NOT NULL,
	`version` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "ai_providers_type_check" CHECK("__new_ai_providers"."type" in ('chat_openai', 'image_gemini', 'image_openai', 'image_seedream', 'image_aliyun', 'tts_gemini', 'tts_seed', 'realtime_doubao', 'video_seedance')),
	CONSTRAINT "ai_providers_name_check" CHECK(length("__new_ai_providers"."name") > 0),
	CONSTRAINT "ai_providers_price_multiplier_check" CHECK("__new_ai_providers"."price_multiplier" > 0),
	CONSTRAINT "ai_providers_version_check" CHECK("__new_ai_providers"."version" >= 1)
);
--> statement-breakpoint
INSERT INTO `__new_ai_providers`("id", "name", "type", "base_url", "models", "price_multiplier", "api_key_ciphertext", "api_key_iv", "enabled", "version", "created_at", "updated_at") SELECT "id", "name", "type", "base_url", "models", "price_multiplier", "api_key_ciphertext", "api_key_iv", "enabled", "version", "created_at", "updated_at" FROM `ai_providers`;--> statement-breakpoint
DROP TABLE `ai_providers`;--> statement-breakpoint
ALTER TABLE `__new_ai_providers` RENAME TO `ai_providers`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `ai_providers_enabled_type_idx` ON `ai_providers` (`enabled`,`type`);