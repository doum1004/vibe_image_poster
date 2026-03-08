# SlideAgile

Generates short-form card news slides (default 1080×1920 PNGs) with a Korean-first design system.

**MCP Server** — Connect any LLM agent (Cursor, Claude Desktop, etc.). The agent does all creative work (research, planning, copywriting, design, HTML coding); SlideAgile handles validation, rendering, and file I/O. **No API keys needed.**

The CLI is available for template re-rendering (applying new copy.json to existing slide templates).

## Quick Start

**Prerequisites**: [Bun](https://bun.sh) v1.0+, Chrome/Chromium (auto-detected).

```bash
bun install
bun run mcp   # Starts stdio server — connect from Cursor or Claude Desktop
```

## Configuration

### User Preferences (persistent)

Set defaults once — they're saved to disk and used automatically on every run.

```bash
slideagile config set author @MyBrand      # bottom-bar branding on every slide
slideagile config set theme MyTheme        # design theme name
slideagile config set output ./my-output   # default output directory
slideagile config set ttsProvider gcp-hd   # default narration TTS provider
slideagile config set ttsVoice en-US-Chirp3-HD-Achernar
slideagile config list                     # show all preferences
slideagile config unset author             # remove a preference
```

Preferences are stored at:
- **Windows**: `%APPDATA%/slideagile/preferences.json`
- **macOS**: `~/Library/Application Support/slideagile/preferences.json`
- **Linux**: `~/.config/slideagile/preferences.json`

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `CHROME_PATH` | auto-detected | Chrome/Chromium executable path |
| `FFMPEG_PATH` | bundled (`ffmpeg-static`) | FFmpeg executable path override for `video build` |
| `DEFAULT_THEME` | `default` | Default theme name |
| `DEFAULT_AUTHOR` | `@SlideForge` | Author / brand shown in the bottom bar of every slide |
| `DEFAULT_TTS_PROVIDER` | `gcp-hd` | Default TTS provider for video narration (`gcp-hd` or `openai`) |
| `DEFAULT_TTS_VOICE` | unset | Default TTS voice ID (provider-specific) |
| `DEFAULT_TTS_LANGUAGE` | `ko-KR` | Default TTS language code for narration |
| `GOOGLE_APPLICATION_CREDENTIALS` | unset | Path to GCP service-account JSON (required for local GCP TTS) |
| `GOOGLE_CLOUD_PROJECT` | unset | GCP project ID (recommended for local GCP TTS) |

MCP transport variables (`MCP_TRANSPORT`, `MCP_HOST`, `MCP_PORT`, etc.) are documented in the [Transport Modes](#transport-modes) section.

**Resolution order** (for theme): CLI `--theme` flag > `DEFAULT_THEME` env var > user preference > `"default"`

**Resolution order** (for author): `DEFAULT_AUTHOR` env var > `author` user preference > `"@SlideForge"`

**Resolution order** (for TTS provider): `DEFAULT_TTS_PROVIDER` env var > `ttsProvider` user preference > `"gcp-hd"`

**Resolution order** (for TTS voice): `DEFAULT_TTS_VOICE` env var > `ttsVoice` user preference

**Resolution order** (for TTS language): `DEFAULT_TTS_LANGUAGE` env var > `ttsLanguage` user preference > `"ko-KR"`

## MCP Server

SlideAgile runs as an **MCP server** where the connected LLM agent (Claude, GPT, etc.) **is the brain**. The agent does all creative work — research, planning, copywriting, design, HTML coding — and the server handles only non-AI operations: validation, file I/O, and PNG rendering.

### Transport Modes

The server supports three transport modes. Choose the one that fits your setup:

| Mode | Protocol | Use case |
|---|---|---|
| **stdio** (default) | stdin/stdout | Local integrations — Cursor, Claude Desktop, etc. |
| **http** | Streamable HTTP | Remote / network access — recommended for servers |
| **sse** | HTTP + SSE (legacy) | Older MCP clients that don't support Streamable HTTP |

```bash
# stdio (default) — for Cursor / Claude Desktop
bun run mcp

# Streamable HTTP — serves on http://127.0.0.1:3000/mcp
bun run mcp --transport http

# Legacy SSE — serves on http://127.0.0.1:3000/sse + /messages
bun run mcp --transport sse
```

All network options can be set via CLI flags or environment variables:

| Flag | Env var | Default | Description |
|---|---|---|---|
| `--transport` | `MCP_TRANSPORT` | `stdio` | Transport mode: `stdio`, `http`, or `sse` |
| `--host` | `MCP_HOST` | `127.0.0.1` | Bind address |
| `--port` | `MCP_PORT` | `3000` | Bind port |
| `--mcp-path` | `MCP_PATH` | `/mcp` | Endpoint path (`http` mode) |
| `--sse-path` | `MCP_SSE_PATH` | `/sse` | SSE stream endpoint (`sse` mode) |
| `--messages-path` | `MCP_MESSAGES_PATH` | `/messages` | POST endpoint (`sse` mode) |

Run `bun run mcp --help` for the full list.

### Setup for Claude Desktop (stdio)

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "slideagile": {
      "command": "bun",
      "args": ["src/mcp-server.ts"],
      "cwd": "/path/to/slideagile"
    }
  }
}
```

### Setup for Cursor (stdio)

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "slideagile": {
      "command": "bun",
      "args": ["src/mcp-server.ts"],
      "cwd": "/path/to/slideagile"
    }
  }
}
```

