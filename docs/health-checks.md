# Health Checks

## Endpoints

```
GET /api/v1/monitoring/health
```

## Composants vérifiés

```
Health Check
     │
     ├── PostgreSQL ──▶ Connexion active?
     ├── Redis ──▶ Ping OK?
     ├── Bull Queue ──▶ Files actives?
     └── Mémoire ──▶ Usage < 80%?
```

Tous les composants doivent être `up` pour que le service soit considéré sain.
