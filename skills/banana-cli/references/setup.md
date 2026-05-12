# Banana Slides Setup

Full documentation: https://docs.bananaslides.online/

## Install and Start Backend

```bash
git clone https://github.com/Anionex/banana-slides
cd banana-slides
cp .env.example .env
# Edit .env — at minimum set an AI provider key (see below)
cd backend
uv sync
uv run alembic upgrade head
uv run python app.py
```

Backend starts on http://localhost:5000.

## Required Configuration

Edit `.env` with at least one AI provider:

```env
# Google Gemini (default)
AI_PROVIDER_FORMAT=gemini
GOOGLE_API_KEY=your-key

# OR OpenAI-compatible
AI_PROVIDER_FORMAT=openai
OPENAI_API_KEY=your-key
OPENAI_BASE_URL=https://api.openai.com/v1
```

Supported providers: `gemini`, `openai`, `vertex`, `lazyllm`, `anthropic`.

## Verify

```bash
curl -sf http://localhost:5000/health
```

## Install banana-cli

```bash
# Option A: use directly from project root (no install needed)
uv run banana-cli --help

# Option B: install globally (then use banana-cli directly)
uv tool install .
banana-cli --help
```

If the backend runs on a non-default port, pass `--base-url` or set `BANANA_CLI_BASE_URL`.
