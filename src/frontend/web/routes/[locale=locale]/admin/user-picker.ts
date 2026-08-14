import type { ListUsersResponseItem } from '$apiContract/users'

export function formatAdminUserIdentity(
	user: Pick<ListUsersResponseItem, 'name' | 'email'>
): string {
	const name: string = user.name.trim()
	return name === '' || name === user.email ? user.email : `${name} · ${user.email}`
}

export function findAdminUserById(
	users: ListUsersResponseItem[],
	userId: string
): ListUsersResponseItem | null {
	return users.find((user: ListUsersResponseItem): boolean => user.id === userId) ?? null
}
