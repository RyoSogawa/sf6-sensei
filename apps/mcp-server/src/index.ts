import { Hono } from 'hono'

const app = new Hono()

app.get('/health', (c) => c.json({ status: 'ok' }))

// MCP エンドポイントは後続で実装する（packages/core のツールスキーマを使用）。
// 詳細は docs/mcp-tools.md を参照。

export default app
