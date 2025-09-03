# Scheduling Service - Whispr Messenger

Le service de planification de l'écosystème Whispr, responsable de l'exécution automatisée de toutes les tâches programmées, des messages différés aux tâches de maintenance système.

## 🏗️ Architecture

### Vue d'ensemble
- **Framework**: NestJS avec TypeScript
- **Base de données**: PostgreSQL avec Prisma ORM
- **Queue System**: Redis + Bull Queue
- **Scheduler**: @nestjs/schedule avec node-cron
- **Communication**: REST APIs + gRPC (futur)
- **Service Mesh**: Prêt pour Istio (production)

### Types de tâches gérées
- 📧 **Messages programmés**: Envoi de messages à heure précise
- 🔔 **Notifications différées**: Rappels et notifications planifiées  
- 🔧 **Maintenance système**: Nettoyage DB, optimisation, sauvegardes
- 🗑️ **Nettoyage automatique**: Suppression de données expirées
- 📊 **Rapports analytics**: Génération automatique de rapports

## 🚀 Installation

### Prérequis
- Node.js 18+
- Docker & Docker Compose
- PostgreSQL 15+
- Redis 7+

### Développement local

1. **Cloner le projet**
```bash
git clone <repository-url>
cd scheduling-service
```

2. **Installer les dépendances**
```bash
npm install
```

3. **Configuration**
```bash
cp .env.example .env
# Modifier les variables d'environnement selon vos besoins
```

4. **Lancer les services avec Docker Compose**
```bash
# Lancement complet (PostgreSQL + Redis + Service)
docker-compose up -d

# Ou uniquement les dépendances pour développement local
docker-compose up -d postgres redis
```

5. **Migrations et seed de la base de données**
```bash
# Générer le client Prisma
npm run prisma:generate

# Appliquer les migrations
npm run prisma:migrate

# Initialiser avec des données de test
npx prisma db seed
```

6. **Lancer le service en développement**
```bash
npm run start:dev
```

### Production avec Docker

```bash
# Build et lancement
docker-compose -f docker-compose.yml up -d

# Vérifier le statut
docker-compose ps
```

## 🔧 Configuration

### Variables d'environnement principales

```bash
# Base de données
DATABASE_URL="postgresql://username:password@localhost:5432/scheduling_service"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Service
NODE_ENV=development
PORT=3000
JWT_SECRET=your-jwt-secret
LOG_LEVEL=info

# Scheduler
SCHEDULER_TIMEZONE=UTC
SCHEDULER_MAX_CONCURRENT_JOBS=10
QUEUE_CONCURRENCY=10

# Services externes (pour gRPC)
MESSAGING_SERVICE_URL=messaging-service:50051
NOTIFICATION_SERVICE_URL=notification-service:50051
```

## 📚 APIs REST

### Documentation
- **Swagger UI**: http://localhost:3000/api/docs
- **Health Check**: http://localhost:3000/api/v1/health

### Endpoints principaux

#### Jobs
```bash
# Créer une tâche
POST /api/v1/jobs
{
  "name": "Send Birthday Reminder",
  "categoryId": "uuid",
  "targetService": "notification-service",
  "targetMethod": "SendDelayedNotification",
  "payload": { "userId": "123", "message": "Happy Birthday!" },
  "priority": "HIGH"
}

# Lister les tâches
GET /api/v1/jobs?page=1&limit=20&categoryId=uuid

# Détails d'une tâche
GET /api/v1/jobs/{id}
```

#### Planifications
```bash
# Créer une planification
POST /api/v1/schedules/job/{jobId}
{
  "scheduleType": "CRON",
  "cronExpression": "0 9 * * *",
  "timezone": "Europe/Paris"
}

# Planifications actives
GET /api/v1/schedules/active
```

## 🔄 Types de planification

### 1. Cron
```json
{
  "scheduleType": "CRON",
  "cronExpression": "0 9 * * 1-5",
  "timezone": "Europe/Paris"
}
```

### 2. Intervalle
```json
{
  "scheduleType": "INTERVAL", 
  "intervalSeconds": 3600
}
```

### 3. Unique
```json
{
  "scheduleType": "ONCE",
  "scheduledAt": "2024-12-25T09:00:00Z",
  "timezone": "UTC"
}
```

