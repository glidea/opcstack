import type { ListAdminUsersResponseItem } from '$apiContract/users'

export function formatAdminUserIdentity(user: ListAdminUsersResponseItem): string {
	const name: string = user.name.trim()
	return name === '' ? user.email : `${name} · ${user.email}`
}

export function findAdminUserById(
	users: ListAdminUsersResponseItem[],
	userId: string
): ListAdminUsersResponseItem | null {
	return users.find((user: ListAdminUsersResponseItem): boolean => user.id === userId) ?? null
}
