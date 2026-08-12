import { eq } from 'drizzle-orm'
import type { MetaDb } from '../db'
import { user } from '../db/schema.auth'

export type Administrator = {
	id: string
	email: string
}

export async function getAdministrator(db: MetaDb): Promise<Administrator> {
	const administrator: Administrator | undefined = await db.query.user.findFirst({
		columns: { id: true, email: true },
		where: eq(user.role, 'admin')
	})
	if (!administrator) {
		throw new Error('ADMINISTRATOR_NOT_INITIALIZED')
	}
	return administrator
}

export async function isAdministrator(db: MetaDb, userId: string): Promise<boolean> {
	const administrator: Administrator | undefined = await db.query.user.findFirst({
		columns: { id: true, email: true },
		where: eq(user.role, 'admin')
	})
	return administrator?.id === userId
}
