# vibe-poster

CLI tool that generates Instagram card news carousels (1080x1440px PNGs) using an AI-powered multi-agent pipeline. Korean-first design.

## Quick Start

**Prerequisites**: [Bun](https://bun.sh) v1.0+, Chrome/Chromium (auto-detected), at least one LLM API key.

```bash
# Install dependencies
bun install

# Set up environment
cp .env.example .env
# Edit .env with your API key(s)

# Generate card news
bun start generate "왜 고양이는 잠을 많이 잘까"

# Or from a research file
bun start generate --input notes.md --slides 8 --model claude-sonnet-4

# List available series themes
bun start series list
```

## CLI Reference

### `generate [topic]`

Generate card news slides from a topic or markdown file.

| Option | Default | Description |
|---|---|---|
| `[topic]` | - | Topic string (required if no `--input`) |
| `-i, --input <file>` | - | Markdown file with research/notes |
| `-s, --series <name>` | `default` | Series theme name |
| `-n, --slides <count>` | `10` | Number of slides (3-20) |
| `-o, --output <dir>` | `./output` | Output directory |
| `-m, --model <alias>` | env `LLM_MODEL` | LLM model alias or full model ID |

### `series list`

Lists available series themes (scans `src/design-system/series/`).

### `series create <name>`

Creates a new series theme directory with stub `theme.json` and `theme.css`.

## Configuration

All config is via environment variables (see `.env.example`).

### API Keys

| Variable | Provider |
|---|---|
| `ANTHROPIC_API_KEY` | Claude models |
| `OPENAI_API_KEY` | GPT / o-series models |
| `GOOGLE_API_KEY` | Gemini models |

At least one key is required. Multiple keys enable cross-provider model selection.

### General Settings

| Variable | Default | Description |
|---|---|---|
| `LLM_MODEL` | `gpt-5-mini` | Default model alias or raw model ID |
| `LLM_BASE_URL` | - | OpenAI-compatible proxy (LiteLLM, Ollama, vLLM) |
| `CHROME_PATH` | auto-detected | Chrome/Chromium executable path |
| `MAX_QA_LOOPS` | `3` | Max QA review-fix iterations |
| `DEFAULT_SLIDES` | `10` | Default slide count |

### Per-Agent Model Overrides

Each agent can use a different model for cost optimization:

| Variable | Agent | Use case |
|---|---|---|
| `RESEARCHER_MODEL` | Researcher | Cheap model is fine |
| `PLANNER_MODEL` | Content Planner | Medium model |
| `COPY_MODEL` | Copywriter | Needs strong Korean |
| `DESIGNER_MODEL` | Designer | Medium model |
| `DEVELOPER_MODEL` | HTML Developer | Needs strong code gen |
| `QA_MODEL` | QA Reviewer | Medium model |

**Resolution order**: Per-agent env var > CLI `--model` flag > `LLM_MODEL` env var.

### Supported Models

16 pre-registered aliases across 3 providers:

| Provider | Aliases |
|---|---|
| Anthropic | `claude-sonnet-4.5`, `claude-sonnet-4`, `claude-opus-4`, `claude-haiku-3.5` |
| OpenAI | `gpt-4o`, `gpt-4o-mini`, `gpt-4.1`, `gpt-4.1-mini`, `gpt-4.1-nano`, `gpt-5-mini`, `o3`, `o3-mini`, `o4-mini` |
| Google | `gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-2.0-flash` |

Unregistered model IDs are auto-detected by name prefix or fall back to OpenAI-compatible. LiteLLM-style prefixes (e.g. `anthropic/claude-sonnet-4`) are supported.

## MCP Server (Agent-Driven Mode)

vibe-poster can run as an **MCP server** where the connected LLM agent (Claude, GPT, etc.) **is the brain**. The agent does all creative work — research, planning, copywriting, design, HTML coding — and the server handles only non-AI operations: validation, file I/O, and PNG rendering.

**No API keys needed.** The LLM agent calling the tools IS the LLM.

### MCP Tools

| Tool | Description |
|---|---|
| `save_pipeline_data` | Validate & save stage output (research, plan, copy, design JSON) |
| `build_slides` | Validate HTML slides against design rules, wrap with tokens, save to disk |
| `render_pngs` | Render HTML slides to 1080×1440px PNGs via headless Chrome (auto-generates presentation) |
| `generate_presentation` | Generate a standalone presentation.html viewer from a slides directory |
| `list_series` | List available series themes |
| `get_pattern_catalog` | Get all 28 layout patterns with structure hints |

### MCP Prompts

| Prompt | Description |
|---|---|
| `pipeline_overview` | Full pipeline guide with JSON schemas for all 6 stages |
| `html_developer_guide` | Detailed HTML/CSS rules for building slides |

### MCP Resources

| Resource | Description |
|---|---|
| `vibe-poster://patterns` | Layout pattern catalog (JSON) |
| `vibe-poster://design-tokens` | CSS custom properties |
| `vibe-poster://base-styles` | Base CSS reset and utilities |
| `vibe-poster://pattern-list` | Compact pattern list for prompts |

### Setup for Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "vibe-poster": {
      "command": "bun",
      "args": ["src/mcp-server.ts"],
      "cwd": "/path/to/vibe_image_poster"
    }
  }
}
```

### Setup for Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "vibe-poster": {
      "command": "bun",
      "args": ["src/mcp-server.ts"],
      "cwd": "/path/to/vibe_image_poster"
    }
  }
}
```