### Setup for remote clients (HTTP / SSE)

Start the server in the background, then point your MCP client at the URL:

```bash
# Start in HTTP mode on a custom port
bun run mcp --transport http --host 0.0.0.0 --port 8080

# Client connects to: http://<your-host>:8080/mcp
```

For legacy SSE clients:

```bash
bun run mcp --transport sse --port 8080

# Client connects to:
#   SSE stream:  GET  http://<your-host>:8080/sse
#   Messages:    POST http://<your-host>:8080/messages?sessionId=<id>
```

### MCP Tools

| Tool | Description |
|---|---|
| `save_pipeline_data` | Validate & save stage output (research, plan, copy, design JSON) |
| `build_slides` | Validate HTML slides against design rules, wrap with tokens, save to disk |
| `validate_slides` | Run auto-validation rules on built slides (read-only check) |
| `save_qa_report` | Validate and save a QA review report |
| `render_pngs` | Render HTML slides to PNGs via headless Chrome (auto-generates presentation) |
| `generate_presentation` | Generate a standalone presentation.html viewer from a slides directory |
| `list_themes` | List available themes |
| `get_pattern_catalog` | Get all 28 layout patterns with structure hints |
| `list_outputs` | List previous output directories with timestamps and available artifacts |
| `apply_copy_to_templates` | Apply copy data to HTML slide templates (with optional PNG rendering) |

### MCP Prompts

| Prompt | Description |
|---|---|
| `pipeline_overview` | Full pipeline guide with JSON schemas for all 8 stages |
| `html_developer_guide` | Detailed HTML/CSS rules for building slides |
| `qa_reviewer_guide` | QA review rules, severity levels, checklist, and report schema |

### MCP Resources

| Resource | Description |
|---|---|
| `slideagile://patterns` | Layout pattern catalog (JSON) |
| `slideagile://design-tokens` | CSS custom properties |
| `slideagile://base-styles` | Base CSS reset and utilities |
| `slideagile://pattern-list` | Compact pattern list for prompts |

## CLI Reference

The CLI provides template re-rendering, theme/template management, and video rendering with optional TTS narration.

### `generate`

Apply copy.json to existing HTML slide templates and export PNGs.

