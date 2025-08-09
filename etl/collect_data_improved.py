#!/usr/bin/env python3
"""
InvestMTL - Collecte de données complète
=======================================

Script amélioré pour collecter automatiquement toutes les sources de données :
- Aires de diffusion et limites administratives
- Données démographiques du recensement
- Loyers et vacance (CMHC)
- Mises en chantier (SCHL)
- Permis de construction (Ville de Montréal)
- Points d'intérêt (OpenStreetMap)

Optimisé pour GitHub Actions et exécution locale
"""

import os
import io
import json
import time
import hashlib
import zipfile
import tempfile
import logging
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any

import requests
import pandas as pd
import geopandas as gpd
import duckdb
from shapely.geometry import Point

# Configuration du logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger(__name__)

# Configuration des chemins
BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "data"
RAW_DIR = DATA_DIR / "raw"
CURATED_DIR = DATA_DIR / "curated"

# Créer les répertoires
for dir_path in [RAW_DIR, CURATED_DIR]:
    dir_path.mkdir(parents=True, exist_ok=True)

# Configuration des sources de données
DATA_SOURCES = {
    "areas": [
        {
            "id": "statcan_dissemination_areas_2021",
            "name": "Aires de diffusion 2021 - StatCan",
            "url": "https://www12.statcan.gc.ca/census-recensement/2021/geo/bound-limit/files/fra/lda_000b21a_f.zip",
            "type": "zip_shapefile",
            "dest": "areas/statcan_da_2021.zip",
            "filter": "montreal"
        }
    ],
    "demography": [
        {
            "id": "statcan_census_profile_2021", 
            "name": "Profil du recensement 2021 - StatCan",
            "url": "https://www12.statcan.gc.ca/wds/rest/getFullTableDownloadCSV/F/34100488",
            "type": "api_csv",
            "dest": "demography/census_profile_2021.csv"
        }
    ],
    "rent_vacancy": [
        {
            "id": "cmhc_rental_market_survey",
            "name": "Enquête sur les logements locatifs - SCHL",
            "url": "https://www.cmhc-schl.gc.ca/fr/professionals/housing-markets-data-and-research/housing-data/data-tables/rental-market/rental-market-report-data",
            "type": "csv",
            "dest": "rent_vacancy/cmhc_rental.csv",
            "note": "Nécessite adaptation pour l'API SCHL"
        }
    ],
    "starts": [
        {
            "id": "cmhc_housing_starts",
            "name": "Mises en chantier - SCHL",
            "url": "https://www.cmhc-schl.gc.ca/fr/professionals/housing-markets-data-and-research/housing-data/data-tables/housing-market-data/housing-starts-completions-under-construction-absorbed-unabsorbed-units",
            "type": "csv", 
            "dest": "starts/cmhc_starts.csv",
            "note": "Nécessite adaptation pour l'API SCHL"
        }
    ],
    "permits": [
        {
            "id": "montreal_building_permits",
            "name": "Permis de construction - Ville de Montréal",
            "url": "https://donnees.montreal.ca/api/3/action/datastore_search?resource_id=f52e154f-9d8c-4ea5-bf26-a27db4e3ed05&limit=50000",
            "type": "ckan_api",
            "dest": "permits/montreal_permits.json"
        }
    ],
    "poi": [
        {
            "id": "osm_amenities_montreal",
            "name": "Points d'intérêt - OpenStreetMap",
            "url": "https://overpass-api.de/api/interpreter",
            "type": "overpass",
            "method": "post",
            "dest": "poi/osm_montreal.json",
            "body": """[out:json][timeout:25];
(
  node["amenity"~"^(school|hospital|pharmacy|bank|restaurant|cafe|bar|pub|library|museum|theatre|cinema|park|gym|swimming_pool|bus_station|subway_station)$"](45.3,-74.0,45.7,-73.0);
  way["amenity"~"^(school|hospital|pharmacy|bank|restaurant|cafe|bar|pub|library|museum|theatre|cinema|park|gym|swimming_pool|bus_station|subway_station)$"](45.3,-74.0,45.7,-73.0);
);
out center;"""
        }
    ]
}


