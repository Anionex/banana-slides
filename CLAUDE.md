# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Banana Slides is an AI-native PPT generator that uses the nano banana pro model to generate presentation decks from ideas, outlines, or page descriptions. Supports natural language editing, material extraction from attachments, and export to editable PPTX/PDF.

**Tech Stack:**
- **Frontend**: React 18 + TypeScript + Vite 5 + Tailwind CSS + Zustand
- **Backend**: Flask 3.0 + Python 3.10+ + SQLite (SQLAlchemy + Alembic)
- **AI**: Multi-provider architecture (Gemini, OpenAI, Vertex AI, Lazyllm)
- **File Processing**: MinerU API + AI image captioning
- **Deployment**: Docker Compose or source with uv

## Common Development Commands

### Backend (all commands from project root)

```bash
uv sync                                        # Install dependencies
uv sync --extra test                           # Install with test deps (pytest, etc.)

cd backend
uv run alembic upgrade head                    # Run migrations
uv run alembic revision --autogenerate -m "desc"  # Create new migration
uv run python app.py                           # Start server

# Tests (from project root; testpaths configured in pyproject.toml)
uv run pytest                                  # Run all tests
uv run pytest backend/tests/unit/test_file_parser_service.py  # Single file
uv run pytest --cov=backend                    # With coverage
```

### Frontend (from `frontend/`)

```bash
npm install
npm run dev          # Dev server (port auto-computed from worktree dir name)
npm run build:check  # TypeScript check + production build
npm run lint:strict  # Lint with zero warnings
npm run test:run     # Vitest single run
npm run test:e2e     # Playwright E2E
```

### Docker

```bash
docker compose up -d                          # Start
docker compose logs -f --tail 50 backend      # Backend logs
docker compose down                           # Stop
# Rebuild after changes:
docker compose down && docker compose build --no-cache && docker compose up -d
```

## Architecture

### Backend (`backend/`)

**Layers:** `app.py` (entry) -> `controllers/` (routes) -> `services/` (business logic) -> `models/` (SQLAlchemy ORM)

**Key Services:**
- `ai_service.py` + `ai_service_manager.py` - AI model interactions via pluggable providers
- `prompts.py` - **All AI prompt templates** (shared constants, outline, description, image generation, image processing, content extraction). Organized into 6 sections with DRY constants — modify carefully as changes affect all generation flows.
- `task_manager.py` - Async task execution with ThreadPoolExecutor
- `export_service.py` - PPTX/PDF export with OCR-based editable export
- `inpainting_service.py` - Image inpainting (Gemini, Volcengine, Baidu)
- `file_parser_service.py` - Document parsing via MinerU + image captioning

**AI Provider System (`services/ai_providers/`):**
- `text/`, `image/`, `ocr/` - Provider implementations (GenAI, OpenAI, Lazyllm, Baidu OCR)
- Provider format controlled by `AI_PROVIDER_FORMAT` env var: `gemini`, `openai`, `vertex`, or `lazyllm`

**Database:**
- SQLite with WAL mode, `check_same_thread=False`, 30s busy timeout
- Migrations: `backend/migrations/versions/`
- Settings table can override env vars (accessed via frontend Settings page)

**Concurrency:** `MAX_DESCRIPTION_WORKERS` (default 5), `MAX_IMAGE_WORKERS` (default 8), task queue with status tracking (pending/in_progress/completed/failed)

### Frontend (`frontend/`)

**State:** `store/useProjectStore.ts` (Zustand) - project state, page ops, task polling with debounced API updates

**Page Flow:** `Home.tsx` (create) -> `OutlineEditor.tsx` (edit outline) -> `DetailEditor.tsx` (edit descriptions + materials) -> `SlidePreview.tsx` (preview + region edits) -> `History.tsx` (versions)

**API:** `api/client.ts` (Axios) + `api/endpoints.ts` (typed endpoints). Dev server proxies `/api`, `/files`, `/health` to backend. Imports use `@/` path alias (mapped to `src/`).

**i18n:** react-i18next with browser language detection.

**Ports:** Auto-computed from worktree dir name (MD5 hash mod 500 + base). Override with `BACKEND_PORT`/`FRONTEND_PORT` env vars. See `vite.config.ts` and `backend/app.py:_compute_worktree_port`.

## Configuration

Environment variables in `.env` at project root — see `.env.example` for full list. Key concept: `AI_PROVIDER_FORMAT` (`gemini`/`openai`/`vertex`/`lazyllm`) determines which API keys and models are used. Database `settings` table can override any env var (reset via frontend Settings > "Restore to Default").

## Important Details

- **Image storage:** Generated images in `uploads/`, relative paths in DB. Versioning via `page_image_version` table.
- **Frontend build:** Production served by nginx (Docker). Env vars loaded from root `.env`.
- **Backup before migration:** `cp backend/instance/database.db backend/instance/database.db.bak`
