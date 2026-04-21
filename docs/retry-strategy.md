# Stratégie de retry

## Configuration par catégorie

| Catégorie | Max retries | Timeout |
|-----------|------------|---------|
| messaging | 3 | 30s |
| notifications | 5 | 15s |
| maintenance | 2 | 600s |
| cleanup | 2 | 300s |

## Backoff

```
Tentative 1 ──▶ Attente 1s ──▶ Tentative 2 ──▶ Attente 4s ──▶ Tentative 3
                                                                    │
                                                              Failed (abandon)
```

Le backoff est exponentiel : 1s, 4s, 16s...
