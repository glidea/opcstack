import { describe, expect, it } from 'vitest'
import {
	buildDnsCnameRecordPayload,
	selectDnsCnameRecord
} from './prepare-cloudflare.mjs'
import { resolveAppCnCnameTarget } from './prepare-public.mjs'

describe('prepare cloudflare dns config', () => {
	it('normalizes app cn cname target', () => {
		const env = {
			APP_CN_CNAME_TARGET: 'https://preferred.example.com/'
		}

		resolveAppCnCnameTarget(env)

		expect({
			target: env.APP_CN_CNAME_TARGET
		}).toEqual({
			target: 'preferred.example.com'
		})
	})

	it('builds unproxied cname payload', () => {
		const payload = buildDnsCnameRecordPayload('cn.example.com', 'preferred.example.com')

		expect({
			payload
		}).toEqual({
			payload: {
				type: 'CNAME',
				name: 'cn.example.com',
				content: 'preferred.example.com',
				ttl: 1,
				proxied: false
			}
		})
	})

	it('selects no cname record when none exists', () => {
		const record = selectDnsCnameRecord([], 'cn.example.com')

		expect({
			record
		}).toEqual({
			record: null
		})
	})

	it('selects the existing cname record', () => {
		const record = selectDnsCnameRecord(
			[
				{
					id: 'record-id',
					type: 'CNAME',
					name: 'cn.example.com',
					content: 'old.example.com'
				}
			],
			'cn.example.com'
		)

		expect({
			record
		}).toEqual({
			record: {
				id: 'record-id',
				type: 'CNAME',
				name: 'cn.example.com',
				content: 'old.example.com'
			}
		})
	})

	it('rejects duplicated dns records', () => {
		expect(() => {
			selectDnsCnameRecord(
				[
					{ id: 'a', type: 'CNAME', name: 'cn.example.com' },
					{ id: 'b', type: 'CNAME', name: 'cn.example.com' }
				],
				'cn.example.com'
			)
		}).toThrow('APP_CN_DOMAIN_DNS_RECORD_DUPLICATED')
	})

	it('rejects non cname dns record', () => {
		expect(() => {
			selectDnsCnameRecord(
				[
					{
						id: 'record-id',
						type: 'A',
						name: 'cn.example.com',
						content: '192.0.2.1'
					}
				],
				'cn.example.com'
			)
		}).toThrow('APP_CN_DOMAIN_DNS_RECORD_TYPE_INVALID')
	})
})
