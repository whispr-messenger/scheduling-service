
up:
    docker compose -f docker/docker-compose.dev.yml up -d --build

down:
    docker compose -f docker/docker-compose.dev.yml down --volumes