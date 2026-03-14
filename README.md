# @verdaccio/mcp-server

> **⚠️ Experimental:** This project is a work in progress and subject to change. APIs, tool names, and behaviour may change without notice between versions.

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io) server that connects any MCP-compatible AI client to a [Verdaccio](https://verdaccio.org) private npm registry.

> MCP is an open protocol — this server works with **any MCP client**, not just Claude.

API endpoint paths are sourced directly from `@verdaccio/middleware` constants (e.g. `SEARCH_API_ENDPOINTS`, `PACKAGE_API_ENDPOINTS`) so they stay in sync with Verdaccio's own routing definitions.

## Compatible clients

| Client | Config location |
|--------|----------------|
| [Claude Desktop / Claude Code](https://claude.ai) | `~/.claude.json` or workspace `.mcp.json` |
| [Cursor](https://cursor.com) | `.cursor/mcp.json` |
| [Windsurf](https://codeium.com/windsurf) | `~/.codeium/windsurf/mcp_config.json` |
| [VS Code + Copilot](https://code.visualstudio.com) | `.vscode/mcp.json` |
| [Continue.dev](https://continue.dev) | `~/.continue/config.json` |
| Any custom app | [MCP SDK](https://modelcontextprotocol.io/sdks) |

## Installation

```bash
npm install -g @verdaccio/mcp-server

# or run without installing
npx @verdaccio/mcp-server
```

## Using with Claude

### Claude Code (CLI)

The quickest way is via the `claude mcp add` command:

```bash
# Local scope (current project only)
claude mcp add verdaccio -e VERDACCIO_URL=http://your-verdaccio:4873 -- npx @verdaccio/mcp-server

# User scope (all projects)
claude mcp add -s user verdaccio -e VERDACCIO_URL=http://your-verdaccio:4873 -- npx @verdaccio/mcp-server

# With auth token
claude mcp add verdaccio \
  -e VERDACCIO_URL=http://your-verdaccio:4873 \
  -e VERDACCIO_TOKEN=your-token \
  -- npx @verdaccio/mcp-server
```

### Claude Desktop

Add to `~/.claude.json`:

```json
{
  "mcpServers": {
    "verdaccio": {
      "command": "npx",
      "args": ["@verdaccio/mcp-server"],
      "env": {
        "VERDACCIO_URL": "http://your-verdaccio:4873",
        "VERDACCIO_TOKEN": "your-token"
      }
    }
  }
}
```

Restart Claude after adding the config. You can verify the server is connected by asking:

> _"What tools do you have available for Verdaccio?"_

## Tools

### `find_package`

Search for packages in the registry by name or keyword.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | yes | Package name or search term |
| `size` | number | no | Max results to return (1–100, default 20) |

Uses endpoint: `SEARCH_API_ENDPOINTS.search` → `/-/v1/search`

**Example prompt:** _"Find all packages related to authentication in our private registry"_

---

### `get_package`

Get detailed metadata for a specific package — description, author, license, dist-tags, and version history.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `package` | string | yes | Package name, e.g. `my-lib` or `@scope/my-lib` |
| `version` | string | no | Specific version e.g. `1.2.3` (omit for latest) |

Uses endpoint: `PACKAGE_API_ENDPOINTS.get_package_by_version` → `/:package{/:version}`

**Example prompt:** _"What versions of @myorg/ui-components are available?"_

---

### `publish_package`

Publish a package to the registry by name and version. Uses `generatePackageMetadata` from `@verdaccio/test-helper` to generate the full publish payload automatically — no tarball needed.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | yes | Package name, e.g. `my-lib` or `@scope/my-lib` |
| `version` | string | yes | Version to publish, e.g. `1.0.0` |
| `tag` | string | no | Dist-tag to apply (default: `latest`) |

Uses endpoint: `PUBLISH_API_ENDPOINTS.add_package` → `/:package`

**Example prompt:** _"Publish @myorg/ui-components version 2.1.0 to our private registry"_

---

### `login`

Authenticate with username and password. Returns a Bearer token.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `username` | string | yes | Verdaccio username |
| `password` | string | yes | Verdaccio password |

Uses endpoint: `USER_API_ENDPOINTS.add_user` → `/-/user/:org_couchdb_user`

---

### `get_profile`

Get the profile of the currently authenticated user (requires `VERDACCIO_TOKEN`).

Uses endpoint: `PROFILE_API_ENDPOINTS.get_profile` → `/-/npm/v1/user`

---

### `list_tokens`

List all API tokens for the authenticated user.

Uses endpoint: `TOKEN_API_ENDPOINTS.get_tokens` → `/-/npm/v1/tokens`

---

### `create_token`

Create a new API token for the authenticated user.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `password` | string | yes | Current user password |
| `readonly` | boolean | no | Make token read-only (default false) |
| `cidr` | string[] | no | IP ranges to whitelist, e.g. `["10.0.0.0/8"]` |

Uses endpoint: `TOKEN_API_ENDPOINTS.get_tokens` → `/-/npm/v1/tokens` (POST)

---

### `delete_token`

Delete an API token by its key.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tokenKey` | string | yes | Token key identifier (from `list_tokens`) |

Uses endpoint: `TOKEN_API_ENDPOINTS.delete_token` → `/-/npm/v1/tokens/token/:tokenKey`

## Setup

### 1. Install and build

```bash
npm install
npm run build
```

### 2. Configure environment

| Variable | Default | Description |
|----------|---------|-------------|
| `VERDACCIO_URL` | `http://localhost:4873` | Base URL of your Verdaccio instance |
| `VERDACCIO_TOKEN` | — | Bearer token for authenticated registries |

### 3. Add to your MCP client

The server config format is the same across all clients — only the config file location differs (see [Compatible clients](#compatible-clients) above).

```json
{
  "mcpServers": {
    "verdaccio": {
      "command": "npx",
      "args": ["@verdaccio/mcp-server"],
      "env": {
        "VERDACCIO_URL": "http://your-verdaccio:4873",
        "VERDACCIO_TOKEN": "your-token"
      }
    }
  }
}
```

## Development

### Testing locally without publishing

To connect your MCP client to the local source without publishing to npm, point it directly at the local file.

**Option A — compiled (requires `npm run build` after each change):**

```json
{
  "mcpServers": {
    "verdaccio": {
      "command": "node",
      "args": ["/path/to/mcp-server-verdaccio/dist/index.js"],
      "env": {
        "VERDACCIO_URL": "http://localhost:4873"
      }
    }
  }
}
```

**Option B — TypeScript directly via `tsx` (no build step, recommended for dev):**

```json
{
  "mcpServers": {
    "verdaccio": {
      "command": "npx",
      "args": ["tsx", "/path/to/mcp-server-verdaccio/src/index.ts"],
      "env": {
        "VERDACCIO_URL": "http://localhost:4873"
      }
    }
  }
}
```

With option B, just save your changes and restart the MCP client — no build step needed.

### Running standalone

```bash
# Run directly with tsx (no build step)
VERDACCIO_URL=http://localhost:4873 npm run dev

# Build and run compiled output
npm run build
npm start

# Run tests
npm test
npm run test:watch
```

## Stack

- [`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol/typescript-sdk) — MCP server framework
- [`@verdaccio/middleware`](https://github.com/verdaccio/verdaccio) — Verdaccio API endpoint constants
- [`zod`](https://zod.dev) — Tool input schema validation