def download_file(url: str, dest_path: Path, method: str = "get", body: Optional[str] = None, timeout: int = 60) -> Path:
    """Télécharge un fichier avec gestion d'erreurs robuste."""
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    
    logger.info(f"⬇️  Téléchargement: {url}")
    
    try:
        if method.lower() == "post":
            response = requests.post(url, data=body.encode("utf-8") if body else None, timeout=timeout)
        else:
            response = requests.get(url, stream=True, timeout=timeout)
        
        response.raise_for_status()
        
        with open(dest_path, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
        
        size_mb = dest_path.stat().st_size / (1024 * 1024)
        logger.info(f"✅ Téléchargé: {dest_path.name} ({size_mb:.1f} MB)")
        
        return dest_path
        
    except requests.RequestException as e:
        logger.error(f"❌ Erreur téléchargement {url}: {e}")
        raise
    except Exception as e:
        logger.error(f"❌ Erreur inattendue: {e}")
        raise


def extract_shapefile_from_zip(zip_path: Path, extract_dir: Path) -> Path:
    """Extrait un shapefile d'une archive ZIP."""
    logger.info(f"📦 Extraction: {zip_path.name}")
    
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        zip_ref.extractall(extract_dir)
    
    # Trouver le fichier .shp principal
    shp_files = list(extract_dir.glob("**/*.shp"))
    if not shp_files:
        raise FileNotFoundError("Aucun fichier .shp trouvé dans l'archive")
    
    shp_path = shp_files[0]
    logger.info(f"✅ Shapefile extrait: {shp_path.name}")
    
    return shp_path


def filter_montreal_areas(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """Filtre les aires géographiques pour la région de Montréal."""
    logger.info("🔍 Filtrage pour la région de Montréal...")
    
    original_count = len(gdf)
    
    # Essayer plusieurs critères de filtrage
    montreal_filter = pd.Series([False] * len(gdf))
    
    # 1. Par nom de CMA/RMR
    if 'CMANAME' in gdf.columns:
        montreal_filter |= gdf['CMANAME'].str.contains('Montréal', case=False, na=False)
    
    # 2. Par code CMA (462 = Montréal)  
    if 'CMAUID' in gdf.columns:
        montreal_filter |= gdf['CMAUID'].str.startswith('462', na=False)
    
    # 3. Par coordonnées géographiques (bounding box Montréal)
    if not montreal_filter.any():
        logger.info("⚠️  Fallback: filtrage par coordonnées")
        montreal_bounds = (-74.5, 45.2, -73.2, 46.0)  # West, South, East, North
        gdf_filtered = gdf.cx[montreal_bounds[0]:montreal_bounds[2], montreal_bounds[1]:montreal_bounds[3]]
    else:
        gdf_filtered = gdf[montreal_filter].copy()
    
    logger.info(f"✅ Filtrage terminé: {original_count} → {len(gdf_filtered)} aires")
    
    return gdf_filtered


def get_census_csv_url(api_url: str) -> str:
    """Récupère l'URL de téléchargement CSV depuis l'API StatCan."""
    logger.info("🔗 Récupération URL données de recensement...")
    
    try:
        response = requests.get(api_url, timeout=30)
        response.raise_for_status()
        
        csv_url = response.text.strip()
        if not csv_url.startswith('http'):
            raise ValueError(f"URL invalide: {csv_url}")
        
        logger.info("✅ URL CSV obtenue")
        return csv_url
        
    except Exception as e:
        logger.error(f"❌ Erreur récupération URL CSV: {e}")
        raise


def process_areas_data(sources: List[Dict]) -> None:
    """Traite les données géographiques des aires."""
    logger.info("🗺️  === TRAITEMENT DES AIRES GÉOGRAPHIQUES ===")
    
    for src in sources:
        logger.info(f"📊 Source: {src['name']}")
        
        try:
            if src["type"] == "zip_shapefile":
                # Télécharger l'archive ZIP
                zip_path = download_file(src["url"], RAW_DIR / src["dest"])
                
                with tempfile.TemporaryDirectory() as temp_dir:
                    temp_path = Path(temp_dir)
                    shp_path = extract_shapefile_from_zip(zip_path, temp_path)
                    
                    # Charger le shapefile
                    gdf = gpd.read_file(shp_path)
                    logger.info(f"📈 {len(gdf)} aires chargées")
                    
                    # Normaliser les noms de colonnes
                    gdf.columns = [c.lower() for c in gdf.columns]
                    
                    # Assurer CRS 4326
                    if gdf.crs != 'EPSG:4326':
                        gdf = gdf.to_crs('EPSG:4326')
                    
                    # Filtrer pour Montréal si demandé
                    if src.get("filter") == "montreal":
                        gdf = filter_montreal_areas(gdf)
                    
                    # Sauvegarder
                    output_path = CURATED_DIR / "areas.geojson"
                    gdf.to_file(output_path, driver="GeoJSON")
                    logger.info(f"💾 Sauvé: {output_path}")
            
        except Exception as e:
            logger.error(f"❌ Erreur traitement {src['id']}: {e}")
            continue


def process_demography_data(sources: List[Dict]) -> None:
    """Traite les données démographiques."""
    logger.info("👥 === TRAITEMENT DÉMOGRAPHIE ===")
    
    for src in sources:
        logger.info(f"📊 Source: {src['name']}")
        
        try:
            if src["type"] == "api_csv":
                # Récupérer l'URL CSV depuis l'API
                csv_url = get_census_csv_url(src["url"])
                
                # Télécharger et traiter le CSV
                logger.info("📥 Téléchargement des données de recensement...")
                df = pd.read_csv(csv_url, low_memory=False)
                logger.info(f"📊 {len(df)} lignes chargées")
                
                # Normaliser les colonnes
                df.columns = [c.lower().replace(' ', '_').replace('(', '').replace(')', '') for c in df.columns]
                
                # Sauvegarder
                output_path = CURATED_DIR / "demography.parquet"
                df.to_parquet(output_path, index=False)
                logger.info(f"💾 Sauvé: {output_path}")
                
        except Exception as e:
            logger.error(f"❌ Erreur traitement {src['id']}: {e}")
            continue


def process_rental_data(sources: List[Dict]) -> None:
    """Traite les données de loyers et vacance."""
    logger.info("🏠 === TRAITEMENT LOYERS/VACANCE ===")
    
    for src in sources:
        logger.info(f"📊 Source: {src['name']}")
        logger.warning("⚠️  SCHL - Nécessite implémentation API spécifique")
        continue


def process_starts_data(sources: List[Dict]) -> None:
    """Traite les données de mises en chantier."""
    logger.info("🏗️  === TRAITEMENT MISES EN CHANTIER ===")
    
    for src in sources:
        logger.info(f"📊 Source: {src['name']}")
        logger.warning("⚠️  SCHL - Nécessite implémentation API spécifique")
        continue


def process_permits_data(sources: List[Dict]) -> None:
    """Traite les données de permis de construction."""
    logger.info("🏢 === TRAITEMENT PERMIS CONSTRUCTION ===")
    
    for src in sources:
        logger.info(f"📊 Source: {src['name']}")
        
        try:
            if src["type"] == "ckan_api":
                # Télécharger depuis l'API CKAN de Montréal
                json_path = download_file(src["url"], RAW_DIR / src["dest"])
                
                with open(json_path, 'r') as f:
                    ckan_data = json.load(f)
                
                # Extraire les records
                records = ckan_data.get('result', {}).get('records', [])
                if not records:
                    logger.warning("⚠️  Aucune donnée trouvée dans la réponse CKAN")
                    continue
                
                df = pd.DataFrame(records)
                logger.info(f"📊 {len(df)} permis chargés")
                
                # Normaliser colonnes
                df.columns = [c.lower() for c in df.columns]
                
                # Créer géométrie si coordonnées présentes
                if 'longitude' in df.columns and 'latitude' in df.columns:
                    df_clean = df.dropna(subset=['longitude', 'latitude'])
                    df_clean['longitude'] = pd.to_numeric(df_clean['longitude'], errors='coerce')
                    df_clean['latitude'] = pd.to_numeric(df_clean['latitude'], errors='coerce')
                    df_clean = df_clean.dropna(subset=['longitude', 'latitude'])
                    
                    gdf = gpd.GeoDataFrame(
                        df_clean,
                        geometry=gpd.points_from_xy(df_clean.longitude, df_clean.latitude),
                        crs='EPSG:4326'
                    )
                    
                    # Sauvegarder en GeoJSON
                    output_path = CURATED_DIR / "permits.geojson"
                    gdf.to_file(output_path, driver="GeoJSON")
                    logger.info(f"💾 Sauvé: {output_path}")
                else:
                    # Pas de coordonnées, sauvegarder en Parquet
                    output_path = CURATED_DIR / "permits.parquet"
                    df.to_parquet(output_path, index=False)
                    logger.info(f"💾 Sauvé: {output_path}")
            
        except Exception as e:
            logger.error(f"❌ Erreur traitement {src['id']}: {e}")
            continue


def process_poi_data(sources: List[Dict]) -> None:
    """Traite les données de points d'intérêt OpenStreetMap."""
    logger.info("📍 === TRAITEMENT POINTS D'INTÉRÊT ===")
    
    for src in sources:
        logger.info(f"📊 Source: {src['name']}")
        
        try:
            # Télécharger via Overpass API
            json_path = download_file(
                src["url"],
                RAW_DIR / src["dest"],
                method=src.get("method", "get"),
                body=src.get("body"),
                timeout=60
            )
            
            # Traiter le JSON
            with open(json_path, 'r') as f:
                osm_data = json.load(f)
            
            elements = osm_data.get("elements", [])
            rows = []
            
            for element in elements:
                # Points
                if "lon" in element and "lat" in element:
                    lon, lat = element["lon"], element["lat"]
                # Chemins (utiliser le centre)
                elif "center" in element:
                    lon, lat = element["center"]["lon"], element["center"]["lat"]
                else:
                    continue
                
                tags = element.get("tags", {})
                kind = (tags.get("amenity") or 
                       tags.get("shop") or 
                       tags.get("leisure") or 
                       tags.get("tourism") or
                       "unknown")
                
                name = tags.get("name", "")
                
                rows.append({
                    "lon": lon,
                    "lat": lat, 
                    "kind": kind,
                    "name": name,
                    "osm_type": element.get("type", "unknown"),
                    "osm_id": element.get("id", 0)
                })
            
            # Créer DataFrame
            df_poi = pd.DataFrame(rows)
            logger.info(f"📊 {len(df_poi)} points d'intérêt extraits")
            
            # Sauvegarder
            output_path = CURATED_DIR / "poi.parquet"
            df_poi.to_parquet(output_path, index=False)
            logger.info(f"💾 Sauvé: {output_path}")
            
        except Exception as e:
            logger.error(f"❌ Erreur traitement {src['id']}: {e}")
            continue


def collect() -> None:
    """Fonction principale de collecte."""
    logger.info("🚀 === DÉBUT COLLECTE DONNÉES INVESTMTL ===")
    logger.info("=" * 60)
    
    start_time = time.time()
    
    try:
        # Traiter chaque type de données
        process_areas_data(DATA_SOURCES["areas"])
        process_demography_data(DATA_SOURCES["demography"])
        process_rental_data(DATA_SOURCES["rent_vacancy"])
        process_starts_data(DATA_SOURCES["starts"])
        process_permits_data(DATA_SOURCES["permits"])
        process_poi_data(DATA_SOURCES["poi"])
        
        # Résumé final
        elapsed = time.time() - start_time
        logger.info("=" * 60)
        logger.info("✅ COLLECTE TERMINÉE!")
        logger.info(f"⏱️  Temps total: {elapsed:.1f}s")
        
        # Lister les fichiers générés
        curated_files = list(CURATED_DIR.glob("*"))
        if curated_files:
            logger.info("📁 Fichiers générés:")
            for file_path in sorted(curated_files):
                if file_path.is_file():
                    size_mb = file_path.stat().st_size / (1024 * 1024)
                    logger.info(f"   • {file_path.name}: {size_mb:.1f} MB")
        
    except Exception as e:
        logger.error(f"❌ Erreur fatale durant la collecte: {e}")
        raise


if __name__ == "__main__":
    collect()
