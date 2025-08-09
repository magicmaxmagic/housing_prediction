# InvestMTL - Analyse d'investissement immobilier à Montréal

Application 100% gratuite pour évaluer où investir à Montréal selon la croissance, l'offre future de logements et les prévisions. Utilise uniquement des données ouvertes et des services gratuits.

## 🏗️ Architecture

- **Frontend**: React + Vite + TypeScript + Tailwind + shadcn/ui + MapLibre GL
- **Backend**: Cloudflare Workers + Hono + TypeScript  
- **Données**: Cloudflare R2 (Parquet/JSON) + D1 (SQLite) + KV
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
R2_BUCKET_NAME=investmtl-data
KV_NAMESPACE_ID=your_kv_namespace

# etl/.env
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_API_TOKEN=your_api_token
R2_BUCKET_NAME=investmtl-data
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
npx wrangler kv:namespace create investmtl-config

# R2 Bucket
npx wrangler r2 bucket create investmtl-data
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
- `R2_BUCKET_NAME`

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
- **R2**: 10GB stockage, 1 million requêtes classe A/mois
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
