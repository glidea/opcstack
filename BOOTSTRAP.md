# Bootstrap Onboarding Flow

> This is a bootstrap workflow for Coding Agents to help users initialize the project quickly

---

## Your Task

Help the user complete project initialization so the project can run locally.

---

## Onboarding Flow

### Step 1: Collect Required Information

Ask the user for the following details:

**Basic configuration**
1. Project name in English used for Worker name and database name
   - Hint: use lowercase letters and hyphens such as `my-saas`
   - Default value: `opcstack`

2. Logo design
   - Ask: do you have your own logo
   - If yes guide the user to replace `static/logo.svg`
   - If no confirm requirements and design one that supports dark mode adaptation

3. Admin password
   - Hint: set an admin password for admin features
   - Suggestion: recommend a random password

**Auth configuration choose at least one**

Ask the user which auth methods they want:
- [ ] Email signup
- [ ] Google login
- [ ] Both

If they choose email signup:

**Step 1: Confirm domain**
- Ask: do you have your own domain
  - If no guide the user:
    1. Open Cloudflare Dashboard: https://dash.cloudflare.com
    2. Go to Domain Registration and buy a domain
    3. Record the domain such as `example.com`
  - If yes ask for the root domain such as `example.com`
    - Then ask whether the domain is already hosted on Cloudflare
      - If no guide the user to host it on Cloudflare:
        1. Open Cloudflare Dashboard: https://dash.cloudflare.com
        2. Click Add a Site
        3. Enter the root domain such as `example.com`
        4. Choose the free plan
        5. Update nameservers to Cloudflare as instructed
        6. Wait for DNS propagation usually minutes to a few hours

**Step 2: Choose mail domain**
- Ask: which domain do you want to use for sending emails
  - Option 1: use root domain such as `example.com`
  - Option 2: use subdomain such as `mail.example.com` or `myapp.example.com`
- Notes:
  - Any subdomain is valid and does not require an extra purchase
  - If your app is deployed on a subdomain such as `myapp.example.com` you can use it directly for email
  - You can also use a dedicated mail subdomain such as `mail.example.com` to avoid affecting other setup
- Record the selected domain as mail domain for later steps

**Step 3: Configure Resend**
- Guide the user to register at https://resend.com
- Guide the user to add the mail domain in Resend:
  1. In Resend Dashboard click Domains
  2. Click Add Domain
  3. Enter the mail domain such as `mail.example.com`
  4. Resend provides DNS records SPF DKIM DMARC
- Guide the user to configure DNS records:
  1. Go back to Cloudflare Dashboard
  2. Select the root domain such as `example.com`
  3. Open DNS settings
  4. Add all DNS records provided by Resend
  5. Wait for DNS propagation usually a few minutes
  6. Return to Resend and click Verify
- Guide the user to create an API key:
  1. In Resend Dashboard click API Keys
  2. Click Create API Key
  3. Copy the API key
- Wait for the user to provide the API key

**Step 4: Configure sender email**
- Ask for sender email address such as `noreply@mail.example.com`
- Note: sender email must use the configured mail domain

If they choose Google login:
- Ask whether they need help creating a Google OAuth app
  - If yes guide them to https://console.cloud.google.com
  - Wait for Client ID and Client Secret

**Optional configuration ask whether needed**
- Enable beta code feature or not

---

### Step 2: Execute Initialization

After all information is collected run these actions:

1. **Check prerequisites**
   ```bash
   # Check Node.js version
   node --version  # should be >= 20

   # Check pnpm
   pnpm --version  # should be >= 9

   # Check Cloudflare login status
   pnpm exec wrangler whoami
   ```

   If wrangler is not logged in guide the user to run:
   ```bash
   pnpm exec wrangler login
   ```

2. **Generate configuration file**

   Copy `.env.example` to `.env.dev`:
   ```bash
   cp .env.example .env.dev
   ```

   Update `.env.dev` using user input:
   - `APP_NAME`: user project name
   - `BETTER_AUTH_SECRET`: generate random string with 32+ characters
   - `ADMIN_SECRET`: user admin password
   - `EMAIL_ENABLED`: set true or false from user choice
   - `EMAIL_SIGNUP_ENABLED`: set true or false from user choice
   - `EMAIL_RESEND_API_KEY`: user API key if email is enabled
   - `EMAIL_FROM`: user sender email if email is enabled
   - `GOOGLE_AUTH_ENABLED`: set true or false from user choice
   - `GOOGLE_CLIENT_ID`: user Client ID if Google is enabled
   - `GOOGLE_CLIENT_SECRET`: user Client Secret if Google is enabled
   - `BETA_CODE_ENABLED`: set true or false from user choice

   Keep all other configuration as default.

3. **Start development environment**
   ```bash
   pnpm dev
   ```

   This command automatically:
   - Creates D1 database
   - Generates `wrangler.jsonc`
   - Runs database migrations
   - Starts development server

4. **Verify startup success**

   Check:
   - Wrangler dev server running on port 8787
   - Vite dev server running on port 5173
   - No error messages

   If startup succeeds tell the user:
   - Open http://localhost:5173

---

### Step 3: Follow-up Guidance

After initialization tell the user:

1. **Develop business features**
   - Reference `@AGENTS.md` for full project context
   - Start implementing business features
   - If needed check `/public-docs` or ask the Agent

2. **Configure optional features**
   - For R2 storage set `R2_ENABLED=true`
   - For queues set `QUEUE_NAMES`
   - For scheduled jobs set `CRONS`

3. **Deploy to production**
   - When needed copy `.env.dev` to `.env.prod`
   - Set `APP_DOMAIN` to production domain
   - Run `pnpm deploycf` to deploy
