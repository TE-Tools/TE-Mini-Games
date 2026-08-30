/**
 * Prüft die Verdrahtung zum Server: Ein Tippfehler im Funktionsnamen oder bei
 * einem Parameter würde online sonst erst im Spiel auffallen.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const rpc = vi.fn()
const removeChannel = vi.fn()
interface ChangeFilter {
  event: string
  schema: string
  table: string
  filter: string
}

const channel = {
  on: vi.fn((_event: string, _filter: ChangeFilter, _cb: () => void) => channel),
  subscribe: vi.fn(() => channel),
}

vi.mock('@/database/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    rpc: (...args: unknown[]) => rpc(...args),
    channel: () => channel,
    removeChannel: (...args: unknown[]) => removeChannel(...args),
  },
}))

const online = await import('@/services/schuetzenrundeOnline')

beforeEach(() => {
  rpc.mockReset()
  rpc.mockResolvedValue({ data: null, error: null })
  channel.on.mockClear()
  channel.subscribe.mockClear()
  removeChannel.mockClear()
})

describe('Schützenrunde online – Aufrufe', () => {
  it('eröffnet eine Runde mit allen Einstellungen', async () => {
    rpc.mockResolvedValue({ data: { match_id: 'm1', code: 'ABCDE' }, error: null })
    const created = await online.createOnlineMatch({ size: 12, event: true, zugId: 'fahnen' })
    expect(created.code).toBe('ABCDE')
    expect(rpc).toHaveBeenCalledWith('sr_create_match', {
      p_size: 12,
      p_event: true,
      p_zug: 'fahnen',
      p_name: null,
    })
  })

  it('schreibt den Code beim Beitreten groß und ohne Leerzeichen', async () => {
    rpc.mockResolvedValue({ data: { match_id: 'm1', code: 'ABCDE', seat: 2 }, error: null })
    await online.joinOnlineMatch('  abcde ')
    expect(rpc).toHaveBeenCalledWith('sr_join_match', { p_code: 'ABCDE', p_name: null })
  })

  it('gibt die Nachtaktion vollständig weiter', async () => {
    await online.sendNightAction('m1', { targetSeat: 3, useShot: true, spreadRumour: false })
    expect(rpc).toHaveBeenCalledWith('sr_night_action', {
      p_match: 'm1',
      p_target: 3,
      p_use_shot: true,
      p_rumour: false,
    })
  })

  it('macht aus einer fehlenden Auswahl eine Enthaltung', async () => {
    await online.sendNightAction('m1', {})
    expect(rpc).toHaveBeenCalledWith('sr_night_action', {
      p_match: 'm1',
      p_target: null,
      p_use_shot: false,
      p_rumour: false,
    })
    await online.sendVote('m1', null)
    expect(rpc).toHaveBeenCalledWith('sr_vote', { p_match: 'm1', p_target: null })
  })

  it('nutzt für jede Aktion die passende Server-Funktion', async () => {
    await online.startOnlineMatch('m1')
    await online.leaveOnlineMatch('m1')
    await online.sendReady('m1')
    await online.sendChat('m1', 'Hallo')
    await online.tickOnlineMatch('m1')
    await online.fetchState('m1')
    await online.fetchOpenMatches()
    const names = rpc.mock.calls.map((c) => c[0])
    expect(names).toEqual([
      'sr_start_match',
      'sr_leave_match',
      'sr_ready',
      'sr_say',
      'sr_tick',
      'sr_get_state',
      'sr_my_matches',
    ])
  })

  it('reicht Server-Fehler als lesbaren Satz durch', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'Die Runde ist voll' } })
    await expect(online.joinOnlineMatch('ABCDE')).rejects.toThrow('Die Runde ist voll')
  })

  it('hört auf Spielstand und Chat und meldet sich sauber ab', () => {
    const stop = online.subscribeToMatch('m1', () => {})
    const tables = channel.on.mock.calls.map((c) => c[1].table)
    expect(tables).toEqual(['sr_state', 'sr_messages'])
    for (const call of channel.on.mock.calls) {
      expect(call[1].filter).toBe('match_id=eq.m1')
    }
    expect(channel.subscribe).toHaveBeenCalled()
    stop()
    expect(removeChannel).toHaveBeenCalled()
  })
})
