-- D1 Database initialization script for InvestMTL
-- Run with: wrangler d1 execute investmtl-db --file=d1_init.sql

-- Enable WAL mode for better concurrency
PRAGMA journal_mode = WAL;

-- Areas table - stores geographic area information
CREATE TABLE IF NOT EXISTS areas (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    geo_bbox TEXT, -- Bounding box as JSON string
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Scores table - stores investment scores for each area
CREATE TABLE IF NOT EXISTS scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    area_id TEXT NOT NULL,
    as_of TEXT NOT NULL, -- YYYY-MM-DD format
    s_growth REAL NOT NULL DEFAULT 0,
    s_supply REAL NOT NULL DEFAULT 0,
    s_tension REAL NOT NULL DEFAULT 0,
    s_access REAL NOT NULL DEFAULT 0,
    s_return REAL NOT NULL DEFAULT 0,
    s_total REAL NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (area_id) REFERENCES areas (id),
    UNIQUE(area_id, as_of)
);

-- Forecasts table - stores prediction data
CREATE TABLE IF NOT EXISTS forecasts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    area_id TEXT NOT NULL,
    metric TEXT NOT NULL, -- 'rent', 'vacancy_rate', 'housing_starts', etc.
    horizon INTEGER NOT NULL, -- months into future (1-24)
    yhat REAL NOT NULL, -- predicted value
    yhat_low REAL NOT NULL, -- lower confidence bound
    yhat_upper REAL NOT NULL, -- upper confidence bound
    as_of TEXT NOT NULL, -- YYYY-MM-DD when forecast was generated
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (area_id) REFERENCES areas (id),
    UNIQUE(area_id, metric, horizon, as_of)
);

