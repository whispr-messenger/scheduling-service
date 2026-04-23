# Messages programmés

## Module

Le module `scheduled-messages` permet de planifier l'envoi de messages.

## Endpoints

```
GET    /api/v1/scheduled-messages      - Lister
POST   /api/v1/scheduled-messages      - Créer
PATCH  /api/v1/scheduled-messages/:id  - Modifier
DELETE /api/v1/scheduled-messages/:id  - Supprimer
```

## Flux

```
Création ──▶ Stockage DB ──▶ Worker BullMQ ──▶ Envoi à l'heure prévue
```
