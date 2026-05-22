import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { bearer, captcha, emailOTP } from 'better-auth/plugins'
import { getShardDb, type AppDb } from '../../db'
import { getTenantD1, resolveUserShard } from '../../db/shard-router'
import { newEmailClients, type EmailClients } from '../../email'
import { AffService } from '../../aff'
import { CreditsService } from '../../credits'
import { parseDecimal } from '../../lib/decimal'

export function authCore(env: Env, db: AppDb) {
  const aff = new AffService(db)
  const emailOtpPlugin = buildEmailOtp(env)
  const captchaPlugin = buildTurnstileCaptcha(env)
  const plugins: AuthPlugin[] = [bearer()]
  if (emailOtpPlugin) {
    plugins.push(emailOtpPlugin)
  }
  if (captchaPlugin) {
    plugins.push(captchaPlugin)
  }

  return betterAuth({
    baseURL: env.APP_BASE_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: ['*'],
    database: drizzleAdapter(db, { provider: 'sqlite' }),
    plugins,
    databaseHooks: {
      user: {
        create: {
          before: async (
            userData: Record<string, unknown>
          ): Promise<{ data: Record<string, unknown> }> => {
            const affCode = await aff.createCode()
            return {
              data: {
                ...userData,
                affCode
              }
            }
          },
          after: async (createdUser: Record<string, unknown>): Promise<void> => {
            if (!readCreditsSignupEnabled(env)) {
              return
            }

            const signupAmount = parseDecimal(env.CREDITS_SIGNUP_AMOUNT)
            if (signupAmount <= 0) {
              return
            }

            const userId = String(createdUser['id'] ?? '')
            if (userId === '') {
              return
            }

            const resolved = await resolveUserShard(db, userId)
            const d1 = getTenantD1(env, resolved.bindingName)
            const credits = new CreditsService(getShardDb(d1))
            await credits.grant({
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
    emailVerification: {
      autoSignInAfterVerification: true
    },
    emailAndPassword: buildEmailAndPassword(env),
    socialProviders: buildSocialProviders(env),
    session: {
      expiresIn: 30 * 24 * 60 * 60,
      updateAge: 27 * 24 * 60 * 60
    }
  })
}

function readCreditsSignupEnabled(env: Env): boolean {
  return env.CREDITS_SIGNUP_ENABLED === 'true'
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
    password: buildPasswordHasher()
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

function buildEmailOtp(env: Env): ReturnType<typeof emailOTP> | undefined {
  const emailClient = buildEmailClient(env)
  if (!emailClient) {
    return undefined
  }

  return emailOTP({
    otpLength: 6,
    expiresIn: 300,
    allowedAttempts: 3,
    storeOTP: 'hashed',
    disableSignUp: true,
    sendVerificationOnSignUp: false,
    overrideDefaultEmailVerification: true,
    sendVerificationOTP: async (data: EmailOtpInput): Promise<void> => {
      await emailClient.send({
        to: data.email,
        subject: buildOtpEmailSubject(data.type),
        html: buildOtpEmailHtml(data.otp, data.type)
      })
    }
  })
}

function buildTurnstileCaptcha(env: Env): ReturnType<typeof captcha> | undefined {
  if (env.TURNSTILE_ENABLED !== 'true') {
    return undefined
  }

  return captcha({
    provider: 'cloudflare-turnstile',
    secretKey: env.TURNSTILE_SECRET_KEY,
    endpoints: ['/sign-up/email', '/sign-in/email', '/email-otp/request-password-reset']
  })
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

function buildOtpEmailSubject(type: EmailOtpInput['type']): string {
  if (type === 'forget-password') {
    return 'Reset your password'
  }
  return 'Verify your email'
}

function buildOtpEmailHtml(otp: string, type: EmailOtpInput['type']): string {
  const title = buildOtpEmailSubject(type)
  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
  </head>
  <body style="margin:0;padding:0;background:#f6f7fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;">
            <tr>
              <td style="padding:28px 24px 8px 24px;">
                <h1 style="margin:0;font-size:22px;line-height:1.35;">${title}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:0 24px 8px 24px;">
                <p style="margin:0;font-size:14px;line-height:1.65;color:#4b5563;">Enter this code in the app. It expires in 5 minutes.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 24px 28px 24px;">
                <div style="display:inline-block;background:#111827;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:6px;padding:12px 18px;border-radius:8px;">${otp}</div>
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

type EmailOtpInput = {
  email: string
  otp: string
  type: 'sign-in' | 'email-verification' | 'forget-password' | 'change-email'
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
  }

type AuthPasswordConfig = {
  hash: (password: string) => Promise<string>
  verify: (data: AuthPasswordVerifyInput) => Promise<boolean>
}

type AuthPasswordVerifyInput = {
  hash: string
  password: string
}

type AuthSocialProvidersConfig =
  | {
    google: {
      clientId: string
      clientSecret: string
    }
  }
  | undefined

type AuthPlugin =
  | ReturnType<typeof bearer>
  | ReturnType<typeof emailOTP>
  | ReturnType<typeof captcha>