### Run standalone

```bash
bun run mcp
```

The server communicates over stdio. An MCP client must connect — running directly in a terminal will appear to hang (expected).

## Architecture

### Pipeline Flow

```
Topic/File -> Research -> Plan -> Copy -> Design -> HTML Build -> Auto-Validate -> QA Review -> PNG Export -> Presentation
                                                                                      |
                                                                          (fix loop, up to N iterations)
```

### Agents

| Agent | Responsibility | Key Constraint |
|---|---|---|
| **Researcher** | Gathers facts, stats, quotes, audience, keywords | Structured JSON output |
| **Planner** | Plans slide structure with emotional curve (empathy -> transition -> evidence -> action) | Emotion temperature 1-5 per slide |
| **Copywriter** | Writes Korean copy per slide | Strict char limits: heading 15, body 80/para, CTA 30 |
| **Designer** | Selects layout patterns, defines color palette | Chooses from 28 pattern catalog |
| **Developer** | Produces standalone HTML/CSS per slide | 1080x1440px, all CSS inline, no external deps, min 28px font |
| **QA Reviewer** | Read-only review for factual/layout/design issues | Returns pass or needs_revision verdict |

### Design Constraints

- **Standalone HTML**: Every slide is a complete HTML document. No CDN links, no external images, no JavaScript. Only CSS shapes, gradients, and emoji.
- **Korean-first**: `lang="ko"`, `word-break: keep-all`, Korean font stack (Pretendard, Noto Sans KR).
- **28 layout patterns**: Defined in `src/design-system/shared/patterns.ts`. Categories: information, procedure, comparison, data, emphasis, code, mixed, intro.
- **Design tokens**: CSS custom properties in `src/design-system/shared/design-tokens.css`. Series themes override tokens via `theme.css`.

## Output Structure

Each generation creates a timestamped directory:

```
output/
  2026-02-27_topic-slug/
    research.json       # Structured research data
    research.md         # Human-readable research summary
    plan.json           # Slide plan with emotional curve
    copy.json           # Copy for each slide
    design-brief.json   # Color palette and layout patterns
    qa-report.json      # QA review results
    presentation.html   # Interactive carousel viewer (HTML↔PNG toggle)
    slides/
      slide-01.html     # Standalone HTML (viewable in browser)
      slide-01.png      # Rendered 1080x1440 PNG
      slide-02.html
      slide-02.png
      ...
```

### Presentation Viewer

`presentation.html` is a standalone, zero-dependency HTML file that lets you view all slides in a carousel:

