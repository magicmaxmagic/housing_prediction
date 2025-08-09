-- Schema de base de données pour InvestMTL
-- Tables principales pour les quartiers, scores, et prédictions

-- Table des quartiers/areas
CREATE TABLE IF NOT EXISTS areas (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'district', -- district, region, city
    population INTEGER,
    coordinates_lat REAL,
    coordinates_lng REAL,
    boundaries_geojson TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table des scores par quartier
CREATE TABLE IF NOT EXISTS scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    area_id TEXT NOT NULL,
    s_total REAL DEFAULT 0,
    s_transit REAL DEFAULT 0,
    s_schools REAL DEFAULT 0,
    s_parks REAL DEFAULT 0,
    s_health REAL DEFAULT 0,
    s_retail REAL DEFAULT 0,
    s_culture REAL DEFAULT 0,
    s_safety REAL DEFAULT 0,
    as_of DATE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (area_id) REFERENCES areas(id)
);

-- Table des prédictions/forecasts
CREATE TABLE IF NOT EXISTS forecasts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    area_id TEXT NOT NULL,
    metric TEXT NOT NULL, -- price_sqft, rent_1br, etc.
    forecast_date DATE NOT NULL,
    current_value REAL NOT NULL,
    predicted_value REAL NOT NULL,
    confidence REAL DEFAULT 0.8,
    horizon_months INTEGER NOT NULL,
    model_version TEXT DEFAULT 'v1',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (area_id) REFERENCES areas(id)
);

-- Index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_scores_area_id ON scores(area_id);
CREATE INDEX IF NOT EXISTS idx_scores_as_of ON scores(as_of);
CREATE INDEX IF NOT EXISTS idx_forecasts_area_id ON forecasts(area_id);
CREATE INDEX IF NOT EXISTS idx_forecasts_metric ON forecasts(metric);
CREATE INDEX IF NOT EXISTS idx_forecasts_date ON forecasts(forecast_date);

-- Insérer des données d'exemple pour tester
INSERT OR IGNORE INTO areas (id, name, type, coordinates_lat, coordinates_lng) VALUES
('plateau', 'Plateau Mont-Royal', 'district', 45.5214, -73.5852),
('mile-end', 'Mile End', 'district', 45.5270, -73.6041),
('griffintown', 'Griffintown', 'district', 45.4919, -73.5606),
('old-montreal', 'Vieux-Montréal', 'district', 45.5048, -73.5540),
('westmount', 'Westmount', 'city', 45.4836, -73.5977);

-- Insérer des scores d'exemple
INSERT OR IGNORE INTO scores (area_id, s_total, s_transit, s_schools, s_parks, s_health, s_retail, s_culture, s_safety, as_of) VALUES
('plateau', 85.2, 90.0, 82.0, 88.5, 79.0, 87.0, 95.0, 80.0, '2024-01-01'),
('mile-end', 78.5, 85.0, 75.0, 80.0, 72.0, 82.0, 90.0, 75.0, '2024-01-01'),
('griffintown', 72.8, 88.0, 65.0, 70.0, 80.0, 85.0, 75.0, 85.0, '2024-01-01'),
('old-montreal', 82.1, 92.0, 78.0, 75.0, 85.0, 90.0, 88.0, 83.0, '2024-01-01'),
('westmount', 90.5, 75.0, 95.0, 90.0, 90.0, 85.0, 80.0, 98.0, '2024-01-01');

-- Insérer des prédictions d'exemple
INSERT OR IGNORE INTO forecasts (area_id, metric, forecast_date, current_value, predicted_value, confidence, horizon_months) VALUES
('plateau', 'price_sqft', '2024-02-01', 650.00, 670.00, 0.82, 1),
('plateau', 'price_sqft', '2024-07-01', 650.00, 720.00, 0.75, 6),
('mile-end', 'price_sqft', '2024-02-01', 580.00, 595.00, 0.80, 1),
('mile-end', 'price_sqft', '2024-07-01', 580.00, 630.00, 0.73, 6),
('griffintown', 'rent_1br', '2024-02-01', 1800.00, 1850.00, 0.85, 1),
('griffintown', 'rent_1br', '2024-07-01', 1800.00, 1950.00, 0.78, 6);
