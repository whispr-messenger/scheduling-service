# Logs d'exécution

## Table execution_logs

Chaque exécution de job produit des logs stockés en DB.

```
Job s'exécute ──▶ Log début ──▶ Log résultat ──▶ Log fin
                                     │
                               Succès ou échec
                               + détails erreur
```
