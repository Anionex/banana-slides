# Production Checklist

This repository can be deployed as a single-node commercial SaaS baseline.
Before handing it to a customer or promoting it as production-ready, complete
the checks below.

## Required Runtime Changes

- Run the backend with Gunicorn instead of Flask's development server.
- Keep `FLASK_ENV=production` in production.
- Configure `JWT_SECRET_KEY`, `SECRET_KEY`, `FRONTEND_URL`, `CORS_ORIGINS`,
  `DEFAULT_ADMIN_EMAIL`, and `DEFAULT_ADMIN_PASSWORD`.
- Configure mail and payment credentials before enabling those features.

## Gunicorn Defaults

The backend entrypoint reads these environment variables:

- `GUNICORN_WORKERS` (default `2`)
- `GUNICORN_WORKER_CLASS` (default `gthread`)
- `GUNICORN_THREADS` (default `8`)
- `GUNICORN_TIMEOUT` (default `300`)
- `GUNICORN_GRACEFUL_TIMEOUT` (default `30`)
- `GUNICORN_KEEPALIVE` (default `5`)

For single-node deployments, start with the defaults and tune after observing
real traffic.

## Reverse Proxy

- Proxy `/api` and `/files` to the backend service.
- Set proxy/read timeouts to at least `300s` for long-running generation tasks.
- Keep upload body limits aligned with backend limits.

## Access Control

- Private files under `/files/...` now require authentication.
- Browser image requests use the current access token as a query parameter.
- Verify that project files, user templates, and private materials are only
  accessible by their owners.

## Smoke Tests

Run these before each delivery or production release:

1. Register a new user and verify login/logout.
2. Upload a project template and confirm it renders in the UI.
3. Upload a user template and confirm another user cannot access it.
4. Generate or upload a global material and confirm another user cannot access it.
5. Confirm `/health` responds quickly after deployment.
6. Complete one payment test flow if payment is enabled.

## Scale Notes

- The default deployment remains single-node and uses SQLite.
- For sustained multi-user production traffic, plan upgrades for PostgreSQL,
  external object storage, and a dedicated task queue/worker service.
