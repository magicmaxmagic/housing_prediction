# InvestMTL 🏠📊

**Analyse d'investissement immobilier à Montréal** - Une application full-stack qui utilise des données ouvertes et des modèles prédictifs pour identifier les meilleures opportunités d'investissement immobilier dans les quartiers de Montréal.

[![Deploy Status](https://github.com/yourusername/investmtl/workflows/Deploy%20to%20Production/badge.svg)](https://github.com/yourusername/investmtl/actions)
[![ETL Pipeline](https://github.com/yourusername/investmtl/workflows/ETL%20Pipeline/badge.svg)](https://github.com/yourusername/investmtl/actions)

## 🎯 Fonctionnalités

- **Carte interactive** de Montréal avec scores d'investissement par arrondissement
- **Analyse multi-critères** : croissance, offre, tension du marché, accessibilité, rendement
- **Prévisions automatisées** des loyers et taux d'inoccupation (1-24 mois)
- **Comparaison d'arrondissements** avec graphiques et métriques détaillées
- **Interface responsive** optimisée mobile et desktop
- **Données temps réel** mises à jour quotidiennement via pipeline ETL

## 🏗️ Architecture

### Frontend (Cloudflare Pages)
- **React 18** + **TypeScript** + **Vite**
- **Tailwind CSS** + **shadcn/ui** pour l'interface
- **MapLibre GL** pour la visualisation géographique
- **Recharts** pour les graphiques et visualisations

### Backend (Cloudflare Workers)
- **API REST** avec **Hono** framework
- **TypeScript** avec validation de schémas
- Rate limiting et CORS configurés
- Intégration **D1** (base de données) et **KV** (cache/config)

### ETL Pipeline (GitHub Actions + Python)
- **Python 3.11** avec **pandas**, **scikit-learn**, **XGBoost**
- Ingestion automatisée depuis sources ouvertes (Montréal, StatCan, CMHC)
- **Feature engineering** et modèles prédictifs avec **SHAP** explainability
- Export vers **Cloudflare D1** (SQLite) et **GitHub Releases** (artifacts JSON)

### Infrastructure (100% Free Tiers)
- **Cloudflare Pages** : Hébergement frontend
- **Cloudflare Workers** : API serverless
- **Cloudflare D1** : Base de données SQLite (stockage des données transformées)
- **Cloudflare KV** : Cache et configuration
- **GitHub Actions** : CI/CD et ETL automatisé
- **GitHub Releases** : Stockage des artifacts ETL (JSON/CSV)

## 🚀 Démarrage rapide

**⚡ Déploiement en une commande :**
```bash
./deploy.sh  # Configure et déploie tout automatiquement !
```

**🛠️ Développement local :**  
```bash
./dev.sh start  # Lance API + Frontend en local
```

**📋 Toutes les commandes :**
```bash
make help  # Voir toutes les options disponibles
```

> 📖 **Voir [AUTOMATION.md](AUTOMATION.md) pour le guide détaillé des scripts**

### Prérequis
- Node.js 18+
- Python 3.11+
- Compte Cloudflare (gratuit)
- Compte GitHub (gratuit)

### 1. Clone et installation
```bash
git clone https://github.com/yourusername/investmtl.git
cd investmtl

# Installation API
cd api && npm install && cd ..

# Installation frontend
cd frontend && npm install && cd ..

# Installation ETL
cd etl && pip install -r requirements.txt && cd ..
```

### 2. Configuration Cloudflare
```bash
# Installation Wrangler CLI
npm install -g wrangler

# Login Cloudflare
wrangler login

# Création des ressources Cloudflare
# Note: Vérifiez d'abord si les ressources existent déjà
wrangler d1 list  # Vérifier les bases existantes
wrangler kv namespace list  # Vérifier les namespaces KV

# Créer uniquement si nécessaire
wrangler d1 create investmtl-db  # Créer si n'existe pas
wrangler kv namespace create investmtl-config  # Créer si n'existe pas

# Pas besoin de R2 - on utilise GitHub Releases pour le stockage
# Alternative via dashboard Cloudflare:
# 1. Aller sur dash.cloudflare.com
# 2. D1 Database > Create database > "investmtl-db" 
# 3. Workers KV > Create namespace > "investmtl-config"

# Pages pour le frontend
cd ../frontend && wrangler pages create investmtl
```

### 3. Configuration des secrets
```bash
# GitHub Secrets à configurer
CF_ACCOUNT_ID=your_cloudflare_account_id
CF_API_TOKEN=your_cloudflare_api_token
CF_D1_DATABASE_ID=your_database_id
CF_KV_NAMESPACE_ID=your_kv_namespace_id
```

### 4. Déploiement initial
```bash
# Initialisation base de données
# Option 1: Via CLI (si wrangler fonctionne)
cd api && wrangler d1 execute investmtl-db --file=../data_schema/d1_init.sql

# Option 2: Via dashboard Cloudflare
# 1. Aller sur dash.cloudflare.com > D1 Database
# 2. Cliquer sur votre base "investmtl-db"
# 3. Onglet "Console" > coller le contenu de data_schema/d1_init.sql

# Déploiement API
wrangler deploy

# Build et déploiement frontend  
cd ../frontend
npm run build
wrangler pages deploy dist --project-name investmtl

# Premier run ETL (optionnel - sinon automatique daily)
cd ../etl && python export_artifacts.py
```

## 📊 Sources de données

### Données ouvertes utilisées
- **Ville de Montréal** : Permis construction, données cadastrales, transport
- **Statistique Canada** : Données démographiques, revenus, emploi
- **SCHL/CMHC** : Taux d'inoccupation, mises en chantier, loyers moyens

### Métriques calculées
1. **Score de croissance** (25%) : Appréciation historique + projections démographiques
2. **Score d'offre** (20%) : Nouvelles constructions vs demande
3. **Score de tension** (20%) : Ratio offre/demande, temps sur le marché
4. **Score d'accessibilité** (20%) : Transport public, services, emplois
5. **Score de rendement** (15%) : Ratio loyer/prix d'achat estimé

## 🔄 Pipeline ETL

Le pipeline ETL s'exécute quotidiennement à 6h UTC via GitHub Actions :

1. **Ingestion** (`ingest_*.py`) : Collecte des données depuis les APIs ouvertes
2. **Features** (`features.py`) : Engineering et nettoyage des données
3. **Forecast** (`forecast.py`) : Génération des prévisions 1-24 mois
4. **Scoring** (`score.py`) : Calcul des scores d'investissement pondérés
5. **Export** (`export_artifacts.py`) : Sauvegarde vers Cloudflare D1/KV et GitHub Releases

## 🛠️ Développement

### Développement local
```bash
# API développement
cd api && npm run dev
# → http://localhost:8787

# Frontend développement
cd frontend && npm run dev
# → http://localhost:5173

# ETL test
cd etl && python -m pytest tests/
```

### Structure du projet
```
investmtl/
├── api/                    # Cloudflare Workers API
│   ├── src/
│   │   ├── index.ts       # Point d'entrée
│   │   ├── routes/        # Endpoints REST
│   │   └── lib/          # Utilitaires
│   └── wrangler.toml      # Config Cloudflare
├── frontend/               # React frontend
│   ├── src/
│   │   ├── components/    # Composants React
│   │   ├── lib/          # Client API, utils
│   │   └── styles/       # Tailwind CSS
│   └── package.json
├── etl/                    # Pipeline ETL Python
│   ├── ingest_*.py       # Scripts d'ingestion
│   ├── features.py       # Feature engineering
│   ├── forecast.py       # Modèles prédictifs
│   ├── score.py          # Calcul des scores
│   └── export_artifacts.py
├── data_schema/           # Schémas de données
│   └── d1_init.sql       # Init base de données
└── .github/workflows/     # CI/CD GitHub Actions
    ├── etl.yml           # Pipeline ETL quotidien
    └── deploy.yml        # Déploiement production
```

## 📈 Roadmap

- [ ] **v1.1** : Alertes email pour nouvelles opportunités
- [ ] **v1.2** : Analyse des prix de vente (pas seulement loyers)
- [ ] **v1.3** : Intégration données Airbnb/location court terme
- [ ] **v1.4** : Calculateur ROI avec simulations fiscales
- [ ] **v1.5** : Export rapports PDF personnalisés

## 🤝 Contribution

Les contributions sont bienvenues ! Pour contribuer :

1. Fork le projet
2. Créer une branche feature (`git checkout -b feature/AmazingFeature`)
3. Commit les changements (`git commit -m 'Add AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

## 📄 Licence

Ce projet est sous licence MIT. Voir [LICENSE](LICENSE) pour plus de détails.

## 🙏 Remerciements

- [Ville de Montréal](https://donnees.montreal.ca/) pour les données ouvertes
- [Statistique Canada](https://www.statcan.gc.ca/) pour les données démographiques  
- [Cloudflare](https://cloudflare.com/) pour l'infrastructure gratuite
- [MapLibre](https://maplibre.org/) pour les cartes open source

---

**InvestMTL** - Trouvez les meilleures opportunités d'investissement immobilier à Montréal 🚀

Application 100% gratuite pour évaluer où investir à Montréal selon la croissance, l'offre future de logements et les prévisions. Utilise uniquement des données ouvertes et des services gratuits.

## 🏗️ Architecture

- **Frontend**: React + Vite + TypeScript + Tailwind + shadcn/ui + MapLibre GL
- **Backend**: Cloudflare Workers + Hono + TypeScript  
- **Données**: Cloudflare D1 (SQLite) + KV (cache) + GitHub Releases (artifacts)
- **ETL/ML**: Python + DuckDB + pandas + scikit-learn + XGBoost
- **CI/CD**: GitHub Actions
- **Hébergement**: Cloudflare Pages + Workers

## 📊 Sources de données

- **Ville de Montréal**: Permis de construction, zonage, infrastructures
- **Statistique Canada**: Population, ménages, revenus par zone
- **CMHC/SCHL**: Vacance, loyers, mises en chantier
- **OpenStreetMap**: Points d'intérêt (écoles, commerces, parcs)
- **GTFS STM/EXO**: Accessibilité transport en commun

## 🚀 Installation locale

### Prérequis
- Node.js 18+
- Python 3.11+
- Git

### Setup initial
```bash
# Cloner le repo
git clone https://github.com/magicmaxmagic/housing_prediction.git
cd housing_prediction

# Setup ETL
cd etl
python3 -m venv .venv
source .venv/bin/activate   # (ou .venv\Scripts\activate sous Windows)
pip install -r requirements.txt
make setup

# Setup API
cd ../api
npm install

# Setup Frontend
cd ../frontend
npm install
```

### Variables d'environnement

Créer `.env.example` dans chaque dossier:

```bash
# api/.env
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_API_TOKEN=your_api_token
D1_DATABASE_ID=your_d1_db_id
KV_NAMESPACE_ID=your_kv_namespace

# etl/.env
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_API_TOKEN=your_api_token
```

## 🏃‍♂️ Développement local

### ETL Pipeline
```bash
cd etl
make all  # Exécute tout le pipeline
make ingest  # Ingestion des données uniquement
make features  # Génération des features
make forecast  # Prévisions
make score  # Calcul des scores
make export  # Export des artefacts
```

### API
```bash
cd api
npm run dev  # Démarre le serveur local
npm run deploy  # Déploie sur Cloudflare Workers
```

### Frontend
```bash
cd frontend
npm run dev  # Démarre le serveur de dev
npm run build  # Build de production
npm run preview  # Prévisualise le build
```

## 📡 Endpoints API

### GET /areas
Retourne les zones avec leurs scores
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "id": "24662001",
      "properties": {
        "name": "Plateau-Mont-Royal Nord",
        "score": 78.5,
        "quantile": 4,
        "last_updated": "2025-08-09"
      },
      "geometry": { "type": "Polygon", "coordinates": [...] }
    }
  ]
}
```

### GET /scores/:areaId
Détail des sous-scores pour une zone
```json
{
  "area_id": "24662001",
  "name": "Plateau-Mont-Royal Nord",
  "as_of": "2025-08-09",
  "scores": {
    "growth": 85.2,
    "supply": 72.1,
    "tension": 91.3,
    "accessibility": 89.7,
    "returns": 45.8,
    "total": 78.5
  },
  "weights": {
    "growth": 0.25,
    "supply": 0.20,
    "tension": 0.20,
    "accessibility": 0.20,
    "returns": 0.15
  }
}
```

### GET /forecast/:metric/:areaId
Prévisions pour une zone et métrique
```json
{
  "area_id": "24662001",
  "metric": "rent",
  "horizon": 12,
  "forecast": [
    {
      "month": "2025-09",
      "yhat": 1850.5,
      "yhat_low": 1780.2,
      "yhat_high": 1920.8
    }
  ],
  "confidence": 0.85,
  "last_updated": "2025-08-09"
}
```

## 🚀 Déploiement

### Cloudflare Setup

1. **Créer les services Cloudflare**:
```bash
# Pages pour le frontend
npx wrangler pages project create investmtl

# D1 Database
npx wrangler d1 create investmtl-db

# KV Namespace
npx wrangler kv namespace create investmtl-config

# Pas besoin de R2 - données stockées en D1 + GitHub Releases
```

2. **Initialiser D1**:
```bash
cd data_schema
npx wrangler d1 execute investmtl-db --file=d1_init.sql
```

3. **Configuration GitHub Actions**:
Ajouter ces secrets dans GitHub Settings > Secrets:
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `D1_DATABASE_ID`
- `KV_NAMESPACE_ID`

### Pipeline de déploiement

1. **ETL quotidien** (GitHub Actions):
   - Récupère les dernières données
   - Calcule scores et prévisions
   - Pousse vers R2 et D1

2. **Déploiement continu**:
   - Push sur `main` → déploie frontend et API
   - Tests automatiques avant déploiement

## 📈 Limites des tiers gratuits

### Cloudflare Free Tier
- **Workers**: 100,000 requêtes/jour, 10ms CPU max
- **Pages**: 500 builds/mois, 1 build concurrent
- **D1**: 5 millions de lectures/mois, 100k écritures
- **KV**: 100k lectures/jour, 1k écritures

### GitHub Actions
- **Free**: 2000 minutes/mois pour repos privés
- **Public**: Illimité (notre cas)

### Recommandations
- Cache agressif (24h pour scores, 7j pour géo)
- Pagination des résultats
- Rate limiting côté client
- Monitoring des quotas via dashboard Cloudflare

## 🧪 Tests

```bash
# Tests ETL
cd etl
python -m pytest tests/

# Tests API
cd api
npm test

# Tests Frontend
cd frontend
npm test
```

## 📝 Contributing

1. Fork le projet
2. Créer une branche feature (`git checkout -b feature/amazing-feature`)
3. Commit les changements (`git commit -m 'feat: add amazing feature'`)
4. Push vers la branche (`git push origin feature/amazing-feature`)
5. Ouvrir une Pull Request

## 📜 License

MIT License - voir [LICENSE](LICENSE)

## ⚠️ Disclaimer

Cet outil est à des fins éducatives et d'analyse uniquement. Ne constitue pas un conseil en investissement. Les prévisions sont basées sur des données historiques et peuvent ne pas refléter les conditions futures du marché.
