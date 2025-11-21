# Whispr Scheduling Service

Service central d'orchestration des tâches pour l'application Whispr messenger. Ce service gère la planification et l'exécution de toutes les tâches asynchrones de l'écosystème Whispr.

## 🎯 Fonctionnalités

- **Planification de tâches** : Cron, intervalles, exécutions uniques et immédiates
- **Gestion des files d'attente** : Système de files prioritaires avec Bull Queue
- **Communication inter-services** : gRPC avec mTLS via Istio Service Mesh
- **Monitoring avancé** : Health checks, métriques temps réel, observabilité
- **Résilience** : Retry automatique, circuit breakers, gestion d'erreurs
- **Types de tâches** : messaging, notifications, maintenance, cleanup, reports, analytics

## 🏗️ Architecture

### Stack Technique
- **Framework** : NestJS + TypeScript
- **Base de données** : PostgreSQL avec Prisma ORM
- **Cache/Queues** : Redis + Bull Queue
- **Communication** : gRPC + REST APIs
- **Monitoring** : Prometheus + Grafana
- **Déploiement** : Docker + Kubernetes (GKE)

### Structure du Projet
```
src/
├── config/                 # Configuration modules
├── common/                 # Utilitaires partagés
├── modules/
│   ├── scheduler/          # Logique principale de planification
│   ├── queues/            # Gestion des files Bull Queue
│   ├── monitoring/        # Health checks et métriques
│   ├── grpc/              # Services et clients gRPC
│   └── database/          # Service Prisma
├── app.module.ts          # Module racine
└── main.ts               # Point d'entrée
```

## 🚀 Démarrage Rapide

### Prérequis
- Node.js 18+
- PostgreSQL 14+
- Redis 7+
- Docker (optionnel)

### Installation Locale

1. **Installer les dépendances**
```bash
npm install
```

2. **Configuration de l'environnement**
```bash
cp .env.example .env
# Éditer .env avec vos configurations
```

3. **Configurer la base de données**
```bash
# Démarrer PostgreSQL et Redis
# Puis exécuter les migrations
npx prisma migrate dev
npx prisma generate
npm run db:seed
```

4. **Démarrer le service**
```bash
# Développement
npm run start:dev

# Production
npm run build
npm run start:prod
```

### Installation avec Docker

1. **Démarrer tous les services**
```bash
docker-compose -f docker-compose.dev.yml up -d
```

2. **Exécuter les migrations**
```bash
docker-compose exec scheduling-service npx prisma migrate dev
docker-compose exec scheduling-service npm run db:seed
```

## 📊 API Documentation

### REST API
- **Base URL** : `http://localhost:3001/api/v1`
- **Documentation** : `http://localhost:3001/api/docs` (Swagger)

### Endpoints Principaux

#### Jobs
- `POST /jobs` - Créer un nouveau job
- `GET /jobs/{id}` - Récupérer un job
- `POST /jobs/{id}/schedule` - Planifier un job
- `POST /jobs/{id}/execute` - Exécuter immédiatement
- `GET /jobs/{id}/executions` - Historique d'exécution

#### Monitoring
- `GET /monitoring/health` - Statut de santé
- `GET /monitoring/metrics` - Métriques système
- `GET /monitoring/queues` - Statistiques des files

### gRPC API

#### Server gRPC (Scheduling Service)
- **Port** : `3001` (local) / `50051` (Kubernetes)
- **Package** : `whispr.scheduler`
- **Proto** : `src/modules/grpc/proto/scheduler.proto`

##### Services Exposés
- `CreateJob` - Créer un nouveau job
- `GetJob` - Récupérer un job
- `ScheduleJob` - Planifier un job
- `ExecuteJob` - Exécuter un job
- `CancelSchedule` - Annuler une planification
- `HealthCheck` - Vérifier l'état du service
- `GetMetrics` - Obtenir les métriques

#### Client gRPC (Messaging Service)
- **Port** : `4001` (local) / `50052` (Kubernetes)
- **Package** : `whispr.messaging`
- **Proto** : `src/modules/grpc/proto/messaging.proto`

##### Méthodes Disponibles
- `SendNotification` - Envoyer une notification (utilisé par les jobs de type reminder)
- `SendScheduledMessage` - Envoyer un message programmé
- `CleanupExpiredMessages` - Nettoyer les messages expirés
- `HealthCheck` - Vérifier l'état du service

#### Configuration des Ports

##### Développement Local
```env
# Scheduling Service
PORT=3000                         # HTTP REST API
GRPC_PORT=3001                    # gRPC Server

# Messaging Service (externe)
MESSAGING_SERVICE_HOST=localhost
MESSAGING_SERVICE_PORT=4001       # gRPC Client
```

##### Production Kubernetes
```env
# Scheduling Service
PORT=3000
GRPC_PORT=50051

# Messaging Service (via service mesh)
MESSAGING_SERVICE_HOST=messaging-service
MESSAGING_SERVICE_PORT=50052
```

#### Scénarios d'Usage

1. **Scheduling → Messaging** : Quand un job s'exécute (ex: reminder), le scheduling service appelle le messaging service via gRPC pour envoyer la notification

