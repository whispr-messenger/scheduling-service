#!/bin/bash

echo "⏰ Test du Scheduling Service"
echo "============================="

# Couleurs pour l'affichage
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration du service
SERVICE_NAME="Scheduling Service"
SERVICE_PORT=4005
BASE_URL="http://localhost:$SERVICE_PORT"

# Fonction pour tester un endpoint
test_endpoint() {
    local endpoint_name=$1
    local url=$2
    local expected_status=$3
    local method=${4:-GET}
    
    echo -n "  Testing $endpoint_name... "
    
    response=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "$url" 2>/dev/null)
    
    if [ "$response" = "$expected_status" ]; then
        echo -e "${GREEN}✅ OK${NC} (HTTP $response)"
        return 0
    else
        echo -e "${RED}❌ FAILED${NC} (HTTP $response, expected $expected_status)"
        return 1
    fi
}

# Fonction pour tester un endpoint avec authentification
test_auth_endpoint() {
    local endpoint_name=$1
    local url=$2
    
    echo -n "  Testing $endpoint_name auth... "
    
    # Test sans token (doit retourner 401)
    response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null)
    
    if [ "$response" = "401" ]; then
        echo -e "${GREEN}✅ AUTH OK${NC} (HTTP 401 - auth required)"
        return 0
    else
        echo -e "${YELLOW}⚠️  WARNING${NC} (HTTP $response, expected 401 for auth)"
        return 1
    fi
}

echo ""
echo -e "${BLUE}🔍 Vérification du service...${NC}"
echo ""

# Vérifier si le service est en cours d'exécution
if ! lsof -i :$SERVICE_PORT | grep LISTEN >/dev/null 2>&1; then
    echo -e "${RED}❌ Service not running on port $SERVICE_PORT${NC}"
    echo "Please start the service with: npm run start:dev"
    exit 1
else
    echo -e "${GREEN}✅ Service is running on port $SERVICE_PORT${NC}"
fi

echo ""
echo -e "${BLUE}🧪 Tests de connectivité...${NC}"
echo ""

# Tests des endpoints principaux
test_endpoint "API Documentation" "$BASE_URL/api/docs" "200"

echo ""
echo -e "${BLUE}🔐 Tests d'authentification...${NC}"
echo ""

# Tests des endpoints protégés
test_auth_endpoint "Jobs API" "$BASE_URL/api/v1/jobs"
test_auth_endpoint "Schedules API" "$BASE_URL/api/v1/schedules"

echo ""
echo -e "${BLUE}🗄️ Tests de base de données...${NC}"
echo ""

# Vérifier la base de données SQLite
if [ -f "./dev.db" ]; then
    echo -e "${GREEN}✅ Database file exists (dev.db)${NC}"
    
    # Vérifier la taille de la base de données
    db_size=$(stat -f%z "./dev.db" 2>/dev/null || stat -c%s "./dev.db" 2>/dev/null)
    if [ "$db_size" -gt 0 ]; then
        echo -e "${GREEN}✅ Database is not empty (${db_size} bytes)${NC}"
    else
        echo -e "${YELLOW}⚠️  Database file is empty${NC}"
    fi
else
    echo -e "${RED}❌ Database file not found (dev.db)${NC}"
fi

echo ""
echo -e "${BLUE}📊 Résumé du service...${NC}"
echo ""

echo "Service: $SERVICE_NAME"
echo "Port: $SERVICE_PORT"
echo "Base URL: $BASE_URL"
echo ""
echo "Endpoints disponibles:"
echo "  📚 API Docs: $BASE_URL/api/docs"
echo "  📋 Jobs: $BASE_URL/api/v1/jobs"
echo "  📅 Schedules: $BASE_URL/api/v1/schedules"
echo ""

# Afficher les informations du processus
echo "Processus en cours:"
lsof -i :$SERVICE_PORT | grep LISTEN

echo ""
echo "Base de données:"
if [ -f "./dev.db" ]; then
    ls -lh "./dev.db"
else
    echo "  ❌ dev.db not found"
fi

echo ""
echo -e "${BLUE}🔧 Informations de développement...${NC}"
echo ""

# Vérifier les erreurs TypeScript (si disponibles)
echo "État de compilation TypeScript:"
if [ -f "./dist/main.js" ]; then
    echo -e "${GREEN}✅ Service compiled successfully${NC}"
else
    echo -e "${YELLOW}⚠️  Compiled files not found in ./dist/${NC}"
fi

echo ""
echo -e "${GREEN}✨ Tests du Scheduling Service terminés !${NC}"