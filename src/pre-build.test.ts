import { describe } from 'vitest'
import { runCases, type TestCase } from './testing/bdd'

type CloudflareZone = {
	id: string
	name: string
}

type PreBuildModule = {
	resolveCloudflareHost(rawDomain: string): string
	selectCloudflareZone(zones: CloudflareZone[], host: string): CloudflareZone | undefined
}

const preBuildPath: string = '../pre-build.mjs'
const preBuild: PreBuildModule = (await import(preBuildPath)) as PreBuildModule

describe('resolveCloudflareHost', () => {
	type GivenDetail = Record<string, never>
	type WhenDetail = {
		rawDomain: string
	}
	type ThenExpected = {
		host: string
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'normalizes domain URL',
			given: 'a configured app domain with scheme',
			when: 'resolving Cloudflare host',
			then: 'returns lowercase hostname',
			givenDetail: {},
			whenDetail: {
				rawDomain: 'https://App.Example.com/'
			},
			thenExpected: {
				host: 'app.example.com'
			}
		}
	]

	runCases(cases, (_given: GivenDetail, when: WhenDetail): ThenExpected => {
		return {
			host: preBuild.resolveCloudflareHost(when.rawDomain)
		}
	})
})

describe('selectCloudflareZone', () => {
	type GivenDetail = {
		zones: CloudflareZone[]
	}
	type WhenDetail = {
		host: string
	}
	type ThenExpected = {
		zoneName: string
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'matches apex zone',
			given: 'an apex app domain',
			when: 'selecting zone',
			then: 'returns the same zone',
			givenDetail: {
				zones: [{ id: 'z1', name: 'example.com' }]
			},
			whenDetail: {
				host: 'example.com'
			},
			thenExpected: {
				zoneName: 'example.com'
			}
		},
		{
			scenario: 'matches parent zone',
			given: 'a subdomain app domain',
			when: 'selecting zone',
			then: 'returns its parent zone',
			givenDetail: {
				zones: [{ id: 'z1', name: 'example.com' }]
			},
			whenDetail: {
				host: 'app.example.com'
			},
			thenExpected: {
				zoneName: 'example.com'
			}
		},
		{
			scenario: 'matches longest parent zone',
			given: 'multiple matching zones',
			when: 'selecting zone',
			then: 'returns the most specific zone',
			givenDetail: {
				zones: [
					{ id: 'z1', name: 'example.com' },
					{ id: 'z2', name: 'dev.example.com' }
				]
			},
			whenDetail: {
				host: 'api.dev.example.com'
			},
			thenExpected: {
				zoneName: 'dev.example.com'
			}
		},
		{
			scenario: 'ignores unrelated zone',
			given: 'no matching zone',
			when: 'selecting zone',
			then: 'returns empty name',
			givenDetail: {
				zones: [{ id: 'z1', name: 'example.com' }]
			},
			whenDetail: {
				host: 'app.other.com'
			},
			thenExpected: {
				zoneName: ''
			}
		}
	]

	runCases(cases, (given: GivenDetail, when: WhenDetail): ThenExpected => {
		const zone: CloudflareZone | undefined = preBuild.selectCloudflareZone(given.zones, when.host)
		return {
			zoneName: zone?.name ?? ''
		}
	})
})
