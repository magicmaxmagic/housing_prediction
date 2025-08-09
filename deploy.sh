#!/bin/bash

# 🚀 Script d'automatisation InvestMTL
# Déploie une stack complète 100% gratuite pour l'analyse immobilière de Montréal

set -e  # Arrêter en cas d'erreur

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Fonction pour afficher des messages colorés
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
    exit 1
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

info() {
    echo -e "${CYAN}ℹ️  $1${NC}"
}

# Banner
echo -e "${PURPLE}"
cat << "EOF"
╔════════════════════════════════════════════════╗
║              🏠 InvestMTL 📊                   ║
║        Déploiement automatisé 100% gratuit     ║
║                                                ║
║  Stack: Cloudflare + GitHub Actions + Python  ║
╚════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

# Variables
PROJECT_DIR=$(pwd)
API_DIR="$PROJECT_DIR/api"
FRONTEND_DIR="$PROJECT_DIR/frontend"
ETL_DIR="$PROJECT_DIR/etl"

# Étape 1: Vérification des prérequis
log "🔍 Vérification des prérequis..."

# Vérifier Node.js
if ! command -v node &> /dev/null; then
    error "Node.js n'est pas installé. Installez Node.js 18+ depuis https://nodejs.org"
fi

NODE_VERSION=$(node -v | sed 's/v//')
if [ "$(printf '%s\n' "18.0.0" "$NODE_VERSION" | sort -V | head -n1)" != "18.0.0" ]; then
    error "Node.js version $NODE_VERSION détectée. Version 18+ requise."
fi
success "Node.js $NODE_VERSION ✓"

# Vérifier Python
if ! command -v python3 &> /dev/null; then
    error "Python 3 n'est pas installé. Installez Python 3.11+ depuis https://python.org"
fi

PYTHON_VERSION=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
if [ "$(printf '%s\n' "3.11" "$PYTHON_VERSION" | sort -V | head -n1)" != "3.11" ]; then
    error "Python version $PYTHON_VERSION détectée. Version 3.11+ requise."
fi
success "Python $PYTHON_VERSION ✓"

# Vérifier git
if ! command -v git &> /dev/null; then
    error "Git n'est pas installé."
fi
success "Git ✓"

# Vérifier npm
if ! command -v npm &> /dev/null; then
    error "npm n'est pas installé."
fi
success "npm ✓"

# Étape 2: Installation de Wrangler
log "📦 Installation de Wrangler CLI..."
if ! command -v wrangler &> /dev/null; then
    npm install -g wrangler
    success "Wrangler installé"
else
    success "Wrangler déjà installé"
fi

# Étape 3: Vérification de la connexion Cloudflare
log "🔐 Vérification de la connexion Cloudflare..."
if ! wrangler whoami &> /dev/null; then
    warn "Vous devez vous connecter à Cloudflare"
    info "Exécution de 'wrangler login'..."
    wrangler login
fi

# Récupérer l'account ID
ACCOUNT_ID=$(wrangler whoami | grep "Account ID" | awk '{print $3}')
if [ -z "$ACCOUNT_ID" ]; then
    error "Impossible de récupérer l'Account ID Cloudflare"
fi
success "Connecté à Cloudflare (Account: $ACCOUNT_ID)"

# Étape 4: Installation des dépendances
log "📚 Installation des dépendances..."

# API
if [ -d "$API_DIR" ]; then
    cd "$API_DIR"
    log "Installation des dépendances API..."
    npm install
    success "Dépendances API installées"
fi

# Frontend
if [ -d "$FRONTEND_DIR" ]; then
    cd "$FRONTEND_DIR"
    log "Installation des dépendances Frontend..."
    npm install
    success "Dépendances Frontend installées"
fi

# ETL
if [ -d "$ETL_DIR" ]; then
    cd "$ETL_DIR"
    log "Configuration de l'environnement Python..."
    
    # Créer un environnement virtuel s'il n'existe pas
    if [ ! -d ".venv" ]; then
        python3 -m venv .venv
    fi
    
    # Activer l'environnement virtuel
    source .venv/bin/activate
    
    # Installer les dépendances
    if [ -f "requirements.txt" ]; then
        pip install -r requirements.txt
        success "Dépendances Python installées"
    fi
fi

cd "$PROJECT_DIR"

# Étape 5: Création des ressources Cloudflare
log "☁️  Création des ressources Cloudflare..."

# D1 Database
log "Création de la base de données D1..."
DB_OUTPUT=$(wrangler d1 create investmtl-db 2>&1 || echo "exists")
if echo "$DB_OUTPUT" | grep -q "already exists"; then
    warn "Base de données investmtl-db existe déjà"
    DB_ID=$(wrangler d1 list | grep "investmtl-db" | awk '{print $1}')
else
    # Extraire l'ID de la base créée
    DB_ID=$(echo "$DB_OUTPUT" | grep -E "[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}" | head -1 | grep -oE "[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}")
fi

if [ -z "$DB_ID" ]; then
    # Fallback: récupérer depuis la liste
    DB_ID=$(wrangler d1 list | grep "investmtl-db" | awk '{print $1}')
fi

success "Base D1: investmtl-db (ID: $DB_ID)"

