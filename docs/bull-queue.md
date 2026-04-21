# Bull Queue

## Architecture des files

```
┌───────────────────────────────────────┐
│              Redis                     │
│                                        │
│  ┌──────────┐  ┌──────────┐          │
│  │ messaging│  │  notif   │          │
│  │  queue   │  │  queue   │          │
│  └────┬─────┘  └────┬─────┘          │
│       │              │                │
│  ┌────▼─────┐  ┌─────▼────┐          │
│  │maintenance│ │ cleanup  │          │
│  │  queue   │  │  queue   │          │
│  └──────────┘  └──────────┘          │
└───────────────────────────────────────┘
```

Chaque catégorie de job a sa propre file avec sa priorité.
