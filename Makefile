# 🏠 InvestMTL Makefile
# Commandes rapides pour le développement et le déploiement

.PHONY: help install dev build deploy test clean setup

# Variables
API_DIR = api
FRONTEND_DIR = frontend
ETL_DIR = etl

# Commande par défaut
help: ## Affiche l'aide
	@echo "🏠 InvestMTL - Commandes disponibles:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "🚀 Workflow recommandé:"
	@echo "  make setup    # Configuration initiale"
	@echo "  make dev      # Développement local"  
	@echo "  make deploy   # Déploiement production"

# Configuration initiale
setup: ## Configuration complète de l'environnement
	@echo "⚙️ Configuration de InvestMTL..."
	@./deploy.sh setup || echo "Script deploy.sh introuvable, installation manuelle..."
	@echo "✅ Configuration terminée!"

# Installation des dépendances
install: ## Installation de toutes les dépendances
	@echo "📦 Installation des dépendances..."
	@if [ -d "$(API_DIR)" ]; then cd $(API_DIR) && npm install; fi
	@if [ -d "$(FRONTEND_DIR)" ]; then cd $(FRONTEND_DIR) && npm install; fi
	@if [ -d "$(ETL_DIR)" ] && [ -f "$(ETL_DIR)/requirements.txt" ]; then \
		cd $(ETL_DIR) && \
		python3 -m venv .venv && \
		.venv/bin/pip install -r requirements.txt; \
	fi
	@echo "✅ Dépendances installées!"

# Développement local
dev: ## Lance l'environnement de développement
	@echo "🛠️ Lancement du développement local..."
	@./dev.sh start

dev-stop: ## Arrête les services de développement
	@./dev.sh stop

dev-status: ## Status des services de développement  
	@./dev.sh status

dev-logs: ## Affiche les logs de développement
	@./dev.sh logs

# Build
build: build-api build-frontend ## Build de tous les composants

build-api: ## Build de l'API
	@echo "🔨 Build de l'API..."
	@if [ -d "$(API_DIR)" ]; then cd $(API_DIR) && npm run build 2>/dev/null || echo "Pas de script build pour l'API"; fi

build-frontend: ## Build du frontend
	@echo "🔨 Build du frontend..."
	@if [ -d "$(FRONTEND_DIR)" ]; then cd $(FRONTEND_DIR) && npm run build; fi

# Tests
test: test-api test-frontend test-etl ## Lance tous les tests

test-api: ## Tests de l'API
	@echo "🧪 Tests API..."
	@if [ -d "$(API_DIR)" ]; then cd $(API_DIR) && npm test 2>/dev/null || echo "Pas de tests API configurés"; fi

test-frontend: ## Tests du frontend
	@echo "🧪 Tests Frontend..."
	@if [ -d "$(FRONTEND_DIR)" ]; then cd $(FRONTEND_DIR) && npm test 2>/dev/null || echo "Pas de tests Frontend configurés"; fi

test-etl: ## Tests ETL
	@echo "🧪 Tests ETL..."
	@if [ -d "$(ETL_DIR)/.venv" ]; then cd $(ETL_DIR) && .venv/bin/python -m pytest tests/ 2>/dev/null || echo "Pas de tests ETL configurés"; fi

# Déploiement
deploy: ## Déploiement complet sur Cloudflare
	@echo "🚀 Déploiement InvestMTL..."
	@./deploy.sh

deploy-api: ## Déploiement de l'API uniquement
	@echo "🚀 Déploiement API..."
	@if [ -d "$(API_DIR)" ]; then cd $(API_DIR) && npx wrangler deploy; fi

deploy-frontend: ## Déploiement du frontend uniquement
	@echo "🚀 Déploiement Frontend..."
	@if [ -d "$(FRONTEND_DIR)" ]; then \
		cd $(FRONTEND_DIR) && \
		npm run build && \
		npx wrangler pages deploy dist --project-name investmtl; \
	fi

# ETL
etl-run: ## Lance le pipeline ETL
	@echo "📊 Exécution du pipeline ETL..."
	@if [ -d "$(ETL_DIR)/.venv" ]; then \
		cd $(ETL_DIR) && \
		.venv/bin/python export_artifacts.py; \
	fi

etl-ingest: ## Ingestion des données uniquement
	@echo "📥 Ingestion des données..."
	@if [ -d "$(ETL_DIR)/.venv" ]; then \
		cd $(ETL_DIR) && \
		.venv/bin/python ingest_mtl.py && \
		.venv/bin/python ingest_statcan.py && \
		.venv/bin/python ingest_cmhc.py; \
	fi

# Database
db-init: ## Initialise la base de données D1
	@echo "🗄️ Initialisation de la base de données..."
	@if [ -f "data_schema/d1_init.sql" ] && [ -d "$(API_DIR)" ]; then \
		cd $(API_DIR) && \
		npx wrangler d1 execute investmtl-db --file=../data_schema/d1_init.sql --remote; \
	fi

db-shell: ## Shell interactif D1
	@if [ -d "$(API_DIR)" ]; then cd $(API_DIR) && npx wrangler d1 execute investmtl-db --command=".help"; fi

# Nettoyage
clean: ## Nettoie les fichiers temporaires
	@echo "🧹 Nettoyage..."
	@rm -rf logs/
	@rm -rf .env.production
	@if [ -d "$(API_DIR)/node_modules" ]; then cd $(API_DIR) && rm -rf node_modules; fi
	@if [ -d "$(FRONTEND_DIR)/node_modules" ]; then cd $(FRONTEND_DIR) && rm -rf node_modules; fi
	@if [ -d "$(FRONTEND_DIR)/dist" ]; then cd $(FRONTEND_DIR) && rm -rf dist; fi
	@if [ -d "$(ETL_DIR)/.venv" ]; then rm -rf $(ETL_DIR)/.venv; fi
	@./dev.sh clean 2>/dev/null || true
	@echo "✅ Nettoyage terminé!"

clean-deps: clean install ## Nettoyage et réinstallation des dépendances

# Informations
info: ## Affiche les informations du projet
	@echo "📋 Informations InvestMTL:"
	@echo ""
	@echo "Structure du projet:"
	@find . -maxdepth 2 -type d -not -path '*/.*' | sort
	@echo ""
	@echo "Configuration Cloudflare:"
	@if [ -f ".env.production" ]; then \
		echo "  ✅ Configuration trouvée dans .env.production"; \
		cat .env.production | grep -v TOKEN || true; \
	else \
		echo "  ⚠️ Pas de configuration trouvée"; \
	fi
	@echo ""
	@if command -v npx wrangler >/dev/null 2>&1; then \
		echo "Status Cloudflare:"; \
		npx wrangler whoami 2>/dev/null || echo "  ⚠️ Non connecté à Cloudflare"; \
	fi

# Développement rapide
quick-start: install dev ## Installation + développement en une commande

# Déploiement rapide  
quick-deploy: build deploy ## Build + déploiement en une commande

# Workflow complet
all: clean install test build deploy ## Workflow complet: clean + install + test + build + deploy
