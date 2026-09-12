# xknow-mcp

[![npm](https://img.shields.io/npm/v/xknow-mcp.svg)](https://www.npmjs.com/package/xknow-mcp)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![MCP](https://img.shields.io/badge/MCP-server-8A2BE2)](https://modelcontextprotocol.io)

An MCP server for the **[XKnow Knowledge Base](https://xknow.org/mcp)** — a curated,
cross-linked body of **SEO, SaaS, and LLM-wiki** knowledge. Give any MCP-capable agent
(Claude, Cursor, Cline, opencode, and others) the ability to **search and cite** it.

- **Local and private.** Runs on your machine over stdio. No server, no account, no API key.
- **Static data.** The free layer is a snapshot of the public XKnow guides, bundled with the
  package. Nothing is fetched at query time.
- **Graph-aware.** Beyond keyword search, `explore_concept` walks the cross-links between
  notes, so an agent can follow a topic instead of getting a flat list.

## Quick start

Add it to your MCP client.

**Claude Desktop** (`claude_desktop_config.json`), **Cursor**, **Cline**, and most clients:

```json
{
  "mcpServers": {
    "xknow": {
      "command": "npx",
      "args": ["-y", "xknow-mcp"]
    }
  }
}
```

**Claude Code**

```bash
claude mcp add xknow -- npx -y xknow-mcp
```

**opencode** (`opencode.json`)

```json
{
  "mcp": {
    "xknow": { "type": "local", "command": ["npx", "-y", "xknow-mcp"], "enabled": true }
  }
}
```

Then ask your agent something like:

> "Use the xknow tools to explain keyword difficulty and cite the source."
> "Search XKnow for SaaS pricing models and summarise the trade-offs."

## Tools

| Tool | What it does |
| --- | --- |
| `search_knowledge` | Ranked search over the knowledge base. Returns titles, snippets, and URLs. |
| `get_page` | Full text of one note by title or slug (preserves `[[wikilinks]]`). |
| `explore_concept` | A note plus its outbound links and backlinks — walks the knowledge graph. |
| `list_topics` | Lists every note grouped by section (`seo`, `saas`, `blog`). |
| `cite` | Returns the canonical citation (title, description, URL) for a note. |

## Two knowledge layers

| Layer | Content | How |
| --- | --- | --- |
| **Free** (default) | The 57 public XKnow guides and blog posts | Bundled snapshot — just `npx -y xknow-mcp` |
| **Full vault** | Your purchased XKnow Knowledge Base (500+ linked notes) | `npx -y xknow-mcp --vault /path/to/SEO-SaaS-Vault` |

The full-vault mode reads a local folder of Markdown notes, so your purchased copy never
leaves your machine. Set it once with the `XKNOW_VAULT` environment variable if you prefer:

```bash
export XKNOW_VAULT="/path/to/SEO-SaaS-Vault"
npx -y xknow-mcp
```

## How it works

`xknow-mcp` is a Node.js stdio server. The free layer is a static JSON snapshot generated
from the public site and bundled in the package (`data/knowledge.json`); search is a small,
dependency-free ranking pass over the bundled notes. Vault mode parses Markdown notes from
a local folder on the fly. No network calls, no vector database, no telemetry.

## Development

```bash
npm install
npm run build:data   # refresh data/knowledge.json from https://xknow.org/mcp/knowledge.json
npm run build        # tsc
npm run smoke        # exercise every tool over a real stdio connection

# also test against a local vault
SMOKE_VAULT=/path/to/SEO-SaaS-Vault npm run smoke
```

## Links

- Product page: https://xknow.org/mcp
- Knowledge base: https://xknow.org/vaults/seo
- Registry: https://registry.modelcontextprotocol.io/servers/io.github.techreone/xknow-mcp
- Source: https://github.com/techreone/xknow-mcp

## License

MIT — see [LICENSE](LICENSE).
