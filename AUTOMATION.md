# 🚀 Scripts d'Automatisation InvestMTL

Ce document décrit les scripts d'automatisation disponibles pour simplifier le développement et le déploiement de InvestMTL.

## 📋 Scripts Disponibles

### 1. `deploy.sh` - Déploiement Automatisé
**Usage**: `./deploy.sh`

Script principal pour déployer InvestMTL sur Cloudflare avec une configuration 100% gratuite.

**Fonctionnalités**:
- ✅ Vérification des prérequis (Node.js, Python, Git)
- ✅ Installation automatique de Wrangler CLI  
- ✅ Connexion et vérification Cloudflare
- ✅ Installation des dépendances (API, Frontend, ETL)
- ✅ Création des ressources Cloudflare (D1, KV)
- ✅ Configuration automatique du `wrangler.toml`
- ✅ Initialisation de la base de données D1
- ✅ Déploiement de l'API sur Workers
- ✅ Génération du fichier de configuration `.env.production`

**Exemple**:
```bash
chmod +x deploy.sh
./deploy.sh
```

### 2. `dev.sh` - Environnement de Développement
**Usage**: `./dev.sh <command>`

Script pour gérer l'environnement de développement local.

**Commandes disponibles**:
- `setup` - Configuration initiale
- `start` - Démarrer les services (API + Frontend)
- `stop` - Arrêter les services
- `restart` - Redémarrer les services  
- `status` - Vérifier le status des services
- `logs` - Afficher les logs
- `test` - Exécuter tous les tests
- `clean` - Nettoyer les logs et processus

**Exemples**:
```bash
chmod +x dev.sh

# Configuration et démarrage
./dev.sh setup
./dev.sh start

# Vérification du status
./dev.sh status

# Affichage des logs
./dev.sh logs

# Arrêt des services
./dev.sh stop
```

### 3. `Makefile` - Commandes Rapides
**Usage**: `make <command>`

Interface unifiée pour toutes les opérations courantes.

**Commandes principales**:
```bash
make help           # Aide
make setup          # Configuration complète
make dev            # Développement local
make build          # Build de tous les composants
make test           # Tests complets
make deploy         # Déploiement production
make clean          # Nettoyage

# Commandes spécifiques
make build-api      # Build API uniquement
make build-frontend # Build Frontend uniquement
make deploy-api     # Déploiement API uniquement
make deploy-frontend# Déploiement Frontend uniquement
make etl-run        # Pipeline ETL
make db-init        # Initialisation D1
```

## 🏃‍♂️ Workflows Recommandés

### Premier Déploiement
```bash
# 1. Configuration et déploiement complet
make setup
make deploy

# OU directement avec le script
./deploy.sh
```

### Développement Local
```bash
# 1. Setup et démarrage
make dev
# OU
./dev.sh start

# 2. Dans un autre terminal - vérifier le status
./dev.sh status

# 3. Voir les logs en temps réel
./dev.sh logs

# 4. Tests
make test

# 5. Arrêt
./dev.sh stop
```

### Déploiement Rapide
```bash
# Build + déploiement
make quick-deploy

# OU séparé
make build
make deploy
```

### Pipeline ETL
```bash
# Pipeline complet
make etl-run

# OU ingestion seulement
make etl-ingest
```

## ⚙️ Configuration

### Variables d'Environnement
Les scripts génèrent automatiquement `.env.production` avec :
```bash
CLOUDFLARE_ACCOUNT_ID=votre_account_id
D1_DATABASE_ID=votre_database_id  
KV_NAMESPACE_ID=votre_kv_id
API_URL=votre_api_url
```

### GitHub Secrets
Configurez manuellement dans GitHub Settings > Secrets :
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID` 
- `D1_DATABASE_ID`
- `KV_NAMESPACE_ID`

## 🐛 Dépannage

### Problèmes Courants

**1. Erreur de connexion Cloudflare**
```bash
# Reconnexion
wrangler logout
wrangler login
./deploy.sh
```

**2. Dépendances manquantes**
```bash
# Réinstallation complète
make clean-deps
```

**3. Services de dev bloqués**
```bash
# Nettoyage forcé
./dev.sh clean
pkill -f "npm run dev"
```

**4. Base de données D1 non initialisée**
```bash
# Initialisation manuelle
make db-init
```

### Logs et Debugging

**Logs de développement** : `./logs/`
- `api.log` - Logs de l'API
- `frontend.log` - Logs du frontend

**Status des services** :
```bash
./dev.sh status
```

**Tests de connectivité** :
```bash
# API local
curl http://localhost:8787/health

# API production
curl https://votre-api.workers.dev/health
```

## 🔄 Structure des Scripts

### `deploy.sh`
```
Vérifications → Installation → Cloudflare → Déploiement → Configuration
     ↓              ↓            ↓           ↓            ↓
  Prérequis     Dépendances   D1 + KV    Workers API   .env.production
```

### `dev.sh`
```
Setup → Start → Monitor → Stop
  ↓       ↓        ↓       ↓
Config   API+UI   Logs   Cleanup
```

### Makefile
```
Commandes haut niveau → Scripts spécialisés → Actions atomiques
```

## 💡 Conseils d'Utilisation

1. **Premier déploiement** : Utilisez `./deploy.sh` pour tout configurer d'un coup
2. **Développement** : Utilisez `./dev.sh start` pour l'environnement local  
3. **CI/CD** : Utilisez les commandes `make` dans GitHub Actions
4. **Debug** : Utilisez `./dev.sh status` et `./dev.sh logs` pour diagnostiquer
5. **Nettoyage** : Utilisez `make clean` en cas de problème

## 📚 Ressources

- **Documentation Cloudflare Workers** : https://developers.cloudflare.com/workers/
- **Documentation Wrangler** : https://developers.cloudflare.com/workers/wrangler/
- **Limits Cloudflare Free** : https://developers.cloudflare.com/workers/platform/limits/

---

**Ces scripts automatisent entièrement le workflow InvestMTL ! 🚀**
