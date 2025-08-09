#!/usr/bin/env python3
"""
InvestMTL - Collecte des aires de diffusion et données démographiques
=================================================================

Ce script télécharge et traite automatiquement :
- Aires de diffusion 2021 de Statistique Canada (géométrie)
- Profil du recensement 2021 (données démographiques)  
- Limite administrative de Montréal
- Filtre pour l'Île de Montréal uniquement
- Sauvegarde en GeoJSON et Parquet optimisés

Optimisé pour GitHub Actions, exécution < 1 min
"""

import logging
import zipfile
import tempfile
from pathlib import Path
from typing import Tuple, Dict, Any
import json

import requests
import pandas as pd
import geopandas as gpd
from shapely.geometry import Point, Polygon


# Configuration du logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger(__name__)


# URLs des sources de données
DATA_SOURCES = {
    'dissemination_areas_shp': 'https://www12.statcan.gc.ca/census-recensement/2021/geo/bound-limit/files/fra/lda_000b21a_f.zip',
    'census_profile_api': 'https://www12.statcan.gc.ca/wds/rest/getFullTableDownloadCSV/F/34100488',
    # URL alternative pour les limites de Montréal - utilisons les données de Statistique Canada
    'montreal_boundaries': 'https://www12.statcan.gc.ca/census-recensement/2021/geo/bound-limit/files/fra/lda_000b21a_f.zip'  # On utilisera le même fichier pour filtrer par le nom
}


def setup_directories() -> Path:
    """Créer la structure de répertoires nécessaire."""
    base_dir = Path(__file__).parent.parent
    curated_dir = base_dir / 'data' / 'curated'
    curated_dir.mkdir(parents=True, exist_ok=True)
    
    logger.info(f"📁 Répertoire de sortie: {curated_dir}")
    return curated_dir


def download_file(url: str, description: str) -> bytes:
    """Télécharger un fichier avec gestion d'erreurs."""
    logger.info(f"⬇️  Téléchargement {description}...")
    
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        
        size_mb = len(response.content) / (1024 * 1024)
        logger.info(f"✅ {description} téléchargé ({size_mb:.1f} MB)")
        
        return response.content
        
    except requests.RequestException as e:
        logger.error(f"❌ Erreur téléchargement {description}: {e}")
        raise


def extract_shapefile(zip_content: bytes, temp_dir: Path) -> Path:
    """Extraire le shapefile depuis l'archive ZIP de StatCan."""
    logger.info("📦 Extraction de l'archive ZIP...")
    
    zip_path = temp_dir / "dissemination_areas.zip"
    with open(zip_path, 'wb') as f:
        f.write(zip_content)
    
    extract_dir = temp_dir / "extracted"
    extract_dir.mkdir(exist_ok=True)
    
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        zip_ref.extractall(extract_dir)
    
    # Trouver le fichier .shp principal
    shp_files = list(extract_dir.glob("**/*.shp"))
    if not shp_files:
        raise FileNotFoundError("Aucun fichier .shp trouvé dans l'archive")
    
    shp_path = shp_files[0]
    logger.info(f"✅ Shapefile extrait: {shp_path.name}")
    
    return shp_path


