#!/usr/bin/env python3
"""
Ingest data from Statistics Canada.
Downloads census data for Montreal metropolitan area.
"""

import json
import os
import requests
import pandas as pd
import zipfile
import tempfile
from pathlib import Path
from datetime import datetime
import logging
from typing import cast

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Statistics Canada API endpoints
STATCAN_API_BASE = "https://www12.statcan.gc.ca/rest/census-recensement/2021"
MONTREAL_CMA_CODE = "462"  # Montreal CMA code

# Census variables of interest
CENSUS_VARIABLES = {
    "population": "1",
    "dwellings": "2", 
    "households": "3",
    "income_median": "1920",
    "income_average": "1921",
    "age_median": "13",
    "education_university": "1365",
}

def setup_directories():
    """Create necessary directories."""
    for dir_name in ["data/raw", "data/processed", "data/curated"]:
        Path(dir_name).mkdir(parents=True, exist_ok=True)

def fetch_census_data(variable_id: str, geo_level: str = "DA") -> pd.DataFrame:
    """
    Fetch census data from Statistics Canada.
    
    Args:
        variable_id: Census variable ID
        geo_level: Geographic level (DA=Dissemination Area, CT=Census Tract)
    """
    try:
        # Construct API URL
        url = f"{STATCAN_API_BASE}/dp-pd/prof-profil/details/download-telecharger/comp/GetFile"
        
        params = {
            "c": MONTREAL_CMA_CODE,
            "g": geo_level,
            "format": "CSV",
            "f": "1"
        }
        
        response = requests.get(url, params=params, timeout=120)
        response.raise_for_status()
        
        # Parse CSV content
        df = pd.read_csv(response.text, low_memory=False)
        
        # Filter for our variables of interest
        df_filtered = df[df["CHARACTERISTIC_ID"].isin(CENSUS_VARIABLES.values())]
        
        logger.info(f"Fetched {len(df_filtered)} census records for variable {variable_id}")
        return df_filtered
        
    except Exception as e:
        logger.error(f"Error fetching census data for variable {variable_id}: {e}")
        return pd.DataFrame()

def process_census_data(df: pd.DataFrame) -> pd.DataFrame:
    """Process and clean census data."""
    if df.empty:
        logger.warning("No census data to process")
        return df
    
    try:
        # Standardize geographic identifiers
        df["geo_code"] = df["GEO_CODE"].astype(str)
        df["geo_name"] = df["GEO_NAME"].str.title()
        df["geo_level"] = df["GEO_LEVEL"]
        
        # Clean characteristic names
        df["characteristic"] = df["CHARACTERISTIC_NAME"].str.strip()
        
        # Parse numeric values
        df["value"] = pd.to_numeric(df["C1_COUNT_TOTAL"], errors="coerce")
        df["margin_of_error"] = pd.to_numeric(df.get("C2_RATE_TOTAL", 0), errors="coerce")
        
        # Add variable mapping
        variable_map = {v: k for k, v in CENSUS_VARIABLES.items()}
        df["variable_name"] = df["CHARACTERISTIC_ID"].map(variable_map)
        # Filter for Montreal area (postal codes starting with H)
        montreal_mask = df["geo_name"].str.contains("montreal|Montréal", case=False, na=False)
        df = cast(pd.DataFrame, df.loc[montreal_mask, :].copy())
        
        # Create pivoted version for easier analysis
        # Create pivoted version for easier analysis
        df_pivot = df.pivot_table(
            index=["geo_code", "geo_name"], 
            columns="variable_name", 
            values="value",
            aggfunc="first"
        ).reset_index()
        
        # Calculate derived metrics
        if "population" in df_pivot.columns and "dwellings" in df_pivot.columns:
            df_pivot["persons_per_dwelling"] = df_pivot["population"] / df_pivot["dwellings"]
        
        if "households" in df_pivot.columns and "dwellings" in df_pivot.columns:
            df_pivot["occupancy_rate"] = df_pivot["households"] / df_pivot["dwellings"]
        
        logger.info(f"Processed {len(df_pivot)} geographic areas")
        return df_pivot
        
    except Exception as e:
        logger.error(f"Error processing census data: {e}")
        return pd.DataFrame()

def fetch_montreal_dissemination_areas() -> pd.DataFrame:
    """
    Fetch dissemination area boundaries for Montreal.
    Note: This is a simplified version - real implementation would fetch from StatCan geodata.
    """
    try:
        # Placeholder implementation
        # In reality, would download boundary files from Statistics Canada
        logger.info("Fetching Montreal dissemination areas...")
        
        # Create dummy data structure
        dummy_das = []
        for i in range(1000, 1100):  # Sample DA codes for Montreal
            dummy_das.append({
                "da_code": f"2466{i:04d}",
                "da_name": f"Montreal DA {i}",
                "centroid_lat": 45.5017 + (i - 1050) * 0.001,
                "centroid_lon": -73.5673 + (i - 1050) * 0.001,
                "area_km2": 0.5 + (i % 10) * 0.1
            })
        
        df = pd.DataFrame(dummy_das)
        logger.info(f"Generated {len(df)} sample dissemination areas")
        return df
        
    except Exception as e:
        logger.error(f"Error fetching dissemination areas: {e}")
        return pd.DataFrame()

def main():
    """Main ingestion function for Statistics Canada data."""
    logger.info("Starting Statistics Canada data ingestion")
    setup_directories()
    
    # Note: Real implementation would require proper API access
    # This is a simplified version for demonstration
    
    # Create sample census data
    logger.info("Creating sample census data...")
    sample_data = []
    
    for da_code in range(24661000, 24661100):
        for var_name, var_id in CENSUS_VARIABLES.items():
            sample_data.append({
                "GEO_CODE": str(da_code),
                "GEO_NAME": f"Montreal DA {da_code}",
                "GEO_LEVEL": "Dissemination area",
                "CHARACTERISTIC_ID": var_id,
                "CHARACTERISTIC_NAME": var_name.title(),
                "C1_COUNT_TOTAL": 100 + (da_code % 500),  # Sample values
            })
    
    df = pd.DataFrame(sample_data)
    processed_df = process_census_data(df)
    
    if not processed_df.empty:
        processed_df.to_parquet("data/raw/statcan_census.parquet", index=False)
        logger.info("Saved census data to data/raw/statcan_census.parquet")
    
    # Fetch dissemination area boundaries
    das_df = fetch_montreal_dissemination_areas()
    if not das_df.empty:
        das_df.to_parquet("data/raw/statcan_dissemination_areas.parquet", index=False)
        logger.info("Saved DA boundaries to data/raw/statcan_dissemination_areas.parquet")
    
    # Create summary
    summary = {
        "ingestion_date": datetime.now().isoformat(),
        "census_records": len(processed_df),
        "dissemination_areas": len(das_df),
        "variables": list(CENSUS_VARIABLES.keys()),
        "note": "Sample data for demonstration - replace with real StatCan API calls"
    }
    
    with open("data/raw/statcan_summary.json", "w") as f:
        json.dump(summary, f, indent=2)
    
    logger.info("Statistics Canada data ingestion completed")

if __name__ == "__main__":
    main()
