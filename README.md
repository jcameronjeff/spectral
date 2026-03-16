# Spectral

**Reverse-engineer any website's design DNA.**

Spectral analyzes a live website and extracts its complete design system — tokens, components, layouts, and sitemap — into structured, reusable formats.

## What it extracts

- **Design Tokens** — colors (with auto-naming), typography scale, spacing scale, shadows, borders, radii, breakpoints, z-indices
- **Components** — buttons, cards, navs, modals, forms, tables, heroes, and 12+ more types with variant detection
- **Layouts** — grid/flex structures, page templates, structural DOM trees
- **Sitemap** — BFS crawl with component instance mapping per page

## Output formats

- **Markdown** — beautiful `DESIGN-SYSTEM.md` report with visual scales and grouped tokens
- **JSON** — structured data for programmatic use (`design-system.json`, `tokens.json`, `components.json`, `sitemap.json`)
- **W3C Design Tokens** — `design-tokens.json` in the Design Token Community Group format (Figma-compatible)

## Install

```bash
npm install
npx playwright install chromium
```

## Usage

```bash
# Analyze a website
npx tsx src/cli.ts https://example.com

# With options
npx tsx src/cli.ts https://example.com \
  --max-pages 50 \
  --depth 4 \
  --format both \
  --output ./my-output

# Show browser window
npx tsx src/cli.ts https://example.com --no-headless
```

### Options

| Flag | Default | Description |
|------|---------|-------------|
| `-p, --max-pages <n>` | `20` | Max pages to crawl |
| `-d, --depth <n>` | `3` | Max crawl depth |
| `--no-sitemap` | — | Skip sitemap crawling |
| `--screenshots` | — | Capture page screenshots |
| `-f, --format <type>` | `both` | `json`, `markdown`, or `both` |
| `-o, --output <dir>` | `./spectral-output` | Output directory |
| `--no-headless` | — | Show browser window |
| `-t, --timeout <ms>` | `30000` | Page timeout |

## Claude Code Plugin

Spectral includes a Claude Code skill. Add the project to your skills directory and use:

```
/spectral https://example.com
```

## Architecture

```
src/
├── cli.ts                  # CLI entry point
├── index.ts                # Main orchestrator
├── types.ts                # All type definitions
├── crawler.ts              # BFS site crawler
├── extractors/
│   ├── tokens.ts           # Design token extraction
│   ├── components.ts       # Component pattern detection
│   └── layouts.ts          # Layout analysis
├── analyzers/
│   ├── color.ts            # Color naming (Tailwind-style)
│   └── spacing.ts          # Spacing scale detection
├── reporters/
│   ├── json.ts             # JSON output
│   ├── markdown.ts         # Markdown report
│   └── figma.ts            # W3C Design Token format
└── utils/
    └── browser.ts          # Playwright browser management
```

## License

MIT
