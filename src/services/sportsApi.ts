export type SportsMatchState = 'live' | 'finished' | 'upcoming'

export interface SportsMatch {
  id: string
  league: string
  home: string
  away: string
  date: string
  time: string
  status: string
  state: SportsMatchState
  homeScore: number | null
  awayScore: number | null
}

interface SportsDbEvent {
  idEvent: string
  strLeague: string | null
  strHomeTeam: string | null
  strAwayTeam: string | null
  dateEvent: string | null
  strTime: string | null
  strStatus: string | null
  intHomeScore: string | null
  intAwayScore: string | null
}

const API_BASE = 'https://www.thesportsdb.com/api/v1/json/123'
const finishedStatuses = new Set(['FT', 'AET', 'PEN', 'AP'])
const liveStatuses = new Set(['LIVE', '1H', '2H', 'HT', 'ET', 'BT', 'P'])

function isoDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseScore(value: string | null) {
  if (value === null || value === '') return null
  const score = Number(value)
  return Number.isFinite(score) ? score : null
}

function normalize(event: SportsDbEvent): SportsMatch {
  const status = event.strStatus?.toUpperCase() || 'NS'
  const state: SportsMatchState = liveStatuses.has(status) ? 'live' : finishedStatuses.has(status) ? 'finished' : 'upcoming'
  return {
    id: event.idEvent,
    league: event.strLeague || 'Compétition internationale',
    home: event.strHomeTeam || 'Équipe à confirmer',
    away: event.strAwayTeam || 'Équipe à confirmer',
    date: event.dateEvent || '',
    time: event.strTime?.slice(0, 5) || '--:--',
    status,
    state,
    homeScore: parseScore(event.intHomeScore),
    awayScore: parseScore(event.intAwayScore),
  }
}

async function eventsForDate(date: string, signal?: AbortSignal) {
  const response = await fetch(`${API_BASE}/eventsday.php?d=${date}&s=Soccer`, { signal })
  if (!response.ok) throw new Error(`TheSportsDB a répondu ${response.status}`)
  const payload = await response.json() as { events: SportsDbEvent[] | null }
  return (payload.events ?? []).map(normalize)
}

export async function fetchSportsWindow(signal?: AbortSignal) {
  const today = new Date()
  const previous = new Date(today)
  const next = new Date(today)
  previous.setDate(today.getDate() - 1)
  next.setDate(today.getDate() + 1)
  const results = await Promise.all([isoDate(previous), isoDate(today), isoDate(next)].map((date) => eventsForDate(date, signal)))
  const unique = new Map(results.flat().map((match) => [match.id, match]))
  return [...unique.values()].sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`))
}
