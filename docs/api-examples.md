# Exemples d'utilisation API

## Créer un job

```bash
curl -X POST http://localhost:3000/api/v1/jobs \
  -H "Content-Type: application/json" \
  -d '{"name": "Mon rappel", "categoryId": "...", "targetService": "messaging"}'
```

## Planifier un job

```bash
curl -X POST http://localhost:3000/api/v1/jobs/<id>/schedule \
  -H "Content-Type: application/json" \
  -d '{"scheduleType": "CRON", "cronExpression": "0 9 * * *"}'
```
