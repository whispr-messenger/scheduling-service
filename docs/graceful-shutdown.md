# Graceful Shutdown

## Processus

```
Signal SIGTERM reçu
     │
     ▼
Stop accepter nouvelles requêtes
     │
     ▼
Attendre jobs en cours (30s max)
     │
     ▼
Fermer connexions DB/Redis
     │
     ▼
Exit propre
```

Important pour les rolling updates K8s.
