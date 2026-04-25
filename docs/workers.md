# Workers BullMQ

## Architecture

```
Redis Queue ──▶ Worker Process ──▶ Job Handler
                     │
               ┌─────▼─────┐
               │ Concurrency│
               │ = 5 par    │
               │ catégorie  │
               └───────────┘
```

Les workers tournent dans le même process que le service NestJS.
