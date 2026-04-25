# Dépendances entre jobs

## Schéma

```
Job A ──▶ Job B ──▶ Job C
          (attend A)  (attend B)
```

Un job ne s'exécute que quand tous ses parents sont terminés.

## Table

```
┌──────────────────┐
│ job_dependencies │
│                  │
│ - jobId          │
│ - dependsOnJobId │
└──────────────────┘
```