2. **Messaging → Scheduling** : Quand un utilisateur veut programmer un message, le messaging service appelle le scheduling service via gRPC pour créer le job

#### Graceful Degradation

Les services sont conçus pour démarrer même si l'autre n'est pas disponible :
- Si le messaging service n'est pas disponible, les jobs échoueront mais seront automatiquement retentés
- Les logs détaillés permettent de suivre l'état de la connexion gRPC
- Les health checks incluent l'état des connexions aux services externes

## 🔧 Configuration

### Variables d'Environnement

| Variable | Description | Défaut |
|----------|-------------|---------|
| `PORT` | Port HTTP | 3000 |
| `GRPC_PORT` | Port gRPC server | 3001 |
| `GRPC_HOST` | Host gRPC server | 0.0.0.0 |
| `DATABASE_URL` | URL PostgreSQL | - |
| `REDIS_HOST` | Host Redis | localhost |
| `REDIS_PORT` | Port Redis | 6379 |
| `MESSAGING_SERVICE_HOST` | Host messaging service | localhost |
| `MESSAGING_SERVICE_PORT` | Port messaging service gRPC | 4001 |
| `NOTIFICATION_SERVICE_HOST` | Host notification service | localhost |
| `NOTIFICATION_SERVICE_PORT` | Port notification service gRPC | 4002 |
| `MAX_CONCURRENT_JOBS` | Jobs simultanés max | 100 |
| `DEFAULT_TIMEZONE` | Timezone par défaut | UTC |

### Catégories de Tâches

| Catégorie | Priorité | Timeout | Retries | Description |
|-----------|----------|---------|---------|-------------|
| `messaging` | HIGH | 30s | 3 | Tâches liées aux messages |
| `notifications` | HIGH | 15s | 5 | Notifications push |
| `maintenance` | MEDIUM | 600s | 2 | Maintenance système |
| `cleanup` | LOW | 300s | 2 | Nettoyage de données |
| `reports` | MEDIUM | 120s | 1 | Génération de rapports |
| `analytics` | LOW | 300s | 1 | Traitement analytics |

## 🛠️ Développement

### Commandes Utiles

```bash
# Développement
npm run start:dev          # Mode watch
npm run start:debug        # Mode debug

# Base de données
npm run db:generate        # Générer client Prisma
npm run db:migrate         # Exécuter migrations
npm run db:studio          # Interface DB Prisma Studio
npm run db:seed            # Initialiser données

# Tests
npm run test               # Tests unitaires
npm run test:watch         # Tests en mode watch
npm run test:cov           # Couverture de tests
npm run test:e2e           # Tests d'intégration

# Qualité de code
npm run lint               # ESLint
npm run format             # Prettier
npm run typecheck          # Vérification TypeScript
```

### Tests

```bash
# Tests unitaires
npm run test

# Tests avec couverture
npm run test:cov

# Tests d'intégration
npm run test:e2e
```

### Debugging

1. **Logs structurés** : Tous les logs incluent des métadonnées contextuelles
2. **Correlation IDs** : Traçage des requêtes à travers les services
3. **Health checks** : Monitoring en temps réel de tous les composants
4. **Métriques** : Collecte automatique de métriques de performance

## 🚀 Déploiement

### Docker

```bash
# Build de l'image
docker build -t whispr-scheduling-service .

# Démarrage avec docker-compose
docker-compose -f docker-compose.dev.yml up -d
```

### Kubernetes

Le service est conçu pour Kubernetes avec :
- **Service Mesh** : Istio avec mTLS automatique
- **Scaling** : HorizontalPodAutoscaler basé sur CPU/mémoire
- **Health checks** : Liveness et readiness probes
- **Configuration** : ConfigMaps et Secrets
- **Monitoring** : Integration Prometheus/Grafana

### Variables d'Environnement Production

```bash
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@db:5432/whispr_scheduling
REDIS_HOST=redis-cluster
ENABLE_METRICS=true
SWAGGER_ENABLED=false
CORS_ENABLED=false
```

## 📈 Monitoring

### Health Checks
- **Database** : Connexion PostgreSQL
- **Redis** : Connexion et latence
- **Queues** : État des files Bull Queue
- **Memory** : Utilisation mémoire Node.js
- **System** : Métriques système générales

### Métriques Collectées
- Nombre de jobs créés/exécutés
- Taux de succès par catégorie
- Latence d'exécution (P50, P95, P99)
- Taille des files d'attente
- Utilisation des ressources

### Alertes Recommandées
- Taux d'erreur > 5%
- Latence P95 > 5 secondes
- Files d'attente > 1000 jobs
- Utilisation mémoire > 80%
- Base de données inaccessible

## 🔒 Sécurité

### Mesures Implémentées
- **Rate limiting** : 100 req/min par IP
- **Validation stricte** : Tous les inputs validés
- **CORS configuré** : Selon l'environnement
- **Logging sécurisé** : Pas de données sensibles
- **Health checks** : Exposition minimale d'informations

