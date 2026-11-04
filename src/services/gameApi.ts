import type { GameId } from '../data/games'
import { ApiError } from './apiError'
export { ApiError } from './apiError'
import { useWinveroStore } from '../store/useWinveroStore'

export interface ServerRound {
  id: string
  gameId: GameId
  status: 'active' | 'settled'
  stake: number
  payout: number
  multiplier: number
  options: Record<string, unknown>
  state: Record<string, unknown> | null
  result: Record<string, unknown> | null
  fair: { algorithm:string; serverSeedHash:string; clientSeed:string; nonce:number; cursor:number; serverSeed:string|null } | null
  createdAt: string
  settledAt: string | null
  balance: number
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const csrfToken=useWinveroStore.getState().csrfToken
  const response = await fetch(path, {
    ...init,
    credentials:'include',
    headers: { 'content-type': 'application/json', ...(init?.method&&init.method!=='GET'&&csrfToken?{'x-csrf-token':csrfToken}:{}), ...init?.headers },
  })
  const body = await response.json().catch(() => ({})) as { error?: string }
  if(response.status===401)useWinveroStore.getState().clearSession()
  if (!response.ok) throw new ApiError(body.error || 'Le moteur de jeu ne répond pas',response.status)
  return body as T
}

export async function startGameRound(gameId: GameId, stake: number, options: Record<string, unknown> = {}) {
  const committed=await request<ServerRound>('/api/game-rounds', {
    method: 'POST',
    body: JSON.stringify({ requestId: crypto.randomUUID(), gameId, stake, options, clientSeed:'winvero-browser' }),
  })
  const actions=committed.state?.availableActions
  if(Array.isArray(actions)&&actions.includes('resolve'))return actOnGameRound(committed.id,'resolve')
  return committed
}

export async function actOnGameRound(roundId: string, action: string, extra: Record<string, unknown> = {}) {
  return request<ServerRound>(`/api/game-rounds/${roundId}/actions`, {
    method: 'POST',
    body: JSON.stringify({ action, ...extra }),
  })
}

export async function getGameRound(roundId: string) {
  return request<ServerRound>(`/api/game-rounds/${roundId}`)
}

export async function getGameRules(){return request<Record<GameId,Record<string,unknown>>>('/api/game-rules')}