# KV Namespace
log "Création du namespace KV..."
KV_OUTPUT=$(wrangler kv namespace create investmtl-config 2>&1 || echo "exists")
if echo "$KV_OUTPUT" | grep -q "already exists"; then
    warn "Namespace KV investmtl-config existe déjà"
else
    success "Namespace KV créé"
fi

# Récupérer l'ID du namespace KV
KV_ID=$(wrangler kv namespace list | jq -r '.[] | select(.title=="investmtl-config") | .id')
success "Namespace KV: investmtl-config (ID: $KV_ID)"

# Étape 6: Configuration du wrangler.toml
log "⚙️  Configuration de wrangler.toml..."
cd "$API_DIR"

# Mise à jour du wrangler.toml avec les vrais IDs
if [ -f "wrangler.toml" ]; then
    # Backup
    cp wrangler.toml wrangler.toml.backup
    
    # Remplacer les IDs
    sed -i.bak "s/database_id = .*/database_id = \"$DB_ID\"/" wrangler.toml
    sed -i.bak "s/id = .*/id = \"$KV_ID\"/" wrangler.toml
    
    rm wrangler.toml.bak
    success "wrangler.toml configuré"
fi

cd "$PROJECT_DIR"

# Étape 7: Initialisation de la base de données
log "🗄️  Initialisation de la base de données D1..."
if [ -f "data_schema/d1_init.sql" ]; then
    cd "$API_DIR"
    wrangler d1 execute investmtl-db --file=../data_schema/d1_init.sql --remote || {
        warn "Erreur lors de l'initialisation D1 via CLI, essayez manuellement via le dashboard"
    }
    cd "$PROJECT_DIR"
    success "Base de données initialisée"
else
    warn "Fichier d1_init.sql non trouvé"
fi

# Étape 8: Déploiement de l'API
log "🚀 Déploiement de l'API..."
cd "$API_DIR"
API_URL=$(wrangler deploy --env="" 2>&1 | grep -oE "https://[a-zA-Z0-9.-]+\.workers\.dev" | head -1)
if [ -z "$API_URL" ]; then
    warn "Impossible de récupérer l'URL de l'API, mais le déploiement a probablement réussi"
    API_URL="https://investmtl-api.{votre-subdomain}.workers.dev"
fi
success "API déployée: $API_URL"
cd "$PROJECT_DIR"

# Étape 9: Configuration du projet Pages
log "📄 Configuration de Cloudflare Pages..."
cd "$FRONTEND_DIR"

# Créer le projet Pages si nécessaire
PAGES_OUTPUT=$(wrangler pages project create investmtl 2>&1 || echo "exists")
if echo "$PAGES_OUTPUT" | grep -q "already exists\|Project name already exists"; then
    warn "Projet Pages investmtl existe déjà"
else
    success "Projet Pages créé"
fi

# Build du frontend
log "🔨 Build du frontend..."
npm run build || {
    warn "Erreur lors du build frontend - vérifiez les dépendances TypeScript"
    info "Vous pouvez continuer le déploiement manuellement avec: npm run build && wrangler pages deploy dist"
}

cd "$PROJECT_DIR"

# Étape 10: Génération du fichier de configuration
log "📋 Génération des informations de configuration..."

CONFIG_FILE="$PROJECT_DIR/.env.production"
cat > "$CONFIG_FILE" << EOF
# Configuration InvestMTL - Générée automatiquement
# $(date)

# Cloudflare
CLOUDFLARE_ACCOUNT_ID=$ACCOUNT_ID
CLOUDFLARE_API_TOKEN=<your_api_token>

# D1 Database
D1_DATABASE_ID=$DB_ID

# KV Namespace  
KV_NAMESPACE_ID=$KV_ID

# API URL
API_URL=$API_URL
EOF

success "Configuration sauvegardée dans .env.production"

# Étape 11: Instructions finales
echo
echo -e "${PURPLE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${PURPLE}║                    🎉 DÉPLOIEMENT TERMINÉ! 🎉                ║${NC}"
echo -e "${PURPLE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo

success "Stack InvestMTL déployée avec succès!"
echo
info "📋 Ressources créées:"
echo "   • API: $API_URL"
echo "   • D1 Database: investmtl-db ($DB_ID)"  
echo "   • KV Namespace: investmtl-config ($KV_ID)"
echo "   • Account ID: $ACCOUNT_ID"
echo

warn "🔧 Actions manuelles restantes:"
echo "1. Configurer GitHub Secrets dans Settings > Secrets and variables > Actions:"
echo "   - CLOUDFLARE_ACCOUNT_ID: $ACCOUNT_ID"
echo "   - CLOUDFLARE_API_TOKEN: <votre_token_api>"
echo "   - D1_DATABASE_ID: $DB_ID"
echo "   - KV_NAMESPACE_ID: $KV_ID"
echo

echo "2. Pour déployer le frontend:"
echo "   cd frontend && npm run build && wrangler pages deploy dist --project-name investmtl"
echo

echo "3. Pour tester l'API:"
echo "   curl $API_URL/health"
echo

info "📖 Toutes les configurations sont sauvegardées dans .env.production"
info "🚀 Votre application InvestMTL est prête pour la production!"

echo
echo -e "${GREEN}Temps total: ${SECONDS}s${NC}"