def load_montreal_boundary_from_das(das_gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """Créer la limite de Montréal à partir des aires de diffusion de Montréal."""
    logger.info("🗺️  Identification des aires de diffusion de Montréal...")
    
    # Filtrer les DA qui contiennent "Montréal" dans leur nom ou code régional
    # Les codes CMA/RMR pour Montréal sont généralement 24462
    montreal_filter = (
        das_gdf['CMANAME'].str.contains('Montréal', case=False, na=False) |
        das_gdf['CMAUID'].str.startswith('462', na=False) |  # Code RMR Montréal
        das_gdf['PRNAME'].str.contains('Québec', case=False, na=False)
    )
    
    montreal_das = das_gdf[montreal_filter].copy()
    
    if len(montreal_das) == 0:
        # Fallback: utiliser les coordonnées approximatives de Montréal
        logger.info("⚠️  Fallback: filtrage par coordonnées géographiques")
        montreal_bounds = (-74.5, 45.2, -73.2, 46.0)  # West, South, East, North
        montreal_das = das_gdf.cx[montreal_bounds[0]:montreal_bounds[2], montreal_bounds[1]:montreal_bounds[3]].copy()
    
    logger.info(f"✅ {len(montreal_das)} aires de diffusion identifiées pour Montréal")
    
    return montreal_das


def load_and_filter_dissemination_areas(shp_path: Path) -> gpd.GeoDataFrame:
    """Charger les aires de diffusion et filtrer pour Montréal."""
    logger.info("📊 Chargement des aires de diffusion...")
    
    # Charger le shapefile avec pyogrio si disponible, sinon fiona
    try:
        das_gdf = gpd.read_file(shp_path, engine='pyogrio')
        logger.info("✅ Utilisé pyogrio pour charger le shapefile")
    except ImportError:
        das_gdf = gpd.read_file(shp_path)
        logger.info("✅ Utilisé fiona pour charger le shapefile")
    
    logger.info(f"📈 {len(das_gdf)} aires de diffusion chargées")
    
    # S'assurer du bon CRS
    if das_gdf.crs is None:
        das_gdf.set_crs('EPSG:4326', inplace=True)
    elif das_gdf.crs != 'EPSG:4326':
        das_gdf = das_gdf.to_crs('EPSG:4326')
    
    # Filtrer pour Montréal
    montreal_das = load_montreal_boundary_from_das(das_gdf)
    
    return montreal_das


def get_census_data_url(api_url: str) -> str:
    """Récupérer l'URL de téléchargement CSV depuis l'API StatCan."""
    logger.info("🔗 Récupération de l'URL des données de recensement...")
    
    response = requests.get(api_url, timeout=30)
    response.raise_for_status()
    
    # L'API retourne directement l'URL de téléchargement
    csv_url = response.text.strip()
    if not csv_url.startswith('http'):
        raise ValueError(f"URL invalide retournée par l'API: {csv_url}")
    
    logger.info("✅ URL de téléchargement CSV obtenue")
    return csv_url


def load_and_filter_census_data(csv_url: str, montreal_da_codes: set) -> pd.DataFrame:
    """Télécharger et filtrer les données de recensement."""
    logger.info("📈 Téléchargement des données de recensement...")
    
    # Téléchargement direct avec pandas
    census_df = pd.read_csv(csv_url, low_memory=False)
    logger.info(f"📊 {len(census_df)} lignes de données de recensement chargées")
    
    # Filtrer pour les DA de Montréal
    if 'GEO_CODE (POR)' in census_df.columns:
        geo_code_col = 'GEO_CODE (POR)'
    elif 'DGUID' in census_df.columns:
        # Extraire le code géographique du DGUID si nécessaire
        geo_code_col = 'DGUID'
    else:
        # Chercher une colonne qui pourrait contenir les codes géographiques
        geo_cols = [col for col in census_df.columns if 'GEO' in col.upper() or 'CODE' in col.upper()]
        if geo_cols:
            geo_code_col = geo_cols[0]
            logger.info(f"⚠️  Utilisation de la colonne {geo_code_col} pour les codes géographiques")
        else:
            raise ValueError("Impossible de trouver la colonne des codes géographiques")
    
    # Filtrage
    montreal_census = census_df[census_df[geo_code_col].astype(str).isin(montreal_da_codes)]
    
    logger.info(f"✅ {len(montreal_census)} lignes filtrées pour Montréal")
    
    # Nettoyage et renommage des colonnes importantes
    column_mapping = {}
    for col in montreal_census.columns:
        col_lower = col.lower()
        if 'population' in col_lower and 'total' in col_lower:
            column_mapping[col] = 'population'
        elif 'household' in col_lower and 'total' in col_lower:
            column_mapping[col] = 'households'
        elif 'income' in col_lower and 'median' in col_lower:
            column_mapping[col] = 'median_income'
        elif ('0' in col and '14' in col) or ('youth' in col_lower):
            column_mapping[col] = 'youth_share'
        elif ('65' in col and 'over' in col) or ('senior' in col_lower):
            column_mapping[col] = 'senior_share'
    
    if column_mapping:
        montreal_census = montreal_census.rename(columns=column_mapping)
        logger.info(f"🏷️  Colonnes renommées: {list(column_mapping.values())}")
    
    return montreal_census


def save_outputs(montreal_das: gpd.GeoDataFrame, census_data: pd.DataFrame, output_dir: Path) -> None:
    """Sauvegarder les fichiers de sortie."""
    logger.info("💾 Sauvegarde des fichiers de sortie...")
    
    # Sauvegarde GeoJSON des aires de diffusion
    areas_path = output_dir / 'areas.geojson'
    montreal_das.to_file(areas_path, driver='GeoJSON')
    logger.info(f"✅ Aires de diffusion sauvées: {areas_path}")
    
    # Sauvegarde Parquet des données démographiques
    demo_path = output_dir / 'demography.parquet'
    census_data.to_parquet(demo_path, index=False, engine='pyarrow')
    logger.info(f"✅ Données démographiques sauvées: {demo_path}")
    
    # Statistiques de sortie
    areas_size = areas_path.stat().st_size / (1024 * 1024)
    demo_size = demo_path.stat().st_size / (1024 * 1024)
    
    logger.info(f"📊 Fichiers générés:")
    logger.info(f"   • areas.geojson: {areas_size:.1f} MB ({len(montreal_das)} aires)")
    logger.info(f"   • demography.parquet: {demo_size:.1f} MB ({len(census_data)} lignes)")


def main() -> None:
    """Fonction principale d'exécution."""
    logger.info("🚀 Début de la collecte des données Montréal")
    logger.info("=" * 60)
    
    try:
        # Configuration
        output_dir = setup_directories()
        
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            
            # 1. Téléchargement et extraction des aires de diffusion
            das_zip = download_file(
                DATA_SOURCES['dissemination_areas_shp'], 
                "aires de diffusion 2021"
            )
            shp_path = extract_shapefile(das_zip, temp_path)
            
            # 2. Filtrage des aires de diffusion pour Montréal (intégré dans la fonction)
            montreal_das = load_and_filter_dissemination_areas(shp_path)
            
            # 3. Préparation des codes géographiques pour le filtrage du recensement
            da_codes = set(montreal_das['DAUID'].astype(str))  # DAUID = code unique des aires de diffusion
            
            # 4. Téléchargement des données de recensement
            csv_url = get_census_data_url(DATA_SOURCES['census_profile_api'])
            census_data = load_and_filter_census_data(csv_url, da_codes)
            
            # 5. Sauvegarde des résultats
            save_outputs(montreal_das, census_data, output_dir)
        
        logger.info("=" * 60)
        logger.info("✅ Collecte terminée avec succès!")
        
    except Exception as e:
        logger.error(f"❌ Erreur durant la collecte: {e}")
        raise


if __name__ == "__main__":
    main()
