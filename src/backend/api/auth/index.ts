import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { bearer, captcha, emailOTP, genericOAuth, jwt } from 'better-auth/plugins'
import { oauthProvider } from '@better-auth/oauth-provider'
import type { MetaDb } from '../../db'
import * as authSchema from '../../db/schema.auth'
import {
	createTenantShardAccess,
	type D1ShardRegion,
	resolveD1ShardRegion,
	type WorkerRegionSource
} from '../../db/shard-router'
import { createEmailClients, type EmailClients } from '../../email'
import { AffService } from '../../aff'
import { CreditsService } from '../../credits'
import { parseDecimal } from '../../lib/decimal'
import {
	AGENT_CLIENT_ID,
	AgentAuthError,
	getAgentGrant,
	getOrCreateActiveGrant,
	parseCanonicalScopes
} from '../../agent-auth'

const REGISTRATION_UTM_SOURCE_COOKIE = 'registration_utm_source'

export function authCore(env: Env, db: MetaDb) {
  const aff = new AffService(db)
  const emailOtpPlugin = buildEmailOtp(env)
  const captchaPlugin = buildTurnstileCaptcha(env)
  const linuxDoOAuthPlugin: ReturnType<typeof genericOAuth> | undefined = buildLinuxDoOAuth(env)
  const plugins: AuthPlugin[] = [bearer(), jwt(), emailOtpPlugin, buildAgentOAuthProvider(env, db)]
  if (captchaPlugin) {
    plugins.push(captchaPlugin)
  }
  if (linuxDoOAuthPlugin) {
    plugins.push(linuxDoOAuthPlugin)
  }

  return betterAuth({
    baseURL: env.APP_BASE_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: ['*'],
    database: drizzleAdapter(db, { provider: 'sqlite', schema: authSchema }),
    plugins,
    user: {
      additionalFields: {
        registrationUtmSource: {
          type: 'string',
          required: false,
          input: false,
          returned: false
        }
      }
    },
    databaseHooks: {
      user: {
        create: {
          before: async (
            userData: Record<string, unknown>,
            context: AuthHookContext | null
          ): Promise<{ data: Record<string, unknown> }> => {
            const affCode = await aff.createCode()
            const registrationUtmSource = readRegistrationUtmSource(context)
            return {
              data: {
                ...userData,
                affCode,
                registrationUtmSource
              }
            }
          },
          after: async (
            createdUser: Record<string, unknown>,
            context: AuthHookContext | null
          ): Promise<void> => {
            const userId = String(createdUser['id'] ?? '')
            if (userId === '') {
              return
            }

            const tenant = await createTenantShardAccess(db, env).openUserDb(
              userId,
              readAuthRequestRegion(context)
            )
            const credits = new CreditsService(tenant.db)
            await credits.createBalance({ userId })
            if (!readCreditsSignupEnabled(env)) {
              return
            }

            const signupAmount = parseDecimal(env.CREDITS_SIGNUP_AMOUNT)
            if (signupAmount <= 0) {
              return
            }

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
      sendOnSignUp: false,
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

function buildAgentOAuthProvider(env: Env, db: MetaDb): ReturnType<typeof oauthProvider> {
  return oauthProvider({
    scopes: ['agent', 'offline_access'],
    validAudiences: [env.APP_BASE_URL],
    grantTypes: ['authorization_code', 'refresh_token'],
    accessTokenExpiresIn: 15 * 60,
    refreshTokenExpiresIn: 30 * 24 * 60 * 60,
    loginPage: '/agent/authorize',
    consentPage: '/agent/consent',
    storeTokens: 'hashed',
    postLogin: {
			page: '/agent/authorize',
			shouldRedirect: async (): Promise<boolean> => false,
			consentReferenceId: async ({ user }): Promise<string> => {
				const grant = await getOrCreateActiveGrant(db, {
					userId: user.id,
					clientId: AGENT_CLIENT_ID,
					scopes: []
				})
				return grant.id
			}
		},
		customAccessTokenClaims: async ({ user, referenceId }): Promise<Record<string, unknown>> => {
			if (!user || !referenceId) {
				return {}
			}
			const grant = await getAgentGrant(db, referenceId)
			if (grant.status !== 'active') {
				throw new AgentAuthError('GRANT_REVOKED', 'Agent grant is revoked')
			}
			return {
				grant_id: grant.id,
				agent_scopes: parseCanonicalScopes(grant.scopes),
				agent_grant_status: grant.status
			}
		}
  })
}

type AuthHookContext = {
  headers?: Headers
  request?: Request
}

function readAuthRequestRegion(context: AuthHookContext | null): D1ShardRegion {
  const request = context?.request as (Request & { cf?: WorkerRegionSource }) | undefined
  return resolveD1ShardRegion(request?.cf)
}

function readRegistrationUtmSource(context: AuthHookContext | null): string | null {
  const cookie = context?.headers?.get('cookie') ?? context?.request?.headers.get('cookie') ?? ''
  const pairs = cookie.split(';')
  for (const pair of pairs) {
    const [rawName, rawValue] = pair.trim().split('=')
    if (rawName === REGISTRATION_UTM_SOURCE_COOKIE) {
      return decodeURIComponent(rawValue ?? '')
    }
  }
  return null
}

function readCreditsSignupEnabled(env: Env): boolean {
  return env.CREDITS_SIGNUP_ENABLED === 'true'
}

function buildEmailAndPassword(env: Env): AuthEmailAndPasswordConfig {
  const emailRequireVerification = env.EMAIL_REQUIRE_VERIFICATION === 'true'
  const emailSignupEnabled = env.EMAIL_SIGNUP_ENABLED === 'true'

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

function buildEmailOtp(env: Env): ReturnType<typeof emailOTP> {
  const emailClient = buildEmailClient(env)

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
  if (String(env.TURNSTILE_ENABLED) !== 'true') {
    return undefined
  }

  return captcha({
    provider: 'cloudflare-turnstile',
    secretKey: env.TURNSTILE_SECRET_KEY,
    endpoints: ['/sign-up/email', '/sign-in/email', '/email-otp/request-password-reset']
  })
}

function buildLinuxDoOAuth(env: Env): ReturnType<typeof genericOAuth> | undefined {
  if (String(env.LINUXDO_AUTH_ENABLED) !== 'true') {
    return undefined
  }

  return genericOAuth({
    config: [
      {
        providerId: 'linuxdo',
        clientId: env.LINUXDO_CLIENT_ID,
        clientSecret: env.LINUXDO_CLIENT_SECRET,
        authorizationUrl: 'https://connect.linux.do/oauth2/authorize',
        tokenUrl: 'https://connect.linux.do/oauth2/token',
        userInfoUrl: 'https://connect.linux.do/api/user',
        authentication: 'basic',
        mapProfileToUser: mapLinuxDoProfileToUser
      }
    ]
  })
}

function mapLinuxDoProfileToUser(profile: Record<string, unknown>): LinuxDoMappedUser {
  const id: string = String(profile['id'])
  const avatarTemplate: string | undefined = profile['avatar_template'] as string | undefined
  return {
    id,
    email: `linuxdo-${id}@linuxdo.local`,
    emailVerified: true,
    name: String(profile['name'] ?? profile['username']),
    image: buildLinuxDoAvatarUrl(avatarTemplate)
  }
}

function buildLinuxDoAvatarUrl(avatarTemplate: string | undefined): string | undefined {
  if (!avatarTemplate) {
    return undefined
  }
  return `https://connect.linux.do${avatarTemplate.replace('{size}', '96')}`
}

function buildEmailClient(env: Env): EmailClients['simple'] {
  return createEmailClients(env).simple
}

function buildSocialProviders(env: Env): AuthSocialProvidersConfig {
	const providers: Exclude<AuthSocialProvidersConfig, undefined> = {}
	if (String(env.GOOGLE_AUTH_ENABLED) === 'true') {
		providers.google = {
			clientId: env.GOOGLE_CLIENT_ID,
			clientSecret: env.GOOGLE_CLIENT_SECRET
		}
	}
	if (String(env.GITHUB_AUTH_ENABLED) === 'true') {
		providers.github = {
			clientId: env.GITHUB_CLIENT_ID,
			clientSecret: env.GITHUB_CLIENT_SECRET
		}
	}
	if (!providers.google && !providers.github) {
		return undefined
	}
	return providers
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
			google?: {
				clientId: string
				clientSecret: string
			}
			github?: {
				clientId: string
				clientSecret: string
			}
	  }
	| undefined

type AuthPlugin =
	| ReturnType<typeof bearer>
	| ReturnType<typeof jwt>
	| ReturnType<typeof emailOTP>
  | ReturnType<typeof captcha>
  | ReturnType<typeof genericOAuth>
  | ReturnType<typeof oauthProvider>

type LinuxDoMappedUser = {
  id: string
  email: string
  emailVerified: boolean
  name: string
  image: string | undefined
}
