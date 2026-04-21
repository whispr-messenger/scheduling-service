# Base de données

## Tables principales

```
┌──────────────┐     ┌───────────────┐
│    jobs      │────▶│  executions   │
│              │     │               │
│ - id         │     │ - id          │
│ - name       │     │ - job_id      │
│ - category   │     │ - status      │
│ - payload    │     │ - started_at  │
│ - priority   │     │ - finished_at │
└──────────────┘     └───────────────┘
        │
        ▼
┌──────────────┐
│  schedules   │
│              │
│ - id         │
│ - job_id     │
│ - cron_expr  │
│ - next_run   │
└──────────────┘
```
