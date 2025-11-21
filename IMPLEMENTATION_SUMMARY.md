# Résumé d'Implémentation - Communication gRPC

## Date
14 Novembre 2025

## Objectif
Implémenter la communication gRPC bidirectionnelle entre le **scheduling-service** (NestJS) et le **messaging-service** (Elixir/Phoenix) pour le projet Whispr Messenger.

## Fichiers Créés

### 1. Fichier Proto Messaging
**Emplacement:** `/src/modules/grpc/proto/messaging.proto`

Définit le contrat gRPC pour le MessagingService avec :
- `SendNotification` - Envoyer une notification quand un job s'exécute (ex: reminder)
- `SendScheduledMessage` - Envoyer un message programmé
- `CleanupExpiredMessages` - Nettoyer les messages expirés
- `HealthCheck` - Vérifier l'état du service

Types supportés :
- MessageType : TEXT, IMAGE, VIDEO, AUDIO, FILE, SYSTEM
- NotificationType : MESSAGE, REMINDER, SYSTEM_ALERT, SCHEDULED_MESSAGE

### 2. Documentation d'Intégration
**Emplacement:** `/GRPC_INTEGRATION.md`

Guide complet pour implémenter le côté Elixir du messaging service, incluant :
- Configuration des dépendances Elixir (grpc, cowboy, protobuf)
- Implémentation du serveur gRPC MessagingService
- Implémentation du client gRPC SchedulerService
- Configuration du endpoint Phoenix
- Variables d'environnement
- Tests et troubleshooting

## Fichiers Modifiés

### 1. Client Messaging
**Fichier:** `/src/modules/grpc/clients/messaging.client.ts`

Ajouts :
- Énumérations `MessageType` et `NotificationType`
- Interface `SendNotificationRequest` et `SendNotificationResponse`
- Méthode `sendNotification()` pour envoyer des notifications via gRPC
- Gestion graceful des erreurs (service peut démarrer même si messaging non disponible)
- Logs détaillés pour debugging

### 2. Service Scheduler
**Fichier:** `/src/modules/scheduler/services/scheduler.service.ts`

Modifications :
- Injection du `MessagingGrpcClient` via dependency injection
- Refactorisation de `executeWithTimeout()` avec gestion du timeout via Promise.race()
- Nouvelle méthode `executeJobByService()` qui route vers le bon service
- Nouvelle méthode `executeMessagingJob()` qui gère les jobs de type messaging
  - `sendScheduledMessage` - Envoi de messages programmés
  - `sendNotification` - Envoi de notifications/reminders
  - `cleanupExpiredMessages` - Nettoyage automatique
- Nouvelle méthode `executeNotificationJob()` pour les jobs de type notification
- Fallback gracieux pour services non disponibles

### 3. Module Scheduler
**Fichier:** `/src/modules/scheduler/scheduler.module.ts`

- Ajout de l'import `GrpcModule` avec `forwardRef()` pour éviter les dépendances circulaires

### 4. Module gRPC
**Fichier:** `/src/modules/grpc/grpc.module.ts`

- Ajout de `forwardRef()` pour `SchedulerModule`
- Configuration dynamique des URLs via ConfigService pour MESSAGING_SERVICE et NOTIFICATION_SERVICE
- Injection du ConfigService dans les factories

### 5. Configuration Environnement

**Fichier:** `/.env`
```env
# Ajouts
GRPC_PORT=3001
GRPC_HOST=0.0.0.0
MESSAGING_SERVICE_HOST=localhost
MESSAGING_SERVICE_PORT=4001
NOTIFICATION_SERVICE_HOST=localhost
NOTIFICATION_SERVICE_PORT=4002
```

**Fichier:** `/.env.example`
```env
# Mis à jour avec
PORT=3000
GRPC_PORT=3001
GRPC_HOST=0.0.0.0
MESSAGING_SERVICE_HOST=localhost
MESSAGING_SERVICE_PORT=4001
NOTIFICATION_SERVICE_HOST=localhost
NOTIFICATION_SERVICE_PORT=4002
```

### 6. Documentation README
**Fichier:** `/README.md`

Ajout d'une section complète sur gRPC incluant :
- Configuration des ports (dev vs prod)
- Services exposés et méthodes disponibles
- Scénarios d'usage
- Graceful degradation
- Table des variables d'environnement mise à jour
- Section "Exemples d'Usage" avec :
  - Création de job de notification avec planification
  - Envoi de message programmé
  - Tests avec grpcurl
  - Exemple d'intégration depuis Elixir

## Architecture Implémentée

```
┌────────────────────────┐         gRPC          ┌─────────────────────────┐
│ Scheduling Service     │◄─────────────────────►│ Messaging Service       │
│ (NestJS/TypeScript)    │                        │ (Elixir/Phoenix)        │
│ Port 3000 (HTTP)       │                        │ Port 4000 (HTTP)        │
│ Port 3001 (gRPC)       │                        │ Port 4001 (gRPC)        │
└────────────────────────┘                        └─────────────────────────┘
```

## Flux de Communication

### Scheduling → Messaging
1. Un job programmé (ex: reminder) arrive à son heure d'exécution
2. Le `SchedulerService.executeJob()` est appelé
3. Il route vers `executeMessagingJob()` selon `targetService`
4. Appelle `messagingClient.sendNotification()` via gRPC
5. Le messaging service reçoit la requête et envoie la notification
6. Le résultat est enregistré dans l'execution

### Messaging → Scheduling
1. Un utilisateur veut programmer un message
2. Le messaging service (Elixir) appelle le `SchedulerClient.createJob()` via gRPC
3. Crée un job avec `targetService: "messaging"` et `targetMethod: "sendScheduledMessage"`
4. Planifie le job avec `scheduleJob()`
5. Le job s'exécutera automatiquement à l'heure prévue
6. Il appellera `messagingClient.sendScheduledMessage()` pour envoyer le message

