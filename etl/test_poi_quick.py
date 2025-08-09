#!/usr/bin/env python3
"""
Test rapide de collecte - Points d'intérêt seulement
"""

import sys
from pathlib import Path

# Ajouter le répertoire parent au path
sys.path.append(str(Path(__file__).parent))

from collect_data_improved import process_poi_data, DATA_SOURCES, logger

def test_poi_collection():
    """Test de collecte des points d'intérêt."""
    logger.info("🧪 Test de collecte des POI OSM")
    
    # Modifier temporairement la requête pour une zone plus petite
    poi_sources_test = [
        {
            "id": "osm_amenities_montreal_test",
            "name": "Points d'intérêt TEST - OpenStreetMap", 
            "url": "https://overpass-api.de/api/interpreter",
            "type": "overpass",
            "method": "post",
            "dest": "poi/osm_montreal_test.json",
            "body": """[out:json][timeout:15];
(
  node["amenity"~"^(hospital|school)$"](45.5,-73.6,45.6,-73.5);
);
out;"""
        }
    ]
    
    try:
        process_poi_data(poi_sources_test)
        logger.info("✅ Test POI terminé avec succès")
        return True
    except Exception as e:
        logger.error(f"❌ Erreur test POI: {e}")
        return False

if __name__ == "__main__":
    test_poi_collection()
