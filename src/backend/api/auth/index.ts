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
import { createEmailClients, EmailError, type EmailClients } from '../../email'
import { AffService } from '../../aff'
import { CreditsService } from '../../credits'
import {
	OAUTH_API_CLIENT_ID,
	OAuthApiAccessError,
	getOAuthGrant,
	getPendingOAuthGrant
} from '../../oauth-api-access'
import { isAdministratorScope } from '../scopes'
import { isAdministrator } from '../../auth/administrator'
import {
	getCreditsConfig,
	type CreditsConfig,
	type AuthenticationRuntimeConfig,
	type AuthenticationRuntimeProviderConfig,
	type AuthRuntimeConfig,
	type EmailRuntimeConfig
} from '../../config'

const REGISTRATION_UTM_SOURCE_COOKIE = 'registration_utm_source'

export function authCore(env: Env, db: MetaDb, config: AuthRuntimeConfig) {
  const aff = new AffService(db)
  const emailOtpPlugin = buildEmailOtp(env, config.email, config.systemEmail)
  const captchaPlugin = buildTurnstileCaptcha(config.authentication)
  const linuxDoOAuthPlugin: ReturnType<typeof genericOAuth> | undefined = buildLinuxDoOAuth(
		config.authentication.providers.linuxdo
	)
  const plugins: AuthPlugin[] = [bearer(), jwt(), emailOtpPlugin, buildApiAccessOAuthProvider(env, db)]
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
		role: {
			type: 'string',
			required: false,
			input: false
		},
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
			const creditsConfig: CreditsConfig = await getCreditsConfig(db)
			if (!creditsConfig.signupEnabled) {
              return
            }

            await credits.grant({
              userId,
              type: 'signup',
				amount: creditsConfig.signupAmount,
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
    emailAndPassword: buildEmailAndPassword(config),
    socialProviders: buildSocialProviders(config.authentication),
    session: {
      expiresIn: 30 * 24 * 60 * 60,
      updateAge: 27 * 24 * 60 * 60
    }
  })
}

function buildApiAccessOAuthProvider(env: Env, db: MetaDb): ReturnType<typeof oauthProvider> {
  return oauthProvider({
    scopes: ['api_access', 'offline_access'],
    validAudiences: [env.APP_BASE_URL],
    grantTypes: ['authorization_code', 'refresh_token'],
    accessTokenExpiresIn: 15 * 60,
    refreshTokenExpiresIn: 30 * 24 * 60 * 60,
    loginPage: '/oauth/authorize',
    consentPage: '/oauth/consent',
    storeTokens: 'hashed',
    postLogin: {
			page: '/oauth/authorize',
			shouldRedirect: async (): Promise<boolean> => false,
			consentReferenceId: async ({ user }): Promise<string> => {
				const grant = await getPendingOAuthGrant(db, user.id, OAUTH_API_CLIENT_ID)
				if (
					grant.scopes.some(isAdministratorScope) &&
					!(await isAdministrator(db, user.id))
				) {
					throw new OAuthApiAccessError(
						'INVALID_SCOPE',
						'Administrator access is required for the requested scopes'
					)
				}
				return grant.id
			}
		},
		customAccessTokenClaims: async ({ user, referenceId }): Promise<Record<string, unknown>> => {
			if (!user || !referenceId) {
				return {}
			}
			const grant = await getOAuthGrant(db, referenceId)
			if (grant.status !== 'active') {
				throw new OAuthApiAccessError('GRANT_REVOKED', 'OAuth grant is revoked')
			}
			return {
				grant_id: grant.id,
				api_scopes: grant.scopes
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

function buildEmailAndPassword(config: AuthRuntimeConfig): AuthEmailAndPasswordConfig {
  return {
    enabled: true,
    disableSignUp: !config.email.enabled || !config.authentication.emailSignupEnabled,
    requireEmailVerification:
      config.email.enabled && config.authentication.emailRequireVerification,
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

function buildEmailOtp(
	env: Env,
	config: EmailRuntimeConfig,
	systemEmail: string
): ReturnType<typeof emailOTP> {
	const emailClient = buildEmailClient(env, config, systemEmail)

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

function buildTurnstileCaptcha(
  config: AuthenticationRuntimeConfig
): ReturnType<typeof captcha> | undefined {
  if (!config.turnstile.enabled) {
    return undefined
  }
  if (!config.turnstile.secretKey) {
    throw new Error('Turnstile secret is unavailable')
  }

  return captcha({
    provider: 'cloudflare-turnstile',
    secretKey: config.turnstile.secretKey,
    endpoints: ['/sign-up/email', '/sign-in/email', '/email-otp/request-password-reset']
  })
}

function buildLinuxDoOAuth(
  provider: AuthenticationRuntimeProviderConfig
): ReturnType<typeof genericOAuth> | undefined {
  if (!provider.enabled) {
    return undefined
  }
  if (!provider.clientId || !provider.clientSecret) {
    throw new Error('LinuxDO authentication configuration is unavailable')
  }

  return genericOAuth({
    config: [
      {
        providerId: 'linuxdo',
        clientId: provider.clientId,
        clientSecret: provider.clientSecret,
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

function buildEmailClient(
	env: Env,
	config: EmailRuntimeConfig,
	systemEmail: string
): EmailClients['simple'] {
  if (!config.enabled || !config.provider) {
    return {
      send: async (): Promise<void> => {
        throw new EmailError('EMAIL_DISABLED')
      }
    }
  }
  return createEmailClients({
    provider: config.provider,
    resendApiKey: config.resendApiKey,
    appName: env.APP_NAME,
    sender: systemEmail,
    sendEmailBinding: env.SEND_EMAIL
  }).simple
}

function buildSocialProviders(config: AuthenticationRuntimeConfig): AuthSocialProvidersConfig {
  const providers: Exclude<AuthSocialProvidersConfig, undefined> = {}
  if (config.providers.google.enabled) {
    if (!config.providers.google.clientId || !config.providers.google.clientSecret) {
      throw new Error('Google authentication configuration is unavailable')
    }
    providers.google = {
      clientId: config.providers.google.clientId,
      clientSecret: config.providers.google.clientSecret
    }
  }
  if (config.providers.github.enabled) {
    if (!config.providers.github.clientId || !config.providers.github.clientSecret) {
      throw new Error('GitHub authentication configuration is unavailable')
    }
    providers.github = {
      clientId: config.providers.github.clientId,
      clientSecret: config.providers.github.clientSecret
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