### 4. Immédiate
```json
{
  "scheduleType": "IMMEDIATE"
}
```

## 📊 Monitoring

### Health Checks
```bash
# Santé globale
GET /api/v1/health

# Spécifique base de données
GET /api/v1/health/database

# Spécifique Redis
GET /api/v1/health/redis
```

### Bull Dashboard
En développement: http://localhost:4000 (avec profil `dev`)

```bash
docker-compose --profile dev up bull-dashboard
```

### Métriques
- Nombre de tâches actives
- Statistiques des queues
- Taux de succès/échec
- Performance d'exécution

## 🗃️ Modèle de données

### Entités principales
- **Job**: Définition des tâches
- **Schedule**: Planifications des tâches  
- **Execution**: Historique d'exécution
- **JobCategory**: Catégories de tâches
- **ExecutionLog**: Logs détaillés

### Catégories par défaut
- `messaging`: Messages programmés
- `notifications`: Notifications différées
- `maintenance`: Maintenance système
- `cleanup`: Nettoyage automatique
- `reports`: Génération de rapports
- `analytics`: Traitement analytique

## 🔐 Sécurité

### Authentification
- JWT Bearer tokens
- Rate limiting par endpoint
- Validation stricte des données

### Isolation
- Queues séparées par priorité
- Workers isolés par type de tâche
- Timeouts et limites de ressources

### Audit
- Traçabilité complète des exécutions
- Logs structurés avec correlation IDs
- Rétention configurable

## 🧪 Tests

```bash
# Tests unitaires
npm run test

# Tests d'intégration
npm run test:e2e

# Coverage
npm run test:cov
```

## 🚀 Déploiement

### Production

1. **Build Docker**
```bash
docker build -t whispr/scheduling-service:latest .
```

2. **Variables d'environnement sécurisées**
```bash
# Utiliser des secrets managers
JWT_SECRET=<secure-random-key>
DATABASE_URL=<production-db-url>
REDIS_PASSWORD=<secure-redis-password>
```

3. **Déploiement Kubernetes** (exemple)
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: scheduling-service
spec:
  replicas: 2
  selector:
    matchLabels:
      app: scheduling-service
  template:
    metadata:
      labels:
        app: scheduling-service
    spec:
      containers:
      - name: scheduling-service
        image: whispr/scheduling-service:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
```

### Istio Service Mesh (Production)
Le service est prêt pour l'intégration Istio avec:
- mTLS automatique
- Policies d'autorisation
- Observabilité distribuée
- Circuit breakers

## 📝 Logs

### Format structuré
```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "info",
  "message": "Job executed successfully",
  "context": "JobService",
  "correlationId": "req-123-456",
  "jobId": "job-789",
  "duration": 150
}
```

### Niveaux de log
- `debug`: Détails d'exécution
- `info`: Opérations normales
- `warn`: Situations anormales non critiques
- `error`: Erreurs récupérables
- `fatal`: Erreurs critiques

## 🔄 Backup et Recovery

### Base de données
```bash
# Backup automatique quotidien (dans la tâche maintenance)
pg_dump scheduling_service > backup_$(date +%Y%m%d).sql

# Restore
psql scheduling_service < backup_20240115.sql
```

### État des queues Redis
Les queues Bull sont persistantes et surviennent aux redémarrages.

## 🤝 Contribution

1. Fork le projet
2. Créer une branche feature (`git checkout -b feature/amazing-feature`)
3. Commit les changements (`git commit -m 'Add amazing feature'`)
4. Push sur la branche (`git push origin feature/amazing-feature`)
5. Ouvrir une Pull Request

## 📄 License

Ce projet fait partie de l'écosystème Whispr Messenger.

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/whispr/scheduling-service/issues)
- **Documentation**: [Wiki](https://github.com/whispr/scheduling-service/wiki)
- **Chat**: Canal #scheduling sur Discord

---

## 📋 Checklist Post-Installation

- [ ] Service démarre sans erreur
- [ ] Base de données connectée (`GET /api/v1/health/database`)
- [ ] Redis connecté (`GET /api/v1/health/redis`)
- [ ] Catégories de jobs créées
- [ ] API documentation accessible
- [ ] Logs structurés fonctionnels
- [ ] Tests passent (`npm test`)

**🎉 Votre service de scheduling Whispr est prêt !**