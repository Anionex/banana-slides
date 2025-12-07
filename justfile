mod docker

set dotenv-load := true

default: install dev

install:
    uv sync
    cd frontend && npm install

[private]
frontend-dev:
    cd frontend && npm run dev

[private]
backend-dev:
    cd backend && uv run python app.py

[parallel]
dev: frontend-dev backend-dev

clean:
    rm -rf ./frontend/node_modules/
    rm -rf ./.venv/
