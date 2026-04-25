# Docker

## Dev

```bash
docker-compose -f docker-compose.dev.yml up -d
```

## Dépendances

```
┌──────────────┐     ┌──────────┐     ┌──────────┐
│  Scheduling  │────▶│ PostgreSQL│     │  Redis   │
│  Service     │────▶│          │     │          │
└──────────────┘     └──────────┘     └──────────┘
```