| Option | Description |
|---|---|
| `--template <dir>` | **(required)** Source directory with `slides/` templates |
| `--rerender <file>` | **(required)** Path to copy.json to apply |
| `-t, --theme <name>` | Theme name |
| `-a, --author <name>` | Bottom-bar author/brand text override for this run |
| `-o, --output <dir>` | Output directory |

```bash
slideagile generate --template ./output/2026-03-04_topic --rerender new-copy.json --author @좋습좋생
```

### `theme list` / `theme create <name>`

List or create themes (see [Themes](#themes)).

### `template list` / `template add <folder> [name]`

List or save slide templates for reuse.

### `config set <key> <value>` / `config get <key>` / `config list` / `config unset <key>`

Manage persistent user preferences. Valid keys: `theme`, `author`, `slides`, `output`, `ttsProvider`, `ttsVoice`, `ttsLanguage`.

### `video build`

Build an MP4 video from rendered slide PNG files (`slide-XX.png`).

SlideAgile bundles FFmpeg via `ffmpeg-static` by default. Use `--ffmpeg` or `FFMPEG_PATH` to override.
Current local narration implementation supports `gcp-hd`.
When `--tts` is enabled, SlideAgile generates per-slide narration segments and keeps audio in sync with each slide.

| Option | Description |
|---|---|
| `--input <dir>` | **(required)** Output directory containing `slides/` or the `slides/` directory itself |
| `--out <file>` | Optional output MP4 path. Default: `deck.mp4` in the output directory (or parent of `slides/` if `--input` points to `slides/`) |
| `--seconds-per-slide <n>` | Time per slide in seconds (default: `4`) |
| `--fps <n>` | Output FPS (default: `30`) |
| `--format <name>` | Video format: `match-source` (default, follows slide size), `short-form` (1080x1920), or `widescreen` (1920x1080) |
| `--ffmpeg <path>` | Optional path to `ffmpeg` executable |
| `--tts` | Enable narration via configured TTS provider |
| `--tts-provider <name>` | Override provider for this run (`gcp-hd` or `openai`) |
| `--tts-voice <id>` | Override voice for this run (provider-specific ID) |
| `--tts-language <code>` | Narration language code (default: `ko-KR`) |
| `--script-file <file>` | Per-slide narration script JSON (recommended for presenter-style voiceover) |

```bash
slideagile video build --input ./output/2026-03-07_20-00-41_디지털-디톡스

# With local GCP HD narration
slideagile video build --input ./output/2026-03-07_20-00-41_디지털-디톡스 --tts --tts-provider gcp-hd --tts-language ko-KR

# Widescreen long-form export
slideagile video build --input ./output/2026-03-07_20-00-41_디지털-디톡스 --format widescreen

# With presenter script (recommended)
slideagile video build --input ./output/2026-03-07_20-00-41_디지털-디톡스 --tts --tts-provider gcp-hd --tts-language ko-KR --script-file ./output/2026-03-07_20-00-41_디지털-디톡스/narration-script.json
```

Presenter-style narration is best supplied through a dedicated script file instead of raw slide text.
If `--script-file` is omitted, SlideAgile looks for `narration-script.json` in the output directory, then falls back to `copy.json`.
To keep narration tied to each page, SlideAgile automatically anchors script lines to slide key text (heading/subheading) when needed.

`narration-script.json` format:

```json
{
  "slides": [
    { "slideNumber": 1, "script": "오늘은 디지털 디톡스가 왜 필요한지 이야기해볼게요." },
    { "slideNumber": 2, "script": "먼저 우리가 얼마나 자주 화면을 확인하는지부터 볼까요?" }
  ]
}
```

## Architecture

### Pipeline Flow (driven by LLM agent via MCP)

```
Topic -> Research -> Plan -> Copy -> Design -> HTML Build -> Validate & QA -> PNG Export -> Presentation
                                                                  |
                                                      (fix loop until QA passes)
```

### Pipeline Stages

| Stage | Responsibility | Key Constraint |
|---|---|---|
| **Research** | Gather facts, stats, quotes, audience, keywords | Structured JSON output |
| **Plan** | Plan slide structure with emotional curve (empathy -> transition -> evidence -> action) | Emotion temperature 1-5 per slide |
| **Copy** | Write Korean copy per slide | Strict char limits: heading 15, body 80/para, CTA 30 |
| **Design** | Select layout patterns, define color palette | Choose from 28 pattern catalog |
| **HTML Build** | Produce standalone HTML/CSS per slide | default 1080x1920 (or 1920x1080 long-form), all CSS inline, no external deps, min 28px font |
| **QA Review** | Read-only review for factual/layout/design issues | Returns pass or needs_revision verdict |

### Design Constraints

- **Standalone HTML**: Every slide is a complete HTML document. No CDN links, no external images, no JavaScript. Only CSS shapes, gradients, and emoji.
- **Korean-first**: `lang="ko"`, `word-break: keep-all`, Korean font stack (Pretendard, Noto Sans KR).
- **28 layout patterns**: Defined in `src/design-system/shared/patterns.ts`. Categories: information, procedure, comparison, data, emphasis, code, mixed, intro.
- **Design tokens**: CSS custom properties in `src/design-system/shared/design-tokens.css`. Themes override tokens via `theme.css`.

## Output Structure

Each generation creates a timestamped directory:

```
output/
  2026-02-27_topic-slug/
    research.json       # Structured research data
    plan.json           # Slide plan with emotional curve
    copy.json           # Copy for each slide
    design-brief.json   # Color palette and layout patterns
    qa-report.json      # QA review results
    presentation.html   # Interactive carousel viewer (HTML↔PNG toggle)
    slides/
      slide-01.html     # Standalone HTML (viewable in browser)
      slide-01.png      # Rendered PNG (matches selected slide format)
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

Generated automatically after PNG rendering. Can also be triggered independently via the `generate_presentation` MCP tool.

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
  mcp-server.ts               # MCP server entry point
  config.ts                   # Env-based config with Zod validation
  commands/
    generate.ts               # Template re-render command
    theme.ts                  # Theme management
    template.ts               # Template management
  pipeline/
    types.ts                  # Zod schemas for all pipeline data
  design-system/
    shared/
      design-tokens.css       # CSS custom properties
      base-styles.css         # Reset + utility classes
      patterns.ts             # 28 layout pattern definitions
    themes/                   # Theme directories
  renderer/
    html-builder.ts           # Wraps partial HTML into full documents
    png-exporter.ts           # Puppeteer-based HTML-to-PNG
    presentation-builder.ts   # Generates interactive carousel viewer
    template-renderer.ts      # Applies copy data to HTML templates
  validation/
    slide-validator.ts        # Programmatic HTML checks
  utils/
    file.ts                   # File I/O helpers, slugify
    paths.ts                  # Path resolution
    logger.ts                 # Colored terminal logger
    preferences.ts            # Cross-platform user preferences
tests/
  renderer/
    html-builder.test.ts
    presentation-builder.test.ts
  pipeline/
    types.test.ts
  validation/
    slide-validator.test.ts
  design-system/
    patterns.test.ts
  utils/
    file.test.ts
```

### Adding a New Layout Pattern

1. Add the pattern definition to `src/design-system/shared/patterns.ts`
2. Include: `id`, `category`, `name`, `description`, `suitableFor` (roles), `structureHint` (HTML guide)
3. The LLM agent will automatically see it via the pattern catalog resource/tool

## Themes

A theme customizes the visual identity of generated slides.

```bash
bun start theme create my-brand
```

This creates `src/design-system/themes/my-brand/` with:
- `theme.json` - Metadata (name, description)
- `theme.css` - CSS custom property overrides (empty by default)

Override any design token in `theme.css` to customize colors, typography, spacing, etc. See `src/design-system/shared/design-tokens.css` for available tokens.