## Configurations des Ports

### Développement Local
- **Scheduling HTTP REST:** 3000
- **Scheduling gRPC Server:** 3001
- **Messaging HTTP REST:** 4000
- **Messaging gRPC Server:** 4001

### Production Kubernetes
- **Scheduling HTTP REST:** 3000
- **Scheduling gRPC Server:** 50051
- **Messaging HTTP REST:** 4000
- **Messaging gRPC Server:** 50052

## Fonctionnalités Clés

### 1. Graceful Degradation
Les services peuvent démarrer même si l'autre n'est pas disponible :
- Try-catch dans `onModuleInit()` du client messaging
- Vérification de l'initialisation avant chaque appel
- Messages d'erreur clairs dans les logs
- Jobs échoueront mais seront automatiquement retentés

### 2. Error Handling Robuste
- Logs détaillés à chaque étape
- Erreurs catchées et loggées avec contexte
- Timeout configurables par job
- Retry automatique via Bull Queue

### 3. Type Safety
- Interfaces TypeScript pour tous les messages
- Enums pour les types de messages et notifications
- Validation via proto3

### 4. Observabilité
- Logs structurés avec métadonnées
- Correlation IDs pour tracer les requêtes
- Métriques d'exécution dans la base de données
- Health checks incluant l'état des connexions gRPC

## Prochaines Étapes (Côté Messaging Service - Elixir)

1. **Installer dépendances Elixir**
   ```elixir
   # mix.exs
   {:grpc, "~> 0.7"},
   {:protobuf, "~> 0.12"},
   {:google_protos, "~> 0.3"}
   ```

2. **Copier les fichiers proto**
   ```bash
   cp ../scheduling-service/src/modules/grpc/proto/*.proto priv/protos/
   ```

3. **Générer le code Elixir**
   ```bash
   mix protobuf.generate --output-path=./lib/whispr_messaging_web/grpc/generated \
     --include-path=priv/protos priv/protos/messaging.proto
   ```

4. **Implémenter le server**
   - Créer `lib/whispr_messaging_web/grpc/messaging_server.ex`
   - Implémenter les 4 méthodes du service

5. **Implémenter le client**
   - Créer `lib/whispr_messaging_web/grpc/scheduler_client.ex`
   - Implémenter `schedule_message()` et `create_cleanup_job()`

6. **Configurer Phoenix Endpoint**
   - Ajouter le handler gRPC dans l'endpoint
   - Configurer le port 4001

7. **Tester**
   - Démarrer les deux services
   - Tester avec grpcurl
   - Créer un job test et vérifier l'exécution

## Tests Recommandés

### 1. Test de Santé
```bash
# Scheduling service
grpcurl -plaintext localhost:3001 whispr.scheduler.SchedulerService/HealthCheck

# Messaging service (après implémentation)
grpcurl -plaintext localhost:4001 whispr.messaging.MessagingService/HealthCheck
```

### 2. Test de Création de Job
```bash
curl -X POST http://localhost:3000/api/v1/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Notification",
    "categoryId": "<category-id>",
    "targetService": "messaging",
    "targetMethod": "sendNotification",
    "payload": {
      "userId": "test-user",
      "message": "Test gRPC integration",
      "conversationId": "test-conv",
      "type": 2
    },
    "priority": "HIGH"
  }'
```

### 3. Test de Planification
```bash
curl -X POST http://localhost:3000/api/v1/jobs/<job-id>/schedule \
  -H "Content-Type: application/json" \
  -d '{
    "scheduleType": "ONCE",
    "scheduledAt": "2024-11-15T10:00:00Z",
    "timezone": "UTC"
  }'
```

## Sécurité

### Développement
- gRPC en mode plaintext (non chiffré)
- Validation des inputs via class-validator

### Production
- gRPC over mTLS via Istio Service Mesh
- Certificats auto-générés par SPIFFE/SPIRE
- Network policies Kubernetes
- Service identity verification

## Métriques et Monitoring

Les métriques suivantes sont maintenant tracées :
- Nombre d'appels gRPC par méthode
- Latence des appels gRPC
- Taux de succès/échec des jobs messaging
- État des connexions aux services externes
- Health checks incluant l'état du messaging client

## Références

- [Documentation gRPC](https://grpc.io/)
- [NestJS Microservices](https://docs.nestjs.com/microservices/grpc)
- [gRPC Elixir](https://github.com/elixir-grpc/grpc)
- [Protocol Buffers](https://protobuf.dev/)
- [Whispr Architecture](./CLAUDE.md)

## Notes Importantes

1. **Dépendances Circulaires:** Résolu avec `forwardRef()` entre SchedulerModule et GrpcModule

2. **Type Safety:** Les types proto sont mappés aux enums TypeScript pour éviter les magic numbers

3. **Logs:** Tous les appels gRPC sont loggés avec contexte complet pour faciliter le debugging

4. **Performance:** Les connexions gRPC sont réutilisées (initialisées une seule fois dans `onModuleInit`)

5. **Résilience:** Le système continue de fonctionner même si le messaging service est temporairement indisponible

## Conclusion

L'implémentation gRPC côté scheduling-service est complète et prête pour l'intégration. Les fichiers proto sont définis, le client est implémenté, et la logique d'exécution des jobs route correctement vers le messaging service.

Le guide d'intégration pour le messaging-service (Elixir) est fourni dans `GRPC_INTEGRATION.md` avec tous les détails nécessaires pour compléter l'autre côté de la communication.
