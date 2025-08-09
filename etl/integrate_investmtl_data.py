#!/usr/bin/env python3
"""
Script d'intégration des données immobilières dans InvestMTL

Ce script prépare et intégre les données immobilières traitées
dans l'API InvestMTL pour alimenter les prédictions et analyses.
"""

import pandas as pd
import json
import logging
from pathlib import Path
import sqlite3
from datetime import datetime

# Configuration
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).parent.parent
PROCESSED_DIR = BASE_DIR / "data" / "processed"
API_DIR = BASE_DIR / "api"

class InvestMTLIntegrator:
    def __init__(self):
        self.db_path = API_DIR / "database.sqlite"
        
    def create_real_estate_tables(self):
        """Crée les tables pour les données immobilières"""
        logger.info("🗃️ Création des tables immobilières")
        
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            # Table des unités d'évaluation
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS evaluation_units (
                    id TEXT PRIMARY KEY,
                    civique_debut TEXT,
                    civique_fin TEXT,
                    nom_rue TEXT,
                    suite_debut TEXT,
                    municipalite TEXT,
                    etages INTEGER,
                    nb_logements INTEGER,
                    annee_construction INTEGER,
                    code_utilisation TEXT,
                    libelle_utilisation TEXT,
                    categorie TEXT,
                    matricule TEXT,
                    superficie_terrain REAL,
                    superficie_batiment REAL,
                    arrondissement TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            # Table des zones d'investissement
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS investment_zones (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    street_name TEXT UNIQUE,
                    property_count INTEGER,
                    total_units INTEGER,
                    avg_construction_year REAL,
                    min_construction_year INTEGER,
                    max_construction_year INTEGER,
                    avg_land_surface REAL,
                    avg_building_surface REAL,
                    avg_floors REAL,
                    density_score REAL,
                    modernity_score REAL,
                    size_score REAL,
                    investment_score REAL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            # Table des données de marché Statistique Canada
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS market_data (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    data_type TEXT,
                    region TEXT,
                    period TEXT,
                    value REAL,
                    unit TEXT,
                    source TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            conn.commit()
            logger.info("✅ Tables créées avec succès")

    def import_montreal_units(self, limit=50000):
        """Importe les unités d'évaluation de Montréal (échantillon)"""
        logger.info(f"🏠 Import des unités d'évaluation (max {limit:,})")
        
        parquet_file = PROCESSED_DIR / "montreal_evaluation_units.parquet"
        if not parquet_file.exists():
            logger.error(f"❌ Fichier non trouvé: {parquet_file}")
            return
        
        try:
            # Charger un échantillon des données
            df = pd.read_parquet(parquet_file)
            
            # Filtrer les logements résidentiels uniquement
            residential = df[df['LIBELLE_UTILISATION'].str.contains('Logement', na=False)].copy()
            
            # Prendre un échantillon représentatif
            if len(residential) > limit:
                residential = residential.sample(n=limit, random_state=42)
            
            logger.info(f"📊 {len(residential):,} unités résidentielles à importer")
            
            # Préparer les données pour l'insertion
            residential_clean = residential.copy()
            residential_clean.columns = [col.lower() for col in residential_clean.columns]
            
            # Mapper les colonnes
            column_mapping = {
                'id_uev': 'id',
                'etage_hors_sol': 'etages',
                'nombre_logement': 'nb_logements',
                'no_arrond_ile_cum': 'arrondissement'
            }
            residential_clean.rename(columns=column_mapping, inplace=True)
            
            # Sélectionner les colonnes nécessaires
            required_columns = [
                'id', 'civique_debut', 'civique_fin', 'nom_rue', 'suite_debut',
                'municipalite', 'etages', 'nb_logements', 'annee_construction',
                'code_utilisation', 'libelle_utilisation', 'categorie_uef',
                'matricule83', 'superficie_terrain', 'superficie_batiment', 'arrondissement'
            ]
            
            available_columns = [col for col in required_columns if col in residential_clean.columns]
            residential_final = residential_clean[available_columns].copy()
            
            # Renommer pour correspondre à la table
            residential_final.rename(columns={'categorie_uef': 'categorie', 'matricule83': 'matricule'}, inplace=True)
            
            # Insérer dans la base de données
            with sqlite3.connect(self.db_path) as conn:
                residential_final.to_sql('evaluation_units', conn, if_exists='replace', index=False)
            
            logger.info(f"✅ {len(residential_final):,} unités importées")
            
        except Exception as e:
            logger.error(f"❌ Erreur lors de l'import: {e}")

    def import_investment_zones(self):
        """Importe les zones d'investissement"""
        logger.info("🎯 Import des zones d'investissement")
        
        parquet_file = PROCESSED_DIR / "investment_zones.parquet"
        if not parquet_file.exists():
            logger.error(f"❌ Fichier non trouvé: {parquet_file}")
            return
        
        try:
            df = pd.read_parquet(parquet_file)
            logger.info(f"📊 {len(df):,} zones d'investissement à importer")
            
            # Préparer les données
            df_clean = df.copy()
            df_clean.columns = [col.lower() for col in df_clean.columns]
            
            # Mapper les colonnes
            column_mapping = {
                'nom_rue': 'street_name',
                'id_uev_count': 'property_count',
                'nombre_logement_sum': 'total_units',
                'annee_construction_mean': 'avg_construction_year',
                'annee_construction_min': 'min_construction_year',
                'annee_construction_max': 'max_construction_year',
                'superficie_terrain_mean': 'avg_land_surface',
                'superficie_batiment_mean': 'avg_building_surface',
                'etage_hors_sol_mean': 'avg_floors'
            }
            
            df_clean.rename(columns=column_mapping, inplace=True)
            
            # Sélectionner les colonnes
            required_columns = [
                'street_name', 'property_count', 'total_units', 'avg_construction_year',
                'min_construction_year', 'max_construction_year', 'avg_land_surface',
                'avg_building_surface', 'avg_floors', 'density_score', 
                'modernity_score', 'size_score', 'investment_score'
            ]
            
            available_columns = [col for col in required_columns if col in df_clean.columns]
            df_final = df_clean[available_columns].copy()
            
            # Insérer dans la base
            with sqlite3.connect(self.db_path) as conn:
                df_final.to_sql('investment_zones', conn, if_exists='replace', index=False)
            
            logger.info(f"✅ {len(df_final):,} zones d'investissement importées")
            
        except Exception as e:
            logger.error(f"❌ Erreur lors de l'import: {e}")

    def import_market_data(self):
        """Importe les données de marché de Statistique Canada"""
        logger.info("📈 Import des données de marché")
        
        market_files = [
            ('statistics_canada_Number of sales by price range.parquet', 'sales_by_price'),
            ('statistics_canada_Number of ownership transfers.parquet', 'ownership_transfers'),
            ('statistics_canada_Number of mortgages.parquet', 'mortgages'),
            ('statistics_canada_Number of acts of financial difficulty.parquet', 'financial_difficulty')
        ]
        
        total_imported = 0
        
        for filename, data_type in market_files:
            file_path = PROCESSED_DIR / filename
            if not file_path.exists():
                logger.warning(f"⚠️ Fichier non trouvé: {filename}")
                continue
                
            try:
                df = pd.read_parquet(file_path)
                logger.info(f"📊 {filename}: {len(df):,} lignes")
                
                # Préparer les données pour l'insertion
                market_records = []
                
                for _, row in df.iterrows():
                    # Extraire les informations pertinentes selon le type
                    region = row.get('Région', row.get('Region', row.get('GEO', 'Québec')))
                    period = row.get('Période', row.get('Period', row.get('REF_DATE', '2024')))
                    
                    # Trouver la colonne de valeur
                    value_col = None
                    for col in df.columns:
                        if any(keyword in col.lower() for keyword in ['valeur', 'value', 'nombre', 'number']):
                            value_col = col
                            break
                    
                    if value_col is not None:
                        value = row.get(value_col, 0)
                        
                        if pd.notna(value) and str(value).replace('.', '').isdigit():
                            market_records.append({
                                'data_type': data_type,
                                'region': str(region),
                                'period': str(period),
                                'value': float(value),
                                'unit': 'count',
                                'source': 'Statistique Canada'
                            })
                
                if market_records:
                    market_df = pd.DataFrame(market_records)
                    
                    with sqlite3.connect(self.db_path) as conn:
                        market_df.to_sql('market_data', conn, if_exists='append', index=False)
                    
                    total_imported += len(market_records)
                    logger.info(f"✅ {len(market_records):,} enregistrements importés pour {data_type}")
                
            except Exception as e:
                logger.error(f"❌ Erreur avec {filename}: {e}")
        
        logger.info(f"📈 Total données de marché importées: {total_imported:,}")

    def generate_api_endpoints(self):
        """Génère le code pour les nouveaux endpoints API"""
        logger.info("🚀 Génération des endpoints API")
        
        api_code = '''
// Nouveaux endpoints pour les données immobilières

// GET /api/evaluation-units - Récupère les unités d'évaluation
export async function getEvaluationUnits(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '100');
  const offset = parseInt(url.searchParams.get('offset') || '0');
  const street = url.searchParams.get('street');
  
  let query = `
    SELECT id, civique_debut, civique_fin, nom_rue, nb_logements, 
           annee_construction, libelle_utilisation, superficie_terrain, 
           superficie_batiment, etages
    FROM evaluation_units 
    WHERE 1=1
  `;
  const params: any[] = [];
  
  if (street) {
    query += ` AND nom_rue LIKE ?`;
    params.push(`%${street}%`);
  }
  
  query += ` ORDER BY nom_rue LIMIT ? OFFSET ?`;
  params.push(limit, offset);
  
  const { results } = await env.DB.prepare(query).bind(...params).all();
  
  return new Response(JSON.stringify({
    data: results,
    pagination: { limit, offset, total: results.length }
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// GET /api/investment-zones - Récupère les zones d'investissement
export async function getInvestmentZones(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const minScore = parseFloat(url.searchParams.get('min_score') || '0');
  
  const query = `
    SELECT street_name, property_count, total_units, avg_construction_year,
           avg_land_surface, avg_building_surface, investment_score,
           density_score, modernity_score, size_score
    FROM investment_zones 
    WHERE investment_score >= ?
    ORDER BY investment_score DESC 
    LIMIT ?
  `;
  
  const { results } = await env.DB.prepare(query).bind(minScore, limit).all();
  
  return new Response(JSON.stringify({
    data: results,
    filters: { min_score: minScore, limit }
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// GET /api/market-data - Récupère les données de marché
export async function getMarketData(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const dataType = url.searchParams.get('type');
  const region = url.searchParams.get('region');
  
  let query = `
    SELECT data_type, region, period, value, unit, source
    FROM market_data 
    WHERE 1=1
  `;
  const params: any[] = [];
  
  if (dataType) {
    query += ` AND data_type = ?`;
    params.push(dataType);
  }
  
  if (region) {
    query += ` AND region LIKE ?`;
    params.push(`%${region}%`);
  }
  
  query += ` ORDER BY period DESC, data_type`;
  
  const { results } = await env.DB.prepare(query).bind(...params).all();
  
  return new Response(JSON.stringify({
    data: results,
    filters: { type: dataType, region }
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// GET /api/property-search - Recherche de propriétés
export async function searchProperties(request: Request, env: Env): Response {
  const url = new URL(request.url);
  const street = url.searchParams.get('street');
  const minYear = url.searchParams.get('min_year');
  const maxYear = url.searchParams.get('max_year');
  const minUnits = url.searchParams.get('min_units');
  
  let query = `
    SELECT e.*, i.investment_score
    FROM evaluation_units e
    LEFT JOIN investment_zones i ON e.nom_rue = i.street_name
    WHERE 1=1
  `;
  const params: any[] = [];
  
  if (street) {
    query += ` AND e.nom_rue LIKE ?`;
    params.push(`%${street}%`);
  }
  
  if (minYear) {
    query += ` AND e.annee_construction >= ?`;
    params.push(parseInt(minYear));
  }
  
  if (maxYear) {
    query += ` AND e.annee_construction <= ?`;
    params.push(parseInt(maxYear));
  }
  
  if (minUnits) {
    query += ` AND e.nb_logements >= ?`;
    params.push(parseInt(minUnits));
  }
  
  query += ` ORDER BY i.investment_score DESC, e.annee_construction DESC LIMIT 100`;
  
  const { results } = await env.DB.prepare(query).bind(...params).all();
  
  return new Response(JSON.stringify({
    data: results,
    count: results.length
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
'''
        
        # Sauvegarder le code des endpoints
        endpoints_file = API_DIR / "src" / "real-estate-endpoints.ts"
        endpoints_file.parent.mkdir(exist_ok=True)
        
        with open(endpoints_file, 'w', encoding='utf-8') as f:
            f.write(api_code)
        
        logger.info(f"🚀 Code API généré: {endpoints_file}")

    def run_integration(self):
        """Lance l'intégration complète"""
        logger.info("🎯 Début de l'intégration InvestMTL")
        
        try:
            # 1. Créer les tables
            self.create_real_estate_tables()
            
            # 2. Importer les données
            self.import_montreal_units(limit=25000)  # Limiter pour la démo
            self.import_investment_zones()
            self.import_market_data()
            
            # 3. Générer les endpoints API
            self.generate_api_endpoints()
            
            # 4. Vérifier les données importées
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                cursor.execute("SELECT COUNT(*) FROM evaluation_units")
                units_count = cursor.fetchone()[0]
                
                cursor.execute("SELECT COUNT(*) FROM investment_zones")
                zones_count = cursor.fetchone()[0]
                
                cursor.execute("SELECT COUNT(*) FROM market_data")
                market_count = cursor.fetchone()[0]
            
            logger.info(f"\n✅ INTÉGRATION RÉUSSIE")
            logger.info(f"🏠 Unités d'évaluation: {units_count:,}")
            logger.info(f"🎯 Zones d'investissement: {zones_count:,}")
            logger.info(f"📈 Données de marché: {market_count:,}")
            logger.info(f"🗄️ Base de données: {self.db_path}")
            
        except Exception as e:
            logger.error(f"❌ Erreur lors de l'intégration: {e}")
            raise

def main():
    integrator = InvestMTLIntegrator()
    integrator.run_integration()

if __name__ == "__main__":
    main()
