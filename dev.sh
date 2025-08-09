#!/bin/bash

# 🛠️ Script de développement local InvestMTL
# Configure et lance l'environnement de développement

set -e

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

log() { echo -e "${GREEN}[$(date +'%H:%M:%S')] $1${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }
info() { echo -e "${CYAN}ℹ️  $1${NC}"; }

echo -e "${PURPLE}"
cat << "EOF"
╔═══════════════════════════════════════╗
║        🛠️ InvestMTL Dev Setup 🛠️       ║
║     Environnement de développement    ║
╚═══════════════════════════════════════╝
EOF
echo -e "${NC}"

PROJECT_DIR=$(pwd)
API_DIR="$PROJECT_DIR/api"
FRONTEND_DIR="$PROJECT_DIR/frontend"
ETL_DIR="$PROJECT_DIR/etl"

# Fonction pour lancer les services
start_services() {
    log "🚀 Lancement des services de développement..."
    
    # Créer les fichiers de log
    mkdir -p logs
    
    # Lancer l'API en arrière-plan
    if [ -d "$API_DIR" ]; then
        log "Démarrage de l'API (port 8787)..."
        cd "$API_DIR"
        npm run dev > ../logs/api.log 2>&1 &
        API_PID=$!
        echo $API_PID > ../logs/api.pid
        cd "$PROJECT_DIR"
    fi
    
    # Attendre un peu pour l'API
    sleep 2
    
    # Lancer le frontend en arrière-plan
    if [ -d "$FRONTEND_DIR" ]; then
        log "Démarrage du frontend (port 5173)..."
        cd "$FRONTEND_DIR"
        npm run dev > ../logs/frontend.log 2>&1 &
        FRONTEND_PID=$!
        echo $FRONTEND_PID > ../logs/frontend.pid
        cd "$PROJECT_DIR"
    fi
    
    # Attendre que les services démarrent
    sleep 3
    
    info "Services lancés:"
    echo "  • API: http://localhost:8787"
    echo "  • Frontend: http://localhost:5173"
    echo "  • Logs: ./logs/"
    echo
    info "Commandes utiles:"
    echo "  • ./dev.sh stop    - Arrêter les services"
    echo "  • ./dev.sh logs    - Voir les logs"
    echo "  • ./dev.sh status  - Status des services"
}

# Fonction pour arrêter les services
stop_services() {
    log "🛑 Arrêt des services..."
    
    if [ -f "logs/api.pid" ]; then
        API_PID=$(cat logs/api.pid)
        kill $API_PID 2>/dev/null || true
        rm logs/api.pid
        info "API arrêtée"
    fi
    
    if [ -f "logs/frontend.pid" ]; then
        FRONTEND_PID=$(cat logs/frontend.pid)
        kill $FRONTEND_PID 2>/dev/null || true
        rm logs/frontend.pid
        info "Frontend arrêté"
    fi
    
    # Nettoyer les processus restants
    pkill -f "npm run dev" 2>/dev/null || true
    pkill -f "vite" 2>/dev/null || true
    pkill -f "wrangler dev" 2>/dev/null || true
}

# Fonction pour voir les logs
show_logs() {
    if [ -f "logs/api.log" ] && [ -f "logs/frontend.log" ]; then
        echo -e "${BLUE}=== Logs API ===${NC}"
        tail -20 logs/api.log
        echo
        echo -e "${BLUE}=== Logs Frontend ===${NC}"
        tail -20 logs/frontend.log
    else
        warn "Aucun log trouvé. Lancez d'abord './dev.sh start'"
    fi
}

# Fonction pour vérifier le status
check_status() {
    log "📊 Status des services:"
    
    # Vérifier l'API
    if [ -f "logs/api.pid" ]; then
        API_PID=$(cat logs/api.pid)
        if kill -0 $API_PID 2>/dev/null; then
            echo -e "  • API: ${GREEN}✅ Running${NC} (PID: $API_PID)"
            # Test de connexion
            if curl -s http://localhost:8787/health >/dev/null 2>&1; then
                echo -e "    └─ Endpoint: ${GREEN}✅ Accessible${NC}"
            else
                echo -e "    └─ Endpoint: ${YELLOW}⚠️ Non accessible${NC}"
            fi
        else
            echo -e "  • API: ${YELLOW}⚠️ Process mort${NC}"
        fi
    else
        echo -e "  • API: ${YELLOW}⚠️ Non démarré${NC}"
    fi
    
    # Vérifier le Frontend
    if [ -f "logs/frontend.pid" ]; then
        FRONTEND_PID=$(cat logs/frontend.pid)
        if kill -0 $FRONTEND_PID 2>/dev/null; then
            echo -e "  • Frontend: ${GREEN}✅ Running${NC} (PID: $FRONTEND_PID)"
            # Test de connexion
            if curl -s http://localhost:5173 >/dev/null 2>&1; then
                echo -e "    └─ Vite dev: ${GREEN}✅ Accessible${NC}"
            else
                echo -e "    └─ Vite dev: ${YELLOW}⚠️ Démarrage en cours...${NC}"
            fi
        else
            echo -e "  • Frontend: ${YELLOW}⚠️ Process mort${NC}"
        fi
    else
        echo -e "  • Frontend: ${YELLOW}⚠️ Non démarré${NC}"
    fi
}

# Setup initial
setup_dev() {
    log "⚙️  Configuration de l'environnement de développement..."
    
    # Vérifier les dépendances
    if [ -d "$API_DIR" ] && [ ! -d "$API_DIR/node_modules" ]; then
        log "Installation des dépendances API..."
        cd "$API_DIR" && npm install
        cd "$PROJECT_DIR"
    fi
    
    if [ -d "$FRONTEND_DIR" ] && [ ! -d "$FRONTEND_DIR/node_modules" ]; then
        log "Installation des dépendances Frontend..."
        cd "$FRONTEND_DIR" && npm install  
        cd "$PROJECT_DIR"
    fi
    
    if [ -d "$ETL_DIR" ] && [ ! -d "$ETL_DIR/.venv" ]; then
        log "Configuration de l'environnement Python..."
        cd "$ETL_DIR"
        python3 -m venv .venv
        source .venv/bin/activate
        pip install -r requirements.txt
        cd "$PROJECT_DIR"
    fi
    
    info "✅ Environnement de développement configuré"
}

# Tests
run_tests() {
    log "🧪 Exécution des tests..."
    
    # Tests API
    if [ -d "$API_DIR" ]; then
        cd "$API_DIR"
        if [ -f "package.json" ] && grep -q '"test"' package.json; then
            log "Tests API..."
            npm test || warn "Tests API échoués"
        fi
        cd "$PROJECT_DIR"
    fi
    
    # Tests Frontend
    if [ -d "$FRONTEND_DIR" ]; then
        cd "$FRONTEND_DIR"
        if [ -f "package.json" ] && grep -q '"test"' package.json; then
            log "Tests Frontend..."
            npm test || warn "Tests Frontend échoués"
        fi
        cd "$PROJECT_DIR"
    fi
    
    # Tests ETL
    if [ -d "$ETL_DIR" ]; then
        cd "$ETL_DIR"
        if [ -f "requirements.txt" ] && grep -q "pytest" requirements.txt; then
            log "Tests ETL..."
            source .venv/bin/activate
            python -m pytest tests/ || warn "Tests ETL échoués"
        fi
        cd "$PROJECT_DIR"
    fi
}

# Fonction d'aide
show_help() {
    echo -e "${CYAN}Usage: ./dev.sh <command>${NC}"
    echo
    echo "Commands:"
    echo "  setup   - Configuration initiale"
    echo "  start   - Démarrer les services"
    echo "  stop    - Arrêter les services" 
    echo "  restart - Redémarrer les services"
    echo "  status  - Vérifier le status"
    echo "  logs    - Afficher les logs"
    echo "  test    - Exécuter les tests"
    echo "  clean   - Nettoyer les logs et processus"
    echo "  help    - Afficher cette aide"
    echo
    echo "Exemples:"
    echo "  ./dev.sh setup && ./dev.sh start"
    echo "  ./dev.sh restart && ./dev.sh logs"
}

# Nettoyage
clean_dev() {
    log "🧹 Nettoyage..."
    stop_services
    rm -rf logs/
    info "Nettoyage terminé"
}

# Gestion des signaux
cleanup_on_exit() {
    echo
    log "🛑 Arrêt des services..."
    stop_services
    exit 0
}

trap cleanup_on_exit INT TERM

# Commande principale
case "${1:-start}" in
    "setup")
        setup_dev
        ;;
    "start")
        setup_dev
        start_services
        echo
        info "Services démarrés! Appuyez sur Ctrl+C pour arrêter."
        # Boucle pour garder le script actif
        while true; do
            sleep 1
        done
        ;;
    "stop")
        stop_services
        ;;
    "restart") 
        stop_services
        sleep 1
        start_services
        ;;
    "status")
        check_status
        ;;
    "logs")
        show_logs
        ;;
    "test")
        run_tests
        ;;
    "clean")
        clean_dev
        ;;
    "help"|"--help"|"-h")
        show_help
        ;;
    *)
        warn "Commande inconnue: $1"
        show_help
        exit 1
        ;;
esac
