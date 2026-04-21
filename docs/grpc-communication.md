# Communication gRPC

## Vue d'ensemble

Le scheduling-service expose un serveur gRPC et communique avec le messaging-service.

## Schéma

```
┌───────────────┐  gRPC   ┌───────────────────┐
│  Messaging    │◄───────▶│   Scheduling      │
│  Service      │         │   Service         │
│  (port 50052) │         │   (port 50051)    │
└───────────────┘         └───────────────────┘
```

## Méthodes exposées

- `CreateJob` — Créer un job
- `ScheduleJob` — Planifier un job
- `ExecuteJob` — Exécuter immédiatement
- `CancelSchedule` — Annuler une planification
- `HealthCheck` — Vérifier l'état du service
