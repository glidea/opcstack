import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { bearer } from 'better-auth/plugins'
import type { AppDb } from '../../db'
import { newEmailClients, type EmailClients } from '../../email'
import { createReferralCode, grantCredits } from '../../credits'

export function authCore(env: Env, db: AppDb) {
  return betterAuth({
    baseURL: env.APP_BASE_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: ['*'],
    database: drizzleAdapter(db, { provider: 'sqlite' }),
    plugins: [bearer()],
    databaseHooks: {
      user: {
        create: {
          before: async (
            userData: Record<string, unknown>
          ): Promise<{ data: Record<string, unknown> }> => {
            const referralCode = await createReferralCode(db)
            return {
              data: {
                ...userData,
                referralCode
              }
            }
          },
          after: async (createdUser: Record<string, unknown>): Promise<void> => {
            if (!readCreditsSignupEnabled(env)) {
              return
            }

            const signupAmount = readCreditsSignupAmount(env)
            if (signupAmount <= 0) {
              return
            }

            const userId = String(createdUser.id ?? '')
            if (userId === '') {
              return
            }

            await grantCredits({
              db,
              userId,
              type: 'signup',
              amount: signupAmount,
              sourceType: 'signup',
              sourceId: userId,
              description: 'Signup reward'
            })
          }
        }
      }
    },
    emailAndPassword: buildEmailAndPassword(env),
    emailVerification: buildEmailVerification(env),
    socialProviders: buildSocialProviders(env),
    session: {
      expiresIn: 30 * 24 * 60 * 60,
      updateAge: 27 * 24 * 60 * 60
    }
  })
}

function readCreditsSignupEnabled(env: Env): boolean {
  const value = readOptionalEnv(env, 'CREDITS_SIGNUP_ENABLED')
  return value === 'true'
}

function readCreditsSignupAmount(env: Env): number {
  const raw = readOptionalEnv(env, 'CREDITS_SIGNUP_AMOUNT')
  const parsed = Number(raw ?? '0')
  if (!Number.isFinite(parsed)) {
    return 0
  }
  return Math.max(0, Math.floor(parsed))
}

function readOptionalEnv(env: Env, key: string): string | undefined {
  const envMap = env as unknown as Record<string, string | undefined>
  return envMap[key]
}

function buildEmailAndPassword(env: Env): AuthEmailAndPasswordConfig {
  const emailRequireVerification = env.EMAIL_REQUIRE_VERIFICATION === 'true'
  const emailSignupEnabled = env.EMAIL_SIGNUP_ENABLED === 'true'
  const emailClient = buildEmailClient(env)
  if (!emailClient) {
    return {
      enabled: false,
      disableSignUp: true,
      requireEmailVerification: emailRequireVerification
    }
  }

  return {
    enabled: true,
    disableSignUp: !emailSignupEnabled,
    requireEmailVerification: emailRequireVerification,
    // Use runtime native scrypt in Workers to avoid CPU-heavy pure JS fallback.
    password: buildPasswordHasher(),
    sendResetPassword: async (data: EmailActionInput): Promise<void> => {
      await emailClient.send({
        to: data.user.email,
        subject: 'Reset your password',
        html: buildResetPasswordEmailHtml(data.url)
      })
    }
  }
}

function buildPasswordHasher(): AuthPasswordConfig {
  // Keep the same "saltHex:keyHex" format used by better-auth default hasher.
  return {
    hash: async (password: string): Promise<string> => {
      const saltHex = createSaltHex()
      const keyHex = await deriveDigestHex(password, saltHex)
      return `${saltHex}:${keyHex}`
    },
    verify: async (data: AuthPasswordVerifyInput): Promise<boolean> => {
      const [saltHex, hashHex] = data.hash.split(':')
      if (!saltHex || !hashHex) {
        return false
      }
      const actualHashHex = await deriveDigestHex(data.password, saltHex)
      return actualHashHex === hashHex
    }
  }
}

function createSaltHex(): string {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  return bytesToHex(bytes)
}

async function deriveDigestHex(password: string, saltHex: string): Promise<string> {
  // Single-round SHA-1 for minimum CPU cost.
  const raw = `${password}:${saltHex}`
  const bytes = new TextEncoder().encode(raw)
  const digest = await crypto.subtle.digest('SHA-1', bytes)
  return bytesToHex(new Uint8Array(digest))
}

function bytesToHex(bytes: Uint8Array): string {
  let output = ''
  for (const value of bytes) {
    output += value.toString(16).padStart(2, '0')
  }
  return output
}

function buildEmailVerification(env: Env): AuthEmailVerificationConfig {
  const emailClient = buildEmailClient(env)
  if (!emailClient) {
    return undefined
  }

  return {
    sendOnSignUp: true as const,
    sendVerificationEmail: async (data: EmailActionInput): Promise<void> => {
      await emailClient.send({
        to: data.user.email,
        subject: 'Verify your email',
        html: buildVerificationEmailHtml(data.url)
      })
    }
  }
}

function buildEmailClient(env: Env): EmailClients['simple'] | undefined {
  if (env.EMAIL_ENABLED !== 'true') {
    return undefined
  }
  return newEmailClients(env).simple
}

function buildSocialProviders(env: Env): AuthSocialProvidersConfig {
  if (String(env.GOOGLE_AUTH_ENABLED) !== 'true') {
    return undefined
  }

  return {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET
    }
  }
}

function buildVerificationEmailHtml(url: string): string {
  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Verify your email</title>
  </head>
  <body style="margin:0;padding:0;background:#f6f7fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;">
            <tr>
              <td style="padding:28px 24px 8px 24px;">
                <h1 style="margin:0;font-size:22px;line-height:1.35;">Verify your email</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:0 24px 8px 24px;">
                <p style="margin:0;font-size:14px;line-height:1.65;color:#4b5563;">Click the button below to verify your email address.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 24px;">
                <a href="${url}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 16px;border-radius:8px;">Verify Email</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`.trim()
}

function buildResetPasswordEmailHtml(url: string): string {
  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Reset your password</title>
  </head>
  <body style="margin:0;padding:0;background:#f6f7fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;">
            <tr>
              <td style="padding:28px 24px 8px 24px;">
                <h1 style="margin:0;font-size:22px;line-height:1.35;">Reset your password</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:0 24px 8px 24px;">
                <p style="margin:0;font-size:14px;line-height:1.65;color:#4b5563;">Click the button below to set a new password.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 24px;">
                <a href="${url}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 16px;border-radius:8px;">Reset Password</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`.trim()
}

type EmailActionInput = {
  user: { email: string }
  url: string
}

type AuthEmailAndPasswordConfig =
  | {
    enabled: false
    disableSignUp: true
    requireEmailVerification: boolean
  }
  | {
    enabled: true
    disableSignUp: boolean
    requireEmailVerification: boolean
    password: AuthPasswordConfig
    sendResetPassword: (data: EmailActionInput) => Promise<void>
  }

type AuthPasswordConfig = {
  hash: (password: string) => Promise<string>
  verify: (data: AuthPasswordVerifyInput) => Promise<boolean>
}

type AuthPasswordVerifyInput = {
  hash: string
  password: string
}

type AuthEmailVerificationConfig =
  | {
    sendOnSignUp: true
    sendVerificationEmail: (data: EmailActionInput) => Promise<void>
  }
  | undefined

type AuthSocialProvidersConfig =
  | {
    google: {
      clientId: string
      clientSecret: string
    }
  }
  | undefined
