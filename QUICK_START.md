# Install create-opcstack-app

Install and run the OPCStack app creation Skill for the current Agent platform.

## Canonical Workflow

The Skill name is `create-opcstack-app`. It first creates a runnable shell from fixed deployment topology only. The preparation script generates internal root secrets and one-time administrator credentials. Singleton business settings are configured after startup through System settings, while payment products and AI providers use their own workspaces. Agents may use the same APIs after explicit OAuth authorization. Business settings and third-party credentials never use business ENV files.

Every invocation must fetch and follow the latest workflow from:

```text
https://raw.githubusercontent.com/glidea/opcstack/main/CREATE_OPCSTACK_APP.md
```

Do not copy a fixed version of the workflow into the installed Skill.

## Install

1. Check whether the current Agent platform supports user-level Skills.
2. If `create-opcstack-app` is already installed, use it without reinstalling it.
3. Otherwise, install it as a user-level Skill using the platform's native Skill format and location.
4. After installation, immediately invoke it with the `APP_NAME` from the user's request.
5. If `APP_NAME` is missing or still contains `<APP_NAME>`, ask the user for the app name first.

If the platform does not support Skills, fetch and follow the canonical workflow directly.
