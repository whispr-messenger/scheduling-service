# Base de données

## Tables

```
┌──────────────┐     ┌───────────────┐     ┌────────────────┐
│    jobs      │────▶│  executions   │     │ execution_logs │
│              │     │               │     │                │
│ - id         │     │ - id          │     │ - id           │
│ - name       │     │ - job_id      │     │ - execution_id │
│ - category   │     │ - status      │     │ - log_entry    │
│ - payload    │     │ - started_at  │     └────────────────┘
│ - priority   │     │ - finished_at │
└──────┬───────┘     └───────────────┘
       │
  ┌────┼──────────────┐
  │    │              │
┌─▼────▼───┐  ┌───────▼──────┐  ┌────────────────┐
│ schedules│  │recurring_jobs│  │job_dependencies│
│          │  │              │  │                │
│ - job_id │  │ - job_id     │  │ - job_id       │
│ - cron   │  │ - interval   │  │ - depends_on   │
└──────────┘  └──────────────┘  └────────────────┘

┌──────────────────┐
│ job_categories   │
│                  │
│ - id             │
│ - name           │
│ - priority       │
└──────────────────┘

┌──────────────────────┐
│ scheduled_messages   │
│                      │
│ - id                 │
│ - conversation_id    │
│ - sender_id          │
│ - content            │
│ - scheduled_at       │
└──────────────────────┘
```
