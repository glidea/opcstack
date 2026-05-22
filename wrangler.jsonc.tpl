{
    "name": "{{APP_NAME}}",
    "main": "src/index.ts",
    "compatibility_date": "2026-04-08",
    "compatibility_flags": [
        "nodejs_compat"
    ],
    "observability": {
        "enabled": true,
        "logs": {
            "head_sampling_rate": 1
        },
        "traces": {
            "enabled": true,
            "head_sampling_rate": 0.05
        }
    },
    "routes": [
        {
            "pattern": "{{APP_BASE_HOST}}",
            "custom_domain": true
        }
    ],
    "assets": {
        "binding": "ASSETS",
        "directory": ".svelte-kit/cloudflare"
    },
    "d1_databases": [
        {
            "binding": "META_DB",
            "database_name": "{{APP_NAME}}-meta",
            "database_id": "{{D1_DATABASE_UUID}}",
            "migrations_dir": "src/db/meta-migrations"
        }
    ],
    "send_email": [
        {
            "name": "SEND_EMAIL"
        }
    ],
    "vars": {
        "DESIGN_SYSTEM": "{{DESIGN_SYSTEM}}",
        "APP_NAME": "{{APP_NAME}}",
        "APP_BASE_URL": "{{APP_BASE_URL}}",
        "APP_DOMAIN": "{{APP_DOMAIN}}",
        "SUPPORT_EMAIL": "{{SUPPORT_EMAIL}}",
        "BETTER_AUTH_SECRET": "{{BETTER_AUTH_SECRET}}",
        "ADMIN_SECRET": "{{ADMIN_SECRET}}",
        "BETA_CODE_ENABLED": "{{BETA_CODE_ENABLED}}",
        "TURNSTILE_ENABLED": "{{TURNSTILE_ENABLED}}",
        "TURNSTILE_SITE_KEY": "{{TURNSTILE_SITE_KEY}}",
        "TURNSTILE_SECRET_KEY": "{{TURNSTILE_SECRET_KEY}}",
        "GOOGLE_AUTH_ENABLED": "{{GOOGLE_AUTH_ENABLED}}",
        "GOOGLE_CLIENT_ID": "{{GOOGLE_CLIENT_ID}}",
        "GOOGLE_CLIENT_SECRET": "{{GOOGLE_CLIENT_SECRET}}",
        "EMAIL_ENABLED": "{{EMAIL_ENABLED}}",
        "EMAIL_PROVIDER": "{{EMAIL_PROVIDER}}",
        "EMAIL_SIGNUP_ENABLED": "{{EMAIL_SIGNUP_ENABLED}}",
        "EMAIL_REQUIRE_VERIFICATION": "{{EMAIL_REQUIRE_VERIFICATION}}",
        "EMAIL_USER_ACTION_COOLDOWN_SECONDS": "{{EMAIL_USER_ACTION_COOLDOWN_SECONDS}}",
        "EMAIL_RESEND_API_KEY": "{{EMAIL_RESEND_API_KEY}}",
        "EMAIL_FROM": "{{EMAIL_FROM}}",
        "EMAIL_SIGNUP_DOMAIN_ALLOWLIST": "{{EMAIL_SIGNUP_DOMAIN_ALLOWLIST}}",
        "CREDITS_SIGNUP_ENABLED": "{{CREDITS_SIGNUP_ENABLED}}",
        "CREDITS_SIGNUP_AMOUNT": "{{CREDITS_SIGNUP_AMOUNT}}",
        "CREDITS_DAILY_CHECKIN_ENABLED": "{{CREDITS_DAILY_CHECKIN_ENABLED}}",
        "CREDITS_DAILY_CHECKIN_AMOUNT": "{{CREDITS_DAILY_CHECKIN_AMOUNT}}",
        "AFF_ENABLED": "{{AFF_ENABLED}}",
        "AFF_INVITER_CREDIT_AMOUNT": "{{AFF_INVITER_CREDIT_AMOUNT}}",
        "AFF_INVITEE_CREDIT_AMOUNT": "{{AFF_INVITEE_CREDIT_AMOUNT}}",
        "CREDITS_HISTORY_RETENTION_DAYS": "{{CREDITS_HISTORY_RETENTION_DAYS}}",
        "PAYMENT_ENABLED": "{{PAYMENT_ENABLED}}",
        "PAYMENT_PROVIDERS": "{{PAYMENT_PROVIDERS}}",
        "PAYMENT_DEFAULT_PROVIDER": "{{PAYMENT_DEFAULT_PROVIDER}}",
        "PAYMENT_PROVIDER_COUNTRY_OVERRIDES": "{{PAYMENT_PROVIDER_COUNTRY_OVERRIDES}}",
        "PAYMENT_PRODUCTS": "{{PAYMENT_PRODUCTS}}",
        "PAYMENT_DODO_API_KEY": "{{PAYMENT_DODO_API_KEY}}",
        "PAYMENT_DODO_WEBHOOK_SECRET": "{{PAYMENT_DODO_WEBHOOK_SECRET}}",
        "PAYMENT_DODO_TEST_MODE": "{{PAYMENT_DODO_TEST_MODE}}",
        "PAYMENT_CREEM_API_KEY": "{{PAYMENT_CREEM_API_KEY}}",
        "PAYMENT_CREEM_WEBHOOK_SECRET": "{{PAYMENT_CREEM_WEBHOOK_SECRET}}",
        "PAYMENT_CREEM_TEST_MODE": "{{PAYMENT_CREEM_TEST_MODE}}",
        "CHAT_OPENAI_BASE_URL": "{{CHAT_OPENAI_BASE_URL}}",
        "CHAT_OPENAI_API_KEY": "{{CHAT_OPENAI_API_KEY}}",
        "CHAT_OPENAI_MODEL": "{{CHAT_OPENAI_MODEL}}",
        "IMAGE_GEMINI_BASE_URL": "{{IMAGE_GEMINI_BASE_URL}}",
        "IMAGE_GEMINI_API_KEY": "{{IMAGE_GEMINI_API_KEY}}",
        "IMAGE_GEMINI_MODEL": "{{IMAGE_GEMINI_MODEL}}",
        "IMAGE_OPENAI_BASE_URL": "{{IMAGE_OPENAI_BASE_URL}}",
        "IMAGE_OPENAI_API_KEY": "{{IMAGE_OPENAI_API_KEY}}",
        "IMAGE_OPENAI_MODEL": "{{IMAGE_OPENAI_MODEL}}",
        "TTS_GEMINI_BASE_URL": "{{TTS_GEMINI_BASE_URL}}",
        "TTS_GEMINI_API_KEY": "{{TTS_GEMINI_API_KEY}}",
        "TTS_GEMINI_MODEL": "{{TTS_GEMINI_MODEL}}"
    }
}
