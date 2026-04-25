# Circuit Breaker

## Schéma

```
Service dispo ──▶ Appels normaux
                       │
                 Échecs > seuil
                       │
               ┌───────▼───────┐
               │ Circuit ouvert│
               │ (30s cooldown)│
               └───────┬───────┘
                       │
               ┌───────▼───────┐
               │  Half-open    │
               │ (1 test req)  │
               └───────┬───────┘
                  ok   │  fail
                 ┌─────┼─────┐
                 │           │
            Fermé       Ouvert
```

Protège contre les cascades d'erreurs entre services.
