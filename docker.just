default: up

build: down
    docker compose build --no-cache

relaunch: build up

up:
    docker compose up -d

down:
    docker compose down

logs:
    docker compose logs -f