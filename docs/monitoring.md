# Monitoring

## Health checks

```
GET /api/v1/monitoring/health
GET /api/v1/monitoring/metrics
GET /api/v1/monitoring/queues
```

## Métriques

| Métrique | Description |
|----------|-------------|
| jobs_created_total | Nombre total de jobs créés |
| jobs_executed_total | Nombre total de jobs exécutés |
| job_duration_seconds | Durée d'exécution |
| queue_size | Taille des files |
