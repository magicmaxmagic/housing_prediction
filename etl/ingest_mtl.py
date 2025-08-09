#!/usr/bin/env python3
"""
Ingest data from Ville de Montréal open data portal.
Downloads construction permits, zoning data, and infrastructure data.
"""

import json
import os
import requests
import pandas as pd
import geopandas as gpd
from pathlib import Path
from datetime import datetime
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Montreal Open Data API endpoints
MTL_API_BASE = "https://donnees.montreal.ca/api/3/action"
DATASETS = {
    "permits": "f4a76c2e-9c96-47e4-8454-2e9ea4e55b5d",  # Permis de construction
    "districts": "234b0ede-4b8c-4f3b-963f-b4dc8c7b1440",  # Arrondissements
    "zoning": "d0a7b8ec-6d7e-4e3c-8c8a-9b8a7c5d2b0a",    # Zonage (placeholder)
}

def setup_directories():
    """Create necessary directories."""
    for dir_name in ["data/raw", "data/processed", "data/curated"]:
        Path(dir_name).mkdir(parents=True, exist_ok=True)

def fetch_montreal_dataset(dataset_id: str, format_type: str = "json") -> dict:
    """Fetch dataset from Montreal Open Data API."""
    try:
        # Get dataset metadata
        meta_url = f"{MTL_API_BASE}/package_show?id={dataset_id}"
        meta_response = requests.get(meta_url, timeout=30)
        meta_response.raise_for_status()
        
        metadata = meta_response.json()["result"]
        
        # Find the appropriate resource
        resource = None
        for res in metadata["resources"]:
            if res["format"].lower() == format_type.lower():
                resource = res
                break
        
        if not resource:
            logger.warning(f"No {format_type} resource found for dataset {dataset_id}")
            return {}
            
        # Download the data
        data_url = resource["url"]
        data_response = requests.get(data_url, timeout=120)
        data_response.raise_for_status()
        
        if format_type.lower() == "json":
            return data_response.json()
        else:
            return {"content": data_response.content}
            
    except Exception as e:
        logger.error(f"Error fetching dataset {dataset_id}: {e}")
        return {}

def process_construction_permits(data: dict) -> pd.DataFrame:
    """Process construction permits data."""
    if not data:
        logger.warning("No permits data available")
        return pd.DataFrame()
    
    try:
        # Convert to DataFrame
        df = pd.DataFrame(data.get("features", []))
        
        if df.empty:
            logger.warning("Empty permits dataset")
            return df
            
        # Extract properties
        df = pd.json_normalize(df["properties"].tolist())
        
        # Clean and standardize columns
        df["date_emission"] = pd.to_datetime(df.get("DATE_EMISSION", ""), errors="coerce")
        df["valeur_travaux"] = pd.to_numeric(df.get("VALEUR_TRAVAUX", 0), errors="coerce")
        df["arrondissement"] = df["ARRONDISSEMENT"].astype(str).str.title()
        df["type_travaux"] = df["NATURE_TRAVAUX"].astype(str).str.title()
        df["usage"] = df["USAGE_PREDOMINANT"].astype(str).str.title()
        
        # Filter recent permits (last 3 years)
        cutoff_date = datetime.now().replace(year=datetime.now().year - 3)
        df = df[df["date_emission"] >= cutoff_date]
        
        # Add derived features
        df["year_month"] = df["date_emission"].dt.to_period("M")
        df["is_residential"] = df["usage"].str.contains("Résidentiel", na=False)
        df["is_new_construction"] = df["type_travaux"].str.contains("Construction", na=False)
        
        logger.info(f"Processed {len(df)} construction permits")
        return df
        
    except Exception as e:
        logger.error(f"Error processing permits: {e}")
        return pd.DataFrame()

def process_districts(data: dict) -> gpd.GeoDataFrame:
    """Process districts/boroughs geometries."""
    if not data:
        logger.warning("No districts data available")
        return gpd.GeoDataFrame()
    
    try:
        gdf = gpd.GeoDataFrame.from_features(data.get("features", []))
        
        if gdf.empty:
            logger.warning("Empty districts dataset")
            return gdf
            
        # Clean district names
        gdf["NOM"] = gdf["NOM"].str.title()
        gdf["district_id"] = gdf.index.astype(str)
        
        # Simplify geometries for better performance
        gdf["geometry"] = gdf["geometry"].simplify(tolerance=0.001, preserve_topology=True)
        
        # Calculate centroids and area
        gdf["centroid_lon"] = gdf.geometry.centroid.x
        gdf["centroid_lat"] = gdf.geometry.centroid.y
        gdf["area_km2"] = gdf.geometry.area / 1_000_000  # Convert to km²
        
        logger.info(f"Processed {len(gdf)} districts")
        return gdf
        
    except Exception as e:
        logger.error(f"Error processing districts: {e}")
        return gpd.GeoDataFrame()

def main():
    """Main ingestion function."""
    logger.info("Starting Montreal data ingestion")
    setup_directories()
    
    # Ingest construction permits
    logger.info("Fetching construction permits...")
    permits_data = fetch_montreal_dataset(DATASETS["permits"], "json")
    permits_df = process_construction_permits(permits_data)
    
    if not permits_df.empty:
        permits_df.to_parquet("data/raw/mtl_permits.parquet", index=False)
        logger.info("Saved construction permits to data/raw/mtl_permits.parquet")
    
    # Ingest district boundaries
    logger.info("Fetching district boundaries...")
    districts_data = fetch_montreal_dataset(DATASETS["districts"], "json")
    districts_gdf = process_districts(districts_data)
    
    if not districts_gdf.empty:
        districts_gdf.to_file("data/raw/mtl_districts.geojson", driver="GeoJSON")
        logger.info("Saved districts to data/raw/mtl_districts.geojson")
    
    # Create summary statistics
    summary = {
        "ingestion_date": datetime.now().isoformat(),
        "permits_count": len(permits_df),
        "districts_count": len(districts_gdf),
        "data_sources": list(DATASETS.keys()),
    }
    
    with open("data/raw/mtl_summary.json", "w") as f:
        json.dump(summary, f, indent=2)
    
    logger.info("Montreal data ingestion completed")

if __name__ == "__main__":
    main()
