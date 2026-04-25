# Catégories de jobs

## Entité job_categories

Chaque job appartient à une catégorie qui définit sa priorité et son timeout.

```
┌─────────────────┐
│ job_categories  │
│                 │
│ - id            │
│ - name          │
│ - priority      │
│ - timeout       │
│ - maxRetries    │
└─────────────────┘
       │
       ▼
  Utilisé par chaque job
```
