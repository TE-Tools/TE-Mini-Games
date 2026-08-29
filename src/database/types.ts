export interface DbProfile {
  id: string
  display_name: string | null
  avatar: string | null
  total_xp: number
  player_level: number
  streak_days: number
  last_played_at: string | null
  created_at: string
  updated_at: string
}

export interface DbGameProgress {
  id: string
  user_id: string
  game_id: string
  current_level: number
  highest_level: number
  total_xp: number
  created_at: string
  updated_at: string
}

export interface DbGameResult {
  id: string
  user_id: string
  game_id: string
  level: number
  score: number
  xp: number
  result_data: Record<string, unknown>
  created_at: string
}

export interface DbPersonalRecord {
  id: string
  user_id: string
  game_id: string
  level: number
  best_score: number
  best_measurement: number | null
  achieved_at: string
}