- **Arrow keys / Space** — navigate between slides
- **T** — toggle between live HTML (iframe) and rendered PNG views
- **F** — fullscreen
- **Swipe** — touch navigation on mobile
- Thumbnail strip at the bottom for quick jumping

Generated automatically after PNG rendering (both CLI and MCP). Can also be triggered independently via the `generate_presentation` MCP tool.

## Development

### Scripts

```bash
bun test          # Run tests
bun run typecheck # TypeScript type checking
bun run lint      # Biome linter
bun run lint:fix  # Auto-fix lint issues
bun run format    # Check formatting
bun run format:fix # Auto-fix formatting
```

### Project Structure

```
src/
  index.ts                    # CLI entry point (Commander)
  mcp-server.ts               # MCP server entry point (for 3rd-party LLM agents)
  config.ts                   # Env-based config with Zod validation
  agents/
    base-agent.ts             # Abstract base (provider-agnostic execution)
    researcher.ts             # Research agent
    contents-marketer.ts      # Plan + Copy agents
    designer.ts               # Design brief agent
    developer.ts              # HTML generation agent
    qa-reviewer.ts            # QA review agent
  pipeline/
    orchestrator.ts           # Runs all stages sequentially
    context.ts                # Mutable pipeline state
    types.ts                  # Zod schemas for all pipeline data
  llm/
    models.ts                 # Model registry (16 models, 3 providers)
    provider.ts               # Provider abstraction + factory
    providers/                # Anthropic, OpenAI, Google implementations
  design-system/
    shared/
      design-tokens.css       # CSS custom properties
      base-styles.css         # Reset + utility classes
      patterns.ts             # 28 layout pattern definitions
    series/                   # Theme directories
  renderer/
    html-builder.ts           # Wraps partial HTML into full documents
    png-exporter.ts           # Puppeteer-based HTML-to-PNG
    presentation-builder.ts   # Generates interactive carousel viewer
    templates/                # Fallback templates (cover, body, cta)
  validation/
    rules.ts                  # Canonical rule definitions
    slide-validator.ts        # Programmatic HTML checks
  utils/
    file.ts                   # File I/O helpers, slugify
    paths.ts                  # Path resolution
    logger.ts                 # Colored terminal logger
tests/                        # Bun test suite (115 tests)
  renderer/
    html-builder.test.ts      # quickValidateHtml, buildSlideHtml
    presentation-builder.test.ts # Carousel generation, PNG toggle, navigation
  pipeline/
    types.test.ts             # Zod schema validation for all pipeline stages
    context.test.ts           # Pipeline state management
  validation/
    slide-validator.test.ts   # HTML validation rules
  design-system/
    patterns.test.ts          # Pattern catalog integrity
  utils/
    file.test.ts              # slugify, getOutputDir
  config/
    config.test.ts            # Env-based config loading
  llm/
    models.test.ts            # Model registry and resolution
    provider.test.ts          # Provider API key handling
```

### Adding a New Layout Pattern

1. Add the pattern definition to `src/design-system/shared/patterns.ts`
2. Include: `id`, `category`, `name`, `description`, `suitableFor` (roles), `structureHint` (HTML guide for the developer agent)
3. The designer agent will automatically include it in available options

### Adding a New Agent

1. Create a new file in `src/agents/` extending `BaseAgent<TOutput>`
2. Implement: `name`, `description`, `getSystemPrompt()`, `buildUserMessage(ctx)`, `parseResponse(text)`
3. Define output schema in `src/pipeline/types.ts`
4. Wire it into `src/pipeline/orchestrator.ts`
5. Optionally add a per-agent model override env var in `src/config.ts`

## Series Themes

A series theme customizes the visual identity of generated slides.

```bash
# Create a new theme
bun start series create my-brand

# Use it
bun start generate "topic" --series my-brand
```

This creates `src/design-system/series/my-brand/` with:
- `theme.json` - Metadata (name, description, author)
- `theme.css` - CSS custom property overrides (empty by default)

Override any design token in `theme.css` to customize colors, typography, spacing, etc. See `src/design-system/shared/design-tokens.css` for available tokens.
