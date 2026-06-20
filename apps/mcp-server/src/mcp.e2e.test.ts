import { describe, expect, it } from 'vitest'
import app from './index'

// e2e test that drives the MCP protocol end-to-end via the root (/).
// Detects the regression where a shared McpServer would throw "Already connected" on the 2nd request.

const MCP_HEADERS = {
  accept: 'application/json, text/event-stream',
  'content-type': 'application/json',
}

interface RpcResponse {
  result?: Record<string, unknown>
  error?: { message: string }
}

// Streamable HTTP responds with either plain JSON or SSE (data: {...}). Extract the JSON-RPC payload from either.
function parseRpc(text: string): RpcResponse {
  const trimmed = text.trim()
  if (trimmed.startsWith('{')) {
    return JSON.parse(trimmed) as RpcResponse
  }
  const dataLine = trimmed.split('\n').find((line) => line.startsWith('data:'))
  if (!dataLine) {
    throw new Error(`unexpected MCP response: ${trimmed.slice(0, 200)}`)
  }
  return JSON.parse(dataLine.slice('data:'.length).trim()) as RpcResponse
}

async function mcpRequest(body: unknown, sessionId?: string) {
  const headers: Record<string, string> = { ...MCP_HEADERS }
  if (sessionId) {
    headers['mcp-session-id'] = sessionId
  }
  const res = await app.request('/', { body: JSON.stringify(body), headers, method: 'POST' })
  return {
    rpc: parseRpc(await res.text()),
    sessionId: res.headers.get('mcp-session-id') ?? undefined,
    status: res.status,
  }
}

// Like ChatGPT, start from initialize and use the issued session for subsequent requests.
async function initializeSession(): Promise<string | undefined> {
  const { sessionId } = await mcpRequest({
    id: 1,
    jsonrpc: '2.0',
    method: 'initialize',
    params: {
      capabilities: {},
      clientInfo: { name: 'e2e', version: '1.0.0' },
      protocolVersion: '2025-06-18',
    },
  })
  return sessionId
}

describe('MCP root (/) endpoint (e2e)', () => {
  it('lists all five tools after initialize', async () => {
    const sessionId = await initializeSession()
    const { rpc, status } = await mcpRequest(
      { id: 2, jsonrpc: '2.0', method: 'tools/list' },
      sessionId,
    )

    expect(status).toBe(200)
    const tools = (rpc.result?.tools ?? []) as Array<{ name: string }>
    expect(tools.map((t) => t.name).sort()).toEqual([
      'find_punish',
      'get_character_frame_data',
      'get_move',
      'list_characters',
      'search_moves',
    ])
  })

  it('calls get_move and returns Ryu Hadoken frame data', async () => {
    const sessionId = await initializeSession()
    const { rpc, status } = await mcpRequest(
      {
        id: 3,
        jsonrpc: '2.0',
        method: 'tools/call',
        params: { arguments: { character: 'ryu', move: '236P' }, name: 'get_move' },
      },
      sessionId,
    )

    expect(status).toBe(200)
    const content = (rpc.result?.content ?? []) as Array<{ text: string }>
    expect(content[0]?.text.toLowerCase()).toContain('hadoken')
  })

  it('rejects search_moves with an over-limit value (input cap)', async () => {
    const sessionId = await initializeSession()
    const { rpc } = await mcpRequest(
      {
        id: 5,
        jsonrpc: '2.0',
        method: 'tools/call',
        params: { arguments: { limit: 9999 }, name: 'search_moves' },
      },
      sessionId,
    )

    // limit is .max(200). The SDK returns inputSchema violations as a JSON-RPC error or an isError result.
    const errored =
      rpc.error !== undefined || (rpc.result as { isError?: boolean } | undefined)?.isError === true
    expect(errored).toBe(true)
  })

  it('surfaces a not-found error through a tool call', async () => {
    const sessionId = await initializeSession()
    const { rpc } = await mcpRequest(
      {
        id: 4,
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          arguments: { character: 'definitely-not-a-character', move: '236P' },
          name: 'get_move',
        },
      },
      sessionId,
    )

    const content = (rpc.result?.content ?? []) as Array<{ text: string }>
    expect(content[0]?.text).toContain('not found')
  })
})
