import { StreamableHTTPTransport } from '@hono/mcp'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getCharacters } from '@repo/data'
import { Hono } from 'hono'
import { z } from 'zod'
import {
  findPunishImpl,
  getCharacterFrameDataImpl,
  getMoveImpl,
  listCharactersImpl,
  searchMovesImpl,
} from './tools'

const app = new Hono()
const characters = getCharacters()

// Tool input schemas
const categorySchema = z
  .enum([
    'normal',
    'command_normal',
    'special',
    'super_art',
    'critical_art',
    'throw',
    'drive',
    'taunt',
  ])
  .optional()

const getMoveInputSchema = z.object({
  character: z.string().min(1),
  language: z.enum(['ja', 'en']).default('ja'),
  move: z.string().min(1),
})

const getCharacterFrameDataInputSchema = z.object({
  category: categorySchema,
  character: z.string().min(1),
  language: z.enum(['ja', 'en']).default('ja'),
})

const searchMovesInputSchema = z.object({
  category: categorySchema,
  character: z.string().optional().nullable(),
  language: z.enum(['ja', 'en']).default('ja'),
  limit: z.number().int().positive().default(20),
  onBlockMax: z.number().optional().nullable(),
  onBlockMin: z.number().optional().nullable(),
  onHitMax: z.number().optional().nullable(),
  onHitMin: z.number().optional().nullable(),
  properties: z.array(z.string()).optional().nullable(),
  startupMax: z.number().int().optional().nullable(),
  startupMin: z.number().int().optional().nullable(),
})

const findPunishInputSchema = z.object({
  language: z.enum(['ja', 'en']).default('ja'),
  maxStartup: z.number().int().optional().nullable(),
  myCharacter: z.string().min(1),
  onBlock: z.number().int().optional().nullable(),
  opponentCharacter: z.string().optional().nullable(),
  opponentMove: z.string().optional().nullable(),
})

const listCharactersInputSchema = z.object({
  language: z.enum(['ja', 'en']).default('ja'),
})

function textResult(data: unknown) {
  return { content: [{ text: JSON.stringify(data, null, 2), type: 'text' as const }] }
}

// ステートレス運用: リクエストごとに新しい McpServer + transport を生成する。
// SDK の Server は単一 transport にしか connect できないため、共有インスタンスは使えない。
function createMcpServer(): McpServer {
  const mcpServer = new McpServer({ name: 'sf6-frame-data', version: '0.1.0' })

  mcpServer.registerTool(
    'get_move',
    {
      description:
        'Get frame data for a specific move by character and move name/input/alias. Supports Japanese and English queries.',
      inputSchema: getMoveInputSchema,
    },
    (args: unknown) => {
      const p = getMoveInputSchema.parse(args)
      return textResult(getMoveImpl(p.character, p.move, characters, p.language))
    },
  )

  mcpServer.registerTool(
    'get_character_frame_data',
    {
      description:
        'Get all frame data for a character, optionally filtered by move category (normal, special, super_art, critical_art, throw, etc.)',
      inputSchema: getCharacterFrameDataInputSchema,
    },
    (args: unknown) => {
      const p = getCharacterFrameDataInputSchema.parse(args)
      return textResult(getCharacterFrameDataImpl(p.character, p.category, characters, p.language))
    },
  )

  mcpServer.registerTool(
    'search_moves',
    {
      description:
        'Search for moves across all characters (or one character) by criteria such as startup, on-block advantage, properties, etc.',
      inputSchema: searchMovesInputSchema,
    },
    (args: unknown) => {
      const p = searchMovesInputSchema.parse(args)
      return textResult(
        searchMovesImpl(
          p.character,
          p.category,
          p.startupMax,
          p.startupMin,
          p.onBlockMin,
          p.onBlockMax,
          p.onHitMin,
          p.onHitMax,
          p.properties,
          p.limit,
          characters,
          p.language,
        ),
      )
    },
  )

  mcpServer.registerTool(
    'find_punish',
    {
      description:
        'Find punish options for your character after guarding an opponent move. Specify the opponent move or its on-block advantage directly.',
      inputSchema: findPunishInputSchema,
    },
    (args: unknown) => {
      const p = findPunishInputSchema.parse(args)
      return textResult(
        findPunishImpl(
          p.myCharacter,
          p.opponentCharacter,
          p.opponentMove,
          p.onBlock,
          p.maxStartup,
          characters,
          p.language,
        ),
      )
    },
  )

  mcpServer.registerTool(
    'list_characters',
    {
      description: 'List all available characters with their IDs and aliases.',
      inputSchema: listCharactersInputSchema,
    },
    (args: unknown) => {
      const p = listCharactersInputSchema.parse(args)
      return textResult(listCharactersImpl(characters, p.language))
    },
  )

  return mcpServer
}

app.get('/health', (c) => c.json({ status: 'ok' }))

app.all('/mcp', async (c) => {
  const server = createMcpServer()
  const transport = new StreamableHTTPTransport()
  await server.connect(transport)
  return transport.handleRequest(c)
})

export default app
