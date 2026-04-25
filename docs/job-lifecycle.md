# Cycle de vie d'un job

```
CREATED ──▶ SCHEDULED ──▶ QUEUED ──▶ RUNNING ──▶ COMPLETED
                                        │
                                   FAILED ──▶ RETRY ──▶ RUNNING
                                        │
                                  (max retries)
                                        │
                                   PERMANENTLY_FAILED
```
