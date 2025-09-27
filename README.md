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
- **Port** : `50051`
- **Package** : `whispr.scheduler`
- **Proto** : `src/modules/grpc/proto/scheduler.proto`

## 🔧 Configuration

### Variables d'Environnement

| Variable | Description | Défaut |
|----------|-------------|---------|
| `PORT` | Port HTTP | 3001 |
| `GRPC_PORT` | Port gRPC | 50051 |
| `DATABASE_URL` | URL PostgreSQL | - |
| `REDIS_HOST` | Host Redis | localhost |
| `REDIS_PORT` | Port Redis | 6379 |
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