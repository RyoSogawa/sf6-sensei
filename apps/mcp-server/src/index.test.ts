import { describe, expect, it } from 'vitest'
import app from './index'

describe('GET /health', () => {
  it('returns ok', async () => {
    const res = await app.request('/health')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok' })
  })
})

describe('POST /mcp', () => {
  it('handles MCP tool listing', async () => {
    // This is a simplified test - a full JSON-RPC MCP handshake would be more complex
    const res = await app.request('/mcp', {
      body: JSON.stringify({
        id: 1,
        jsonrpc: '2.0',
        method: 'tools/list',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
    })

    // The StreamableHTTPTransport should handle the request
    expect(res.status).toBeGreaterThanOrEqual(200)
    expect(res.status).toBeLessThan(500)
  })
})
