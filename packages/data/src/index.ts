import type { Character } from '@repo/core'

// 生成データ。apps/scraper が出力する正規化済み JSON をここに取り込む（現状は空）。
export const characters: readonly Character[] = []

// データのスナップショット版（取得日時やゲームバージョンに紐付ける想定）
export const dataVersion = '0.0.0-unreleased'
