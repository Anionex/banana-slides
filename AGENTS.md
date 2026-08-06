# 科创点AI Banana Slides Fork Rules

This fork is the internal PPT orchestration and rendering engine for 科创点AI.

## Platform provider boundary

- Production model calls must use `KCD_PLATFORM`; never read provider API keys from settings, environment variables, requests, or the database.
- Each generation request must include `platform_execution` with a platform project ID, PPT job ID, idempotency key, gateway URL, and short-lived execution token.
- The execution token is request context only. Never persist it, log it, include it in task snapshots, or echo it in API responses.
- Text and image calls go through the platform model-invocation API. Poll boundedly and preserve the platform's retryable/error classification.
- Do not cache execution context globally. Concurrent projects and jobs must remain isolated.

## Product surface

- Keep Banana responsible for outline/page orchestration, visual composition, rendering, and export.
- The built-in frontend and user-editable provider settings are disabled in the product image.
- Only health, project actions, task status, and file/export endpoints are part of the product API.
- Preserve compatibility with the platform OpenAPI contract and fixtures in the main repository.
- `STRUCTURED_VISUAL` is a full-slide image consistency mode, not a native PowerPoint Master/Layout or DrawingML implementation.
- Treat platform-provided design preferences as inputs and the generated visual bible as a versioned, hashed artifact. Freeze it before parallel image generation.
- Every structured page prompt must carry the same visual-bible hash plus one validated page archetype. Page-local text may not override palette, typography, grid, medium, or forbidden-variation rules.
- Generate at most one reusable style board per design-spec hash. When reference images are supported it is the first style reference for every page; content assets follow it.
- Cross-page review must degrade to warnings when vision analysis is unavailable. Repair at most once and for at most 20 percent of pages, rounded up; never discard the last successful page image.

## Supply chain and testing

- Base changes on a recorded upstream commit. Upstream syncs require review and a new immutable image digest.
- Production images must contain a complete, locked Python environment. Entrypoints must never run `uv sync`, `pip install`, or otherwise download/build dependencies.
- Database migrations run as an explicit one-shot deployment step. The API process must not fall back to `create_all` when a migration fails.
- Production readiness must reject a database whose Alembic revision is behind the image head or whose required schema columns are missing. Liveness must remain dependency-free.
- Schema incompatibility must return a stable machine-readable error and never expose SQL, driver exceptions, credentials, or database URLs to platform callers.
- Never commit `.env`, user projects, generated decks, provider responses containing secrets, registry credentials, or local databases.
- Tests must cover token redaction, concurrent job isolation, text/image invocation polling, platform errors, and operation without provider API keys.
- Before opening or updating a Fork PR, fetch its target branch and run the exact CI command against the PR merge result. Running selected tests against the source branch alone is insufficient.

## Durable task rules

- Every platform project creation and stage submission has a persisted idempotency receipt with a request hash. Reusing a key with different input is a conflict.
- Receipts may store project/job/stage identifiers and task state, but never request bodies, execution tokens, credentials, or raw provider responses.
- Process restarts must convert orphaned processing tasks to a retryable interrupted state. Re-driving the same stage must reuse completed page artifacts.
- Model invocation keys are derived from stable stage, page, operation, and content identities. Thread scheduling order must not affect idempotency.
- Background work is bounded. Capacity exhaustion returns a retryable busy response instead of creating an unbounded queue.
- Style-board, visual-review, and repair invocation keys derive from stable project, design-spec, page, and operation identities. Thread completion order must not affect them.
