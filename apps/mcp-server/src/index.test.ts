import { APP_VERSION, GAME_PATCH } from '@repo/core/version'
import { dataVersion } from '@repo/data'
import { describe, expect, it } from 'vitest'
import app from './index'

describe('GET /health', () => {
  it('returns ok with the build and data versions', async () => {
    const res = await app.request('/health')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      dataVersion,
      gamePatch: GAME_PATCH,
      status: 'ok',
      version: APP_VERSION,
    })
  })

  it('reports a data version matching the generated snapshot date', () => {
    expect(dataVersion).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
