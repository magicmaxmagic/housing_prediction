# 🚀 InvestMTL - Plan de Développement des Nouvelles Fonctionnalités

## 📋 Architecture Mise à Jour

```
housing_prediction/
├── frontend/                    # React + TypeScript + Vite
│   ├── src/
│   │   ├── components/
│   │   │   ├── auth/           # 🆕 Authentification
│   │   │   ├── map/            # 🆕 Cartographie MapLibre
│   │   │   ├── predictions/    # 🆕 ML Predictions
│   │   │   ├── export/         # 🆕 Export PDF/Excel
│   │   │   └── ui/             # Composants UI existants
│   │   ├── hooks/              # 🆕 React hooks personnalisés
│   │   ├── services/           # 🆕 Services API
│   │   ├── utils/              # 🆕 Utilitaires
│   │   └── types/              # Types TypeScript
│   └── public/
│       └── mapbox-gl.css       # 🆕 Styles MapLibre
├── api/                        # Cloudflare Workers + D1
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.ts         # 🆕 Authentification JWT
│   │   │   ├── predictions.ts  # 🆕 ML Predictions
│   │   │   ├── favorites.ts    # 🆕 Gestion favoris
│   │   │   └── export.ts       # 🆕 Export données
│   │   ├── middleware/
│   │   │   ├── auth.ts         # 🆕 Middleware JWT
│   │   │   ├── rateLimit.ts    # 🆕 Rate limiting
│   │   │   └── cache.ts        # 🆕 Cache KV
│   │   ├── services/
│   │   │   ├── ml.ts           # 🆕 Service ML
│   │   │   └── export.ts       # 🆕 Service export
│   │   └── utils/
│   ├── migrations/             # 🆕 Migrations D1
│   └── wrangler.toml
├── etl/                        # Pipeline ETL + ML
│   ├── ml/                     # 🆕 Machine Learning
│   │   ├── models/
│   │   │   ├── price_predictor.py
│   │   │   └── rent_predictor.py
│   │   ├── features/
│   │   │   └── feature_engineering.py
│   │   └── training/
│   │       ├── train_models.py
│   │       └── evaluate_models.py
│   ├── data/
│   │   ├── processed/
│   │   └── models/             # 🆕 Modèles sauvegardés
│   └── scripts/
│       └── update_predictions.py
├── .github/
│   └── workflows/
│       ├── deploy.yml
│       └── etl-monthly.yml     # 🆕 Mise à jour mensuelle
└── scripts/
    ├── setup.sh               # 🆕 Script configuration
    └── migrate-d1.sh          # 🆕 Migrations D1
```

## 🎯 Ordre de Développement Recommandé

### Phase 1: Infrastructure de Base
1. ✅ Migration vers Cloudflare D1
2. ✅ Système d'authentification JWT
3. ✅ Middleware de cache et rate limiting

### Phase 2: Machine Learning
1. ✅ Modèles XGBoost pour prédictions
2. ✅ Pipeline d'entraînement automatisé
3. ✅ API endpoint `/predictions`

### Phase 3: Interface Utilisateur
1. ✅ Cartographie MapLibre GL
2. ✅ Système d'authentification frontend
3. ✅ Interface prédictions ML

### Phase 4: Fonctionnalités Avancées
1. ✅ Export PDF/Excel
2. ✅ Système de favoris
3. ✅ Optimisations performance

### Phase 5: Automatisation
1. ✅ GitHub Actions ETL mensuel
2. ✅ Déploiement automatique
3. ✅ Monitoring et alertes

## 📊 Nouvelles Tables D1

```sql
-- Table utilisateurs
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table favoris
CREATE TABLE favorites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  zone_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id),
  UNIQUE(user_id, zone_id)
);

-- Table prédictions ML
CREATE TABLE predictions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  zone_id TEXT NOT NULL,
  quarter TEXT NOT NULL,
  price_per_m2_prediction REAL NOT NULL,
  price_confidence_lower REAL NOT NULL,
  price_confidence_upper REAL NOT NULL,
  rent_prediction REAL NOT NULL,
  rent_confidence_lower REAL NOT NULL,
  rent_confidence_upper REAL NOT NULL,
  model_version TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table géométries des zones
CREATE TABLE zone_geometries (
  zone_id TEXT PRIMARY KEY,
  geometry_geojson TEXT NOT NULL,
  bounds_north REAL NOT NULL,
  bounds_south REAL NOT NULL,
  bounds_east REAL NOT NULL,
  bounds_west REAL NOT NULL
);
```

## ⚡ Technologies Ajoutées

- **Frontend**: MapLibre GL, React Hook Form, Recharts, jsPDF, ExcelJS
- **Backend**: Hono JWT, bcryptjs, @cloudflare/workers-types
- **ML**: XGBoost, scikit-learn, joblib, pandas
- **DevOps**: GitHub Actions, Wrangler CLI

## 🔧 Variables d'Environnement

```env
# API (.env.production)
JWT_SECRET=your-super-secret-key
ML_MODEL_VERSION=v1.0.0
RATE_LIMIT_REQUESTS_PER_MINUTE=60
CACHE_TTL_SECONDS=3600

# ETL
MAPBOX_ACCESS_TOKEN=pk.your-token-here
ML_TRAINING_ENABLED=true
```
