# Types de jobs

## Catégories

| Type | Priorité | Description |
|------|----------|-------------|
| messaging | HIGH | Messages programmés |
| notifications | HIGH | Rappels et alertes |
| maintenance | MEDIUM | Nettoyage et maintenance |
| cleanup | LOW | Suppression données expirées |
| reports | MEDIUM | Génération de rapports |
| analytics | LOW | Traitement analytique |

## Flux d'exécution d'un job

```
Création ──▶ Queue Bull ──▶ Worker pick ──▶ Exécution
    │                                          │
    │                                    ┌─────▼─────┐
    │                                    │  Succès?  │
    │                                    └─────┬─────┘
    │                                     oui  │  non
    │                                    ┌─────┼─────┐
    │                                    │     │     │
    │                                  Done  Retry  Failed
    │                                          │
    │                                    (max retries)
```
