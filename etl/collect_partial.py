#!/usr/bin/env python3
"""
Collecte partielle des données principales pour InvestMTL
- Aires de diffusion (StatCan) 
- POI (OpenStreetMap)
- Test des permis (Montréal)
"""

import sys
from pathlib import Path

# Ajouter le répertoire parent au path
sys.path.append(str(Path(__file__).parent))

from collect_data_improved import (
    process_areas_data, 
    process_poi_data, 
    process_permits_data,
    logger, 
    CURATED_DIR
)
import time

def collect_essential_data():
    """Collecte les données essentielles seulement."""
    logger.info("🎯 === COLLECTE PARTIELLE INVESTMTL ===")
    logger.info("Collecte des données essentielles seulement...")
    logger.info("=" * 50)
    
    start_time = time.time()
    
    # 1. Aires de diffusion de Montréal (données géographiques de base)
    areas_sources = [
        {
            "id": "statcan_dissemination_areas_2021",
            "name": "Aires de diffusion 2021 - StatCan",
            "url": "https://www12.statcan.gc.ca/census-recensement/2021/geo/bound-limit/files/fra/lda_000b21a_f.zip",
            "type": "zip_shapefile",
            "dest": "areas/statcan_da_2021.zip",
            "filter": "montreal"
        }
    ]
    
    # 2. Points d'intérêt complets (mais avec timeout réduit)
    poi_sources = [
        {
            "id": "osm_amenities_montreal",
            "name": "Points d'intérêt - OpenStreetMap",
            "url": "https://overpass-api.de/api/interpreter",
            "type": "overpass",
            "method": "post",
            "dest": "poi/osm_montreal.json",
            "body": """[out:json][timeout:20];
(
  node["amenity"~"^(school|hospital|pharmacy|bank|restaurant|cafe|library|museum|park|subway_station)$"](45.3,-74.0,45.7,-73.0);
  way["amenity"~"^(school|hospital|pharmacy|bank|restaurant|cafe|library|museum|park|subway_station)$"](45.3,-74.0,45.7,-73.0);
);
out center;"""
        }
    ]
    
    # 3. Permis de construction (test avec limite)
    permits_sources = [
        {
            "id": "montreal_building_permits",
            "name": "Permis de construction - Ville de Montréal",
            "url": "https://donnees.montreal.ca/api/3/action/datastore_search?resource_id=f52e154f-9d8c-4ea5-bf26-a27db4e3ed05&limit=1000",
            "type": "ckan_api",
            "dest": "permits/montreal_permits.json"
        }
    ]
    
    try:
        # Collecte des données
        logger.info("🗺️  Collecte des aires de diffusion...")
        process_areas_data(areas_sources)
        
        logger.info("📍 Collecte des points d'intérêt...")
        process_poi_data(poi_sources)
        
        logger.info("🏢 Collecte des permis de construction...")
        process_permits_data(permits_sources)
        
        # Résumé
        elapsed = time.time() - start_time
        logger.info("=" * 50)
        logger.info("✅ COLLECTE PARTIELLE TERMINÉE!")
        logger.info(f"⏱️  Temps total: {elapsed:.1f}s")
        
        # Lister les fichiers générés
        curated_files = list(CURATED_DIR.glob("*"))
        if curated_files:
            logger.info("📁 Fichiers générés:")
            for file_path in sorted(curated_files):
                if file_path.is_file():
                    size_mb = file_path.stat().st_size / (1024 * 1024)
                    logger.info(f"   • {file_path.name}: {size_mb:.1f} MB")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Erreur durant la collecte partielle: {e}")
        return False

if __name__ == "__main__":
    success = collect_essential_data()
    if success:
        print("\n🎉 Collecte partielle réussie !")
        print("💡 Pour la collecte complète, utilisez: python collect_data_improved.py")
    else:
        print("\n❌ Échec de la collecte partielle")
        sys.exit(1)
