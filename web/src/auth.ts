export type Account = { id: string; email: string; displayName: string }

export async function accountRequest<T>(action: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/auth/${action}`, {
    method: body === undefined ? 'GET' : 'POST',
    credentials: 'same-origin',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json', 'X-Battleship-Request': '1' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (action === 'me' && response.status === 401) return null as T
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new Error(data?.message ?? 'Account server unavailable. Start Battleship.Server and try again.')
  return data as T
}
