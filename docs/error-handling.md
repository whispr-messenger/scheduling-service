# Gestion des erreurs

## Circuit Breaker

```
Service disponible ──▶ Appels normaux
                           │
                     Échecs > seuil
                           │
Circuit ouvert ──▶ Requêtes rejetées (30s)
                           │
                     Half-open
                           │
                     Test 1 requête
                      ok │ fail
                    ┌────┼────┐
                    │        │
               Fermé    Ouvert
```

Le circuit breaker protège contre les cascades d'erreurs entre services.
