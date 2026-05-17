# AGENTS.md

## Project Overview
Copilot-for-Cursor is a proxy that bridges GitHub Copilot API to Cursor IDE. It translates Anthropic-format requests (from Cursor) into OpenAI-format requests, handles the Responses API for GPT-5.x models, and provides auto-compaction for long conversations.

**Architecture:** `Cursor → (HTTPS tunnel) → proxy-router (:4142) → copilot-api (:4141) → GitHub Copilot`

## Key Files & Responsibilities
| File | Purpose |
|------|---------|
| `start.ts` | Entrypoint — spawns `npx @jeffreycao/copilot-api@latest`, imports `proxy-router`, handles `--max` flag |
| `proxy-router.ts` | Bun.serve HTTP server — routing, dashboard API, auth enforcement, model list prefixing |
| `anthropic-transforms.ts` | Converts Anthropic → OpenAI: `system` field, `tool_use`→`tool_calls`, `tool_result`→`tool` role |
| `responses-bridge.ts` | Chat Completions → Responses API bridge for GPT-5.x models |
| `responses-converters.ts` | Converts Responses API output back to Chat Completions (sync & SSE streaming) |
| `model-routing.ts` | `needsResponsesAPI(model)` — regex to detect GPT-5.2+, o-series, goldeneye models |
| `max-mode.ts` | Context compaction: soft (80%) with `--max`, hard (95%) safety net always-on |
| `auth-config.ts` | API key generation/validation (`cpk-*`), stored in `~/.copilot-proxy/auth.json` |
| `upstream-auth.ts` | Reads/writes copilot-api keys under `~/.local/share/copilot-api/config.json` (override data dir with `COPILOT_API_HOME`) |
| `stream-proxy.ts` | SSE passthrough with usage extraction from streaming chunks |
| `tunnel.ts` | Cloudflared/ngrok/bore auto-download & management |
| `usage-db.ts` | Debounced persistence of request logs and usage aggregates to `usage.json`; getters for dashboard/API stats |
| `debug-logger.ts` | Console logging of incoming vs transformed chat payloads (`logIncomingRequest`, `logTransformedRequest`) |

## Developer Commands
```bash
bun run dev                          # Start both services (`dev` runs `start.ts`)
bun run dev --max                    # Aggressive 80% compaction (same as `bun run start.ts --max`)
bun run build                        # Compile to `dist/start.js` (Node target)
bun run start                        # Run compiled entrypoint (after `build`)
bun test anthropic-transforms.test.ts # Tests via Bun runner (no npm `test` script)
npx copilot-for-cursor               # Published npm package CLI (`package.json` `bin`)
```

## Code Patterns & Conventions

### Model Prefix Handling
All models exposed to Cursor use a `cus-` prefix. The proxy strips this before forwarding:
```typescript
// proxy-router.ts:323-325
if (json.model && json.model.startsWith(PREFIX)) {
    targetModel = json.model.slice(PREFIX.length);
    json.model = targetModel;
}
```

### Anthropic → OpenAI Transform Flow
`normalizeRequest()` chains transforms in order: `transformAnthropicFields → transformTools → transformToolChoice → transformMessages`. Images in Claude requests become `[Image Omitted]` placeholders.

### Responses API Routing
Models matching `needsResponsesAPI()` route through `handleResponsesAPIBridge()` which:
1. Converts messages to `input` array format
2. Sends to `/v1/responses` endpoint
3. Converts response back via `responses-converters.ts`

### Config File Locations
- Proxy auth: `~/.copilot-proxy/auth.json`
- Upstream keys: `~/.local/share/copilot-api/config.json` (default; `COPILOT_API_HOME` overrides the data directory)
- Usage DB: `~/.copilot-proxy/usage.json` (set `DATA_DIR` to change the directory)
- Cloudflared binary: `~/.copilot-proxy/bin/`

### Security: Auth Gate Pattern
API key enforcement uses deny-by-default for proxied routes (see `proxy-router.ts:286-311`). `OPTIONS`, entries in `publicPaths`, and `/api/*` (dashboard API) bypass the gate.

## Testing
Tests use Bun's built-in test framework (`bun:test`). See `anthropic-transforms.test.ts` for examples:
```bash
bun test anthropic-transforms.test.ts
```
Tests cover base64 image stripping in tool results — a regression guard for the 222K token bug.

## Adding New Model Support
1. If the model uses Responses API, add pattern to `model-routing.ts` regex
2. Token limits are auto-fetched from upstream; fallback defaults in `DEFAULT_LIMITS` (`max-mode.ts`, line 26)

