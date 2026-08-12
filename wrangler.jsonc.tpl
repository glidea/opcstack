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
            "migrations_dir": "src/backend/db/meta-migrations"
        }
    ],
    "send_email": [
        {
            "name": "SEND_EMAIL"
        }
    ],
    "vars": {
        "APP_NAME": "{{APP_NAME}}",
        "APP_VERSION": "{{APP_VERSION}}",
        "APP_BASE_URL": "{{APP_BASE_URL}}",
        "APP_DOMAIN": "{{APP_DOMAIN}}",
        "APP_CN_DOMAIN": "{{APP_CN_DOMAIN}}",
        "APP_CN_CNAME_TARGET": "{{APP_CN_CNAME_TARGET}}",
        "EXTENSION_HOST_PERMISSIONS": "{{EXTENSION_HOST_PERMISSIONS}}",
		"AI_ROUTING_ERROR_WEIGHT": "{{AI_ROUTING_ERROR_WEIGHT}}",
		"AI_ROUTING_LATENCY_WEIGHT": "{{AI_ROUTING_LATENCY_WEIGHT}}",
		"AI_ROUTING_PRICE_WEIGHT": "{{AI_ROUTING_PRICE_WEIGHT}}",
		"AI_TASK_RETENTION_DAYS": "{{AI_TASK_RETENTION_DAYS}}",
        "CHAT_OPENAI_BASE_URL": "{{CHAT_OPENAI_BASE_URL}}",
        "CHAT_OPENAI_MODEL": "{{CHAT_OPENAI_MODEL}}",
        "IMAGE_GEMINI_BASE_URL": "{{IMAGE_GEMINI_BASE_URL}}",
        "IMAGE_GEMINI_MODEL": "{{IMAGE_GEMINI_MODEL}}",
        "IMAGE_OPENAI_BASE_URL": "{{IMAGE_OPENAI_BASE_URL}}",
        "IMAGE_OPENAI_MODEL": "{{IMAGE_OPENAI_MODEL}}",
        "IMAGE_SEEDDREAM_BASE_URL": "{{IMAGE_SEEDDREAM_BASE_URL}}",
        "IMAGE_SEEDDREAM_MODEL": "{{IMAGE_SEEDDREAM_MODEL}}",
        "IMAGE_ALIYUN_BASE_URL": "{{IMAGE_ALIYUN_BASE_URL}}",
        "IMAGE_ALIYUN_MODEL": "{{IMAGE_ALIYUN_MODEL}}",
        "TTS_GEMINI_BASE_URL": "{{TTS_GEMINI_BASE_URL}}",
        "TTS_GEMINI_MODEL": "{{TTS_GEMINI_MODEL}}",
        "TTS_SEED_BASE_URL": "{{TTS_SEED_BASE_URL}}",
        "TTS_SEED_MODEL": "{{TTS_SEED_MODEL}}",
        "REALTIME_DOUBAO_BASE_URL": "{{REALTIME_DOUBAO_BASE_URL}}",
        "REALTIME_DOUBAO_MODEL": "{{REALTIME_DOUBAO_MODEL}}",
        "VIDEO_SEEDDANCE_BASE_URL": "{{VIDEO_SEEDDANCE_BASE_URL}}",
        "VIDEO_SEEDDANCE_MODEL": "{{VIDEO_SEEDDANCE_MODEL}}",
        "R2_TMP_LIFECYCLE_RULES": "{{R2_TMP_LIFECYCLE_RULES}}",
        "DO_NAMES": "{{DO_NAMES}}"
    }
}
