import { describe, expect, it } from 'vitest'
import {
	creditBalance,
	creditEntry,
	creditTransaction,
	feedback,
	notificationRead
} from './schema.shard'

describe('schema.shard', () => {
	it('exports tenant-owned tables', () => {
		expect(creditBalance).toBeDefined()
		expect(creditEntry).toBeDefined()
		expect(creditTransaction).toBeDefined()
		expect(feedback).toBeDefined()
		expect(notificationRead).toBeDefined()
	})
})