### Communication Inter-Services
- **gRPC over mTLS** : Via Istio Service Mesh
- **Certificate rotation** : Automatique via SPIFFE
- **Network policies** : Trafic restreint
- **Service identity** : Vérification SPIFFE/SPIRE

## 📚 Exemples d'Usage

### Créer un Job de Notification avec Planification

```bash
# Étape 1: Créer le job
curl -X POST http://localhost:3000/api/v1/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Daily Reminder",
    "description": "Send daily reminder to user",
    "categoryId": "<messaging_category_id>",
    "targetService": "messaging",
    "targetMethod": "sendNotification",
    "payload": {
      "userId": "user-123",
      "message": "N'\''oubliez pas votre rendez-vous!",
      "conversationId": "conv-456",
      "type": 2,
      "metadata": {
        "source": "scheduler",
        "priority": "high"
      }
    },
    "priority": "HIGH",
    "maxRetries": 3,
    "timeoutSeconds": 30
  }'

# Réponse: { "id": "job-789", ... }

# Étape 2: Planifier le job
curl -X POST http://localhost:3000/api/v1/jobs/job-789/schedule \
  -H "Content-Type: application/json" \
  -d '{
    "scheduleType": "CRON",
    "cronExpression": "0 9 * * *",
    "timezone": "Europe/Paris"
  }'
```

### Envoyer un Message Programmé

```bash
# Créer un job pour envoyer un message à une date précise
curl -X POST http://localhost:3000/api/v1/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Scheduled Birthday Message",
    "categoryId": "<messaging_category_id>",
    "targetService": "messaging",
    "targetMethod": "sendScheduledMessage",
    "payload": {
      "conversationId": "conv-123",
      "senderId": "user-456",
      "messageType": 1,
      "content": "Joyeux anniversaire!",
      "metadata": {
        "occasion": "birthday"
      }
    },
    "priority": "MEDIUM"
  }'

# Planifier pour une date spécifique
curl -X POST http://localhost:3000/api/v1/jobs/<job-id>/schedule \
  -H "Content-Type: application/json" \
  -d '{
    "scheduleType": "ONCE",
    "scheduledAt": "2024-12-25T09:00:00Z",
    "timezone": "UTC"
  }'
```

### Vérifier l'État du Service

```bash
# Health check REST
curl http://localhost:3000/api/v1/monitoring/health

# Métriques
curl http://localhost:3000/api/v1/monitoring/metrics

# État des files d'attente
curl http://localhost:3000/api/v1/monitoring/queues
```

### Tester la Communication gRPC

Pour tester la communication gRPC entre les services, utilisez `grpcurl` :

```bash
# Installer grpcurl
# macOS: brew install grpcurl
# Linux: apt-get install grpcurl

# Lister les services disponibles
grpcurl -plaintext localhost:3001 list

# Appeler HealthCheck
grpcurl -plaintext localhost:3001 whispr.scheduler.SchedulerService/HealthCheck

# Créer un job via gRPC
grpcurl -plaintext -d '{
  "name": "Test Job",
  "categoryId": "cat-123",
  "targetService": "messaging",
  "targetMethod": "sendNotification",
  "payload": "{\"userId\":\"user-123\",\"message\":\"Test\"}",
  "priority": "MEDIUM"
}' localhost:3001 whispr.scheduler.SchedulerService/CreateJob
```

### Intégration depuis un Service Elixir (Messaging)

Exemple pour appeler le scheduling service depuis Elixir :

```elixir
# Dans votre service Elixir
defmodule WhisprMessaging.GrpcClients.SchedulingClient do
  @moduledoc """
  Client gRPC pour communiquer avec le Scheduling Service
  """

  def create_scheduled_message(user_id, message, conversation_id, scheduled_at) do
    # Créer le job
    job_request = %{
      name: "Scheduled Message",
      category_id: get_messaging_category_id(),
      target_service: "messaging",
      target_method: "sendScheduledMessage",
      payload: Jason.encode!(%{
        user_id: user_id,
        message: message,
        conversation_id: conversation_id
      }),
      priority: :HIGH
    }

    with {:ok, job} <- SchedulerService.Stub.create_job(channel(), job_request),
         schedule_request = %{
           job_id: job.id,
           schedule_type: :ONCE,
           scheduled_at: scheduled_at,
           timezone: "UTC"
         },
         {:ok, schedule} <- SchedulerService.Stub.schedule_job(channel(), schedule_request) do
      {:ok, schedule}
    end
  end

  defp channel do
    # Obtenir le channel gRPC configuré
    # En dev: localhost:3001
    # En prod: scheduling-service:50051
  end
end
```

## 🤝 Contributing

1. Fork le repository
2. Créer une branche feature (`git checkout -b feature/amazing-feature`)
3. Commit les changements (`git commit -m 'Add amazing feature'`)
4. Push vers la branche (`git push origin feature/amazing-feature`)
5. Ouvrir une Pull Request

### Standards de Code
- **TypeScript strict** : Mode strict activé
- **ESLint** : Configuration stricte
- **Prettier** : Formatage automatique
- **Tests obligatoires** : Couverture > 80%
- **Documentation** : JSDoc pour fonctions publiques

## 📝 License

Propriétaire - Whispr Team