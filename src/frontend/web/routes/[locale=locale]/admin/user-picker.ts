import type { ListUsersResponseItem } from '$apiContract/users'

export function formatAdminUserIdentity(user: ListUsersResponseItem): string {
	const name: string = user.name.trim()
	return name === '' ? user.email : `${name} · ${user.email}`
}

export function findAdminUserById(
	users: ListUsersResponseItem[],
	userId: string
): ListUsersResponseItem | null {
	return users.find((user: ListUsersResponseItem): boolean => user.id === userId) ?? null
}
