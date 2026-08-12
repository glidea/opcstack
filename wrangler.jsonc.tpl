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
        "R2_TMP_LIFECYCLE_RULES": "{{R2_TMP_LIFECYCLE_RULES}}",
        "DO_NAMES": "{{DO_NAMES}}"
    }
}
