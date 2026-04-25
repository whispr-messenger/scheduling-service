# Gestion des fuseaux horaires

## Principe

Tous les horaires sont stockés en UTC en interne.

```
Client (Europe/Paris) ──▶ Conversion UTC ──▶ Stockage DB
                                                  │
                              Exécution du job à l'heure UTC
                                                  │
                              Notification ──▶ Conversion locale
```

## Configuration

La timezone par défaut est `UTC`. Chaque job peut spécifier sa timezone.
