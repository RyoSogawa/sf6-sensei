// SuperCombo (CC-BY-SA) からフレームデータを取得する正攻法クライアント。
// アクセス方針は docs/spec.md「取得の許諾とアクセス方針」を厳守する:
//   - エンドポイントは srk.shib.live/api.php のみ（robots 遵守）
//   - 正直な識別 User-Agent（偽装しない）
//   - 低頻度の手動バッチ + キャッシュ、出典明記 + CC-BY-SA 継承

const API = 'https://srk.shib.live/api.php'
const USER_AGENT =
  'sf6-frame-data-api/0.1 (+https://github.com/RyoSogawa/sf6-frame-data-api) personal-noncommercial'

export interface CargoQueryParams {
  tables: string
  fields: string
  where?: string
  limit?: number
  offset?: number
}

export function buildCargoQueryUrl(params: CargoQueryParams): string {
  const url = new URL(API)
  url.searchParams.set('action', 'cargoquery')
  url.searchParams.set('format', 'json')
  url.searchParams.set('tables', params.tables)
  url.searchParams.set('fields', params.fields)
  if (params.where) {
    url.searchParams.set('where', params.where)
  }
  url.searchParams.set('limit', String(params.limit ?? 500))
  url.searchParams.set('offset', String(params.offset ?? 0))
  return url.toString()
}

export async function cargoQuery(params: CargoQueryParams): Promise<unknown[]> {
  const res = await fetch(buildCargoQueryUrl(params), {
    headers: { 'User-Agent': USER_AGENT },
  })
  if (!res.ok) {
    throw new Error(`cargoquery failed: HTTP ${res.status}`)
  }
  const json = (await res.json()) as { cargoquery?: { title: unknown }[] }
  return (json.cargoquery ?? []).map((row) => row.title)
}

// 取得元の HTML / wiki マークアップ除去（probe で全 2306 行クリーンを確認済み）
export function stripMarkup(value: string): string {
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/'''?/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim()
}