-- Data quality table - tracks data freshness and quality
CREATE TABLE IF NOT EXISTS data_quality (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data_type TEXT NOT NULL, -- 'scores', 'forecasts', 'areas'
    last_updated DATETIME NOT NULL,
    record_count INTEGER NOT NULL DEFAULT 0,
    quality_score REAL NOT NULL DEFAULT 1.0, -- 0-1 quality metric
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_scores_area_date ON scores (area_id, as_of DESC);
CREATE INDEX IF NOT EXISTS idx_scores_total ON scores (s_total DESC);
CREATE INDEX IF NOT EXISTS idx_forecasts_area_metric ON forecasts (area_id, metric);
CREATE INDEX IF NOT EXISTS idx_forecasts_date ON forecasts (as_of DESC);
CREATE INDEX IF NOT EXISTS idx_areas_name ON areas (name);

-- Create view for latest scores
CREATE VIEW IF NOT EXISTS latest_scores AS
SELECT 
    a.id,
    a.name,
    s.s_growth,
    s.s_supply,
    s.s_tension,
    s.s_access,
    s.s_return,
    s.s_total,
    s.as_of,
    CASE 
        WHEN s.s_total >= 80 THEN 5
        WHEN s.s_total >= 60 THEN 4
        WHEN s.s_total >= 40 THEN 3
        WHEN s.s_total >= 20 THEN 2
        ELSE 1
    END as quantile
FROM areas a
LEFT JOIN scores s ON a.id = s.area_id
AND s.as_of = (
    SELECT MAX(as_of) 
    FROM scores s2 
    WHERE s2.area_id = a.id
);

-- Create view for forecast summary
CREATE VIEW IF NOT EXISTS forecast_summary AS
SELECT 
    area_id,
    metric,
    COUNT(*) as forecast_points,
    MIN(horizon) as min_horizon,
    MAX(horizon) as max_horizon,
    AVG(yhat) as avg_forecast,
    MAX(as_of) as latest_forecast_date
FROM forecasts
GROUP BY area_id, metric;

-- Insert initial data quality tracking
INSERT OR REPLACE INTO data_quality (data_type, last_updated, record_count, quality_score, notes)
VALUES 
    ('areas', CURRENT_TIMESTAMP, 0, 1.0, 'Initial setup'),
    ('scores', CURRENT_TIMESTAMP, 0, 1.0, 'Initial setup'),
    ('forecasts', CURRENT_TIMESTAMP, 0, 1.0, 'Initial setup');

-- Sample areas data (Montreal districts)
INSERT OR REPLACE INTO areas (id, name, geo_bbox) VALUES
    ('24662001', 'Ahuntsic-Cartierville', '{"type":"bbox","coordinates":[[-73.75,-73.65],[45.52,45.58]]}'),
    ('24662002', 'Anjou', '{"type":"bbox","coordinates":[[-73.58,-73.52],[45.60,45.64]]}'),
    ('24662003', 'Côte-des-Neiges–Notre-Dame-de-Grâce', '{"type":"bbox","coordinates":[[-73.65,-73.58],[45.47,45.52]]}'),
    ('24662004', 'Lachine', '{"type":"bbox","coordinates":[[-73.68,-73.62],[45.43,45.47]]}'),
    ('24662005', 'LaSalle', '{"type":"bbox","coordinates":[[-73.65,-73.58],[45.42,45.45]]}'),
    ('24662006', 'Le Plateau-Mont-Royal', '{"type":"bbox","coordinates":[[-73.59,-73.56],[45.51,45.53]]}'),
    ('24662007', 'Le Sud-Ouest', '{"type":"bbox","coordinates":[[-73.58,-73.54],[45.47,45.50]]}'),
    ('24662008', 'Mercier–Hochelaga-Maisonneuve', '{"type":"bbox","coordinates":[[-73.55,-73.48],[45.52,45.56]]}'),
    ('24662009', 'Montréal-Nord', '{"type":"bbox","coordinates":[[-73.63,-73.60],[45.58,45.61]]}'),
    ('24662010', 'Outremont', '{"type":"bbox","coordinates":[[-73.62,-73.59],[45.51,45.53]]}'),
    ('24662011', 'Pierrefonds-Roxboro', '{"type":"bbox","coordinates":[[-73.85,-73.78],[45.48,45.52]]}'),
    ('24662012', 'Rivière-des-Prairies–Pointe-aux-Trembles', '{"type":"bbox","coordinates":[[-73.50,-73.45],[45.63,45.69]]}'),
    ('24662013', 'Rosemont–La Petite-Patrie', '{"type":"bbox","coordinates":[[-73.60,-73.57],[45.53,45.55]]}'),
    ('24662014', 'Saint-Laurent', '{"type":"bbox","coordinates":[[-73.72,-73.68],[45.49,45.53]]}'),
    ('24662015', 'Saint-Léonard', '{"type":"bbox","coordinates":[[-73.60,-73.56],[45.57,45.60]]}'),
    ('24662016', 'Verdun', '{"type":"bbox","coordinates":[[-73.57,-73.54],[45.45,45.47]]}'),
    ('24662017', 'Ville-Marie', '{"type":"bbox","coordinates":[[-73.58,-73.54],[45.49,45.52]]}'),
    ('24662018', 'Villeray–Saint-Michel–Parc-Extension', '{"type":"bbox","coordinates":[[-73.64,-73.60],[45.54,45.57]]}');

-- Sample scores data (using current date)
INSERT OR REPLACE INTO scores (area_id, as_of, s_growth, s_supply, s_tension, s_access, s_return, s_total)
SELECT 
    id,
    DATE('now') as as_of,
    45 + (RANDOM() % 40) as s_growth,
    35 + (RANDOM() % 50) as s_supply,
    40 + (RANDOM() % 45) as s_tension,
    50 + (RANDOM() % 35) as s_access,
    30 + (RANDOM() % 40) as s_return,
    0 as s_total -- Will be calculated below
FROM areas;

-- Update total scores as weighted average
UPDATE scores 
SET s_total = (
    s_growth * 0.25 + 
    s_supply * 0.20 + 
    s_tension * 0.20 + 
    s_access * 0.20 + 
    s_return * 0.15
)
WHERE as_of = DATE('now');

-- Sample forecasts data
INSERT OR REPLACE INTO forecasts (area_id, metric, horizon, yhat, yhat_low, yhat_upper, as_of)
SELECT 
    a.id,
    'average_rent',
    h.horizon,
    1500 + (RANDOM() % 800) + (h.horizon * 5) as yhat, -- Base rent with growth
    1400 + (RANDOM() % 600) + (h.horizon * 3) as yhat_low,
    1600 + (RANDOM() % 1000) + (h.horizon * 7) as yhat_upper,
    DATE('now') as as_of
FROM areas a
CROSS JOIN (
    SELECT 1 as horizon UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION
    SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION SELECT 10 UNION SELECT 11 UNION SELECT 12
) h;

-- Add vacancy rate forecasts
INSERT OR REPLACE INTO forecasts (area_id, metric, horizon, yhat, yhat_low, yhat_upper, as_of)
SELECT 
    a.id,
    'vacancy_rate',
    h.horizon,
    2.5 + (RANDOM() % 30) / 10.0 as yhat, -- 2.5-5.5% vacancy
    1.0 + (RANDOM() % 20) / 10.0 as yhat_low,
    3.5 + (RANDOM() % 40) / 10.0 as yhat_upper,
    DATE('now') as as_of
FROM areas a
CROSS JOIN (
    SELECT 1 as horizon UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION
    SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION SELECT 10 UNION SELECT 11 UNION SELECT 12
) h;

-- Update data quality tracking
UPDATE data_quality 
SET 
    last_updated = CURRENT_TIMESTAMP,
    record_count = (SELECT COUNT(*) FROM areas),
    quality_score = 0.8,
    notes = 'Sample data loaded'
WHERE data_type = 'areas';

UPDATE data_quality 
SET 
    last_updated = CURRENT_TIMESTAMP,
    record_count = (SELECT COUNT(*) FROM scores),
    quality_score = 0.8,
    notes = 'Sample scores generated'
WHERE data_type = 'scores';

UPDATE data_quality 
SET 
    last_updated = CURRENT_TIMESTAMP,
    record_count = (SELECT COUNT(*) FROM forecasts),
    quality_score = 0.7,
    notes = 'Sample forecasts generated'
WHERE data_type = 'forecasts';

-- Create triggers to update timestamps
CREATE TRIGGER IF NOT EXISTS update_areas_timestamp 
    AFTER UPDATE ON areas
BEGIN
    UPDATE areas SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Verify setup with some test queries
-- SELECT 'Areas count:' as info, COUNT(*) as count FROM areas;
-- SELECT 'Scores count:' as info, COUNT(*) as count FROM scores;
-- SELECT 'Forecasts count:' as info, COUNT(*) as count FROM forecasts;
-- SELECT 'Top 5 areas by score:' as info FROM latest_scores ORDER BY s_total DESC LIMIT 5;
