import { z } from 'zod'

export type Language = 'ja' | 'en'

export type MoveCategory =
  | 'normal'
  | 'command_normal'
  | 'special'
  | 'super_art'
  | 'critical_art'
  | 'throw'
  | 'drive'
  | 'taunt'

export interface LocalizedName {
  ja: string | null
  en: string
}

export interface MoveSource {
  url: string
  license: 'CC-BY-SA'
  fetchedAt: string
}

export interface Move {
  id: string
  characterId: string
  name: LocalizedName
  input: { numpad: string; official: string | null }
  aliases: string[]
  category: MoveCategory
  startup: number | null
  active: string | null
  recovery: number | null
  onBlock: number | null
  onHit: number | null
  cancel: string[]
  properties: string[]
  source: MoveSource
}

export interface Character {
  id: string
  name: LocalizedName
  aliases: string[]
  moves: Move[]
}

// MCP ツール get_move の入力スキーマ（詳細は docs/mcp-tools.md）
export const getMoveInput = z.object({
  character: z.string().min(1),
  language: z.enum(['ja', 'en']).default('ja'),
  move: z.string().min(1),
})

export type GetMoveInput = z.infer<typeof getMoveInput>
