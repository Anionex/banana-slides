default: up

build full='0': down
    if [ "{{full}}" = "1" ]; then docker compose build --no-cache; else docker compose build; fi;

relaunch: build up

up:
    docker compose up -d

down:
    docker compose down

logs:
    docker compose logs -f