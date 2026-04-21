# Expressions Cron

## Format

```
┌─── minute (0-59)
│ ┌─── heure (0-23)
│ │ ┌─── jour du mois (1-31)
│ │ │ ┌─── mois (1-12)
│ │ │ │ ┌─── jour de la semaine (0-7)
│ │ │ │ │
* * * * *
```

## Exemples

| Expression | Description |
|-----------|-------------|
| `0 9 * * *` | Tous les jours à 9h |
| `*/15 * * * *` | Toutes les 15 minutes |
| `0 0 1 * *` | Premier jour de chaque mois |
