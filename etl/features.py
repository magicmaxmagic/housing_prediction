#!/usr/bin/env python3
"""
Feature engineering for Montreal housing investment analysis.
Combines all ingested data sources to create analysis-ready features.
"""

import json
import pandas as pd
import geopandas as gpd
import numpy as np
import duckdb
from pathlib import Path
from datetime import datetime, timedelta
import logging
from sklearn.preprocessing import StandardScaler, RobustScaler
from sklearn.impute import SimpleImputer

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def setup_directories():
    """Create necessary directories."""
    for dir_name in ["data/processed", "data/curated"]:
        Path(dir_name).mkdir(parents=True, exist_ok=True)

def load_raw_data() -> dict:
    """Load all raw data files."""
    data = {}
    
    try:
        # Montreal data
        if Path("data/raw/mtl_permits.parquet").exists():
            data["permits"] = pd.read_parquet("data/raw/mtl_permits.parquet")
            logger.info(f"Loaded {len(data['permits'])} permit records")
        
        if Path("data/raw/mtl_districts.geojson").exists():
            data["districts"] = gpd.read_file("data/raw/mtl_districts.geojson")
            logger.info(f"Loaded {len(data['districts'])} districts")
        
        # Statistics Canada data
        if Path("data/raw/statcan_census.parquet").exists():
            data["census"] = pd.read_parquet("data/raw/statcan_census.parquet")
            logger.info(f"Loaded {len(data['census'])} census records")
        
        if Path("data/raw/statcan_dissemination_areas.parquet").exists():
            data["dissemination_areas"] = pd.read_parquet("data/raw/statcan_dissemination_areas.parquet")
            logger.info(f"Loaded {len(data['dissemination_areas'])} dissemination areas")
        
        # CMHC data
        if Path("data/raw/cmhc_rental.parquet").exists():
            data["rental"] = pd.read_parquet("data/raw/cmhc_rental.parquet")
            logger.info(f"Loaded {len(data['rental'])} rental records")
        
        if Path("data/raw/cmhc_housing_starts.parquet").exists():
            data["housing_starts"] = pd.read_parquet("data/raw/cmhc_housing_starts.parquet")
            logger.info(f"Loaded {len(data['housing_starts'])} housing starts records")
        
    except Exception as e:
        logger.error(f"Error loading raw data: {e}")
    
    return data

def create_base_geography(districts_gdf: gpd.GeoDataFrame, das_df: pd.DataFrame) -> gpd.GeoDataFrame:
    """Create base geographic units for analysis."""
    try:
        if districts_gdf.empty:
            logger.warning("No districts data available")
            return gpd.GeoDataFrame()
        
        # Use districts as base geography for now
        # In production, would use dissemination areas or census tracts
        base_geo = districts_gdf.copy()
        
        # Standardize area identifiers
        base_geo["area_id"] = base_geo.index.astype(str).str.zfill(8)
        base_geo["area_name"] = base_geo["NOM"]
        base_geo["area_type"] = "district"
        
        # Ensure CRS is WGS84
        if base_geo.crs != "EPSG:4326":
            base_geo = base_geo.to_crs("EPSG:4326")
        
        logger.info(f"Created {len(base_geo)} base geographic units")
        return base_geo
        
    except Exception as e:
        logger.error(f"Error creating base geography: {e}")
        return gpd.GeoDataFrame()

def calculate_construction_features(permits_df: pd.DataFrame, base_geo: gpd.GeoDataFrame) -> pd.DataFrame:
    """Calculate construction-related features."""
    if permits_df.empty or base_geo.empty:
        return pd.DataFrame()
    
    try:
        # Aggregate permits by district
        construction_features = permits_df.groupby("arrondissement").agg({
            "valeur_travaux": ["sum", "mean", "count"],
            "is_residential": "sum",
            "is_new_construction": "sum",
        }).reset_index()
        
        # Flatten column names
        construction_features.columns = [
            "district_name", "construction_value_total", "construction_value_mean", 
            "permits_count", "residential_permits", "new_construction_permits"
        ]
        
        # Calculate rates
        construction_features["residential_rate"] = (
            construction_features["residential_permits"] / construction_features["permits_count"]
        )
        construction_features["new_construction_rate"] = (
            construction_features["new_construction_permits"] / construction_features["permits_count"]
        )
        
        # Calculate recent trends (last 12 months)
        recent_date = permits_df["date_emission"].max() - timedelta(days=365)
        recent_permits = permits_df[permits_df["date_emission"] >= recent_date]
        
        recent_features = recent_permits.groupby("arrondissement").agg({
            "valeur_travaux": "sum",
            "is_residential": "sum",
        }).reset_index()
        
        recent_features.columns = ["district_name", "recent_construction_value", "recent_residential_permits"]
        
        # Merge features
        features = construction_features.merge(recent_features, on="district_name", how="left")
        features.fillna(0, inplace=True)
        
        logger.info(f"Calculated construction features for {len(features)} districts")
        return features
        
    except Exception as e:
        logger.error(f"Error calculating construction features: {e}")
        return pd.DataFrame()

def calculate_demographic_features(census_df: pd.DataFrame) -> pd.DataFrame:
    """Calculate demographic features from census data."""
    if census_df.empty:
        return pd.DataFrame()
    
    try:
        # Census data should already be processed and pivoted
        demo_features = census_df.copy()
        
        # Calculate additional derived features
        if "income_median" in demo_features.columns and "income_average" in demo_features.columns:
            # Income inequality proxy (higher ratio = more inequality)
            demo_features["income_inequality"] = (
                demo_features["income_average"] / demo_features["income_median"]
            )
        
        if "population" in demo_features.columns and demo_features["population"].sum() > 0:
            # Population density (would need actual area data)
            demo_features["pop_density_proxy"] = demo_features["population"] / 1000  # Placeholder
        
        # Standardize area identifiers to match base geography
        demo_features["area_id"] = demo_features["geo_code"]
        
        logger.info(f"Calculated demographic features for {len(demo_features)} areas")
        return demo_features
        
    except Exception as e:
        logger.error(f"Error calculating demographic features: {e}")
        return pd.DataFrame()

def calculate_housing_market_features(rental_df: pd.DataFrame, starts_df: pd.DataFrame) -> pd.DataFrame:
    """Calculate housing market features from CMHC data."""
    try:
        features_list = []
        
        # Process rental data
        if not rental_df.empty:
            # Latest year rental features by district
            latest_year = rental_df["year"].max()
            latest_rental = rental_df[rental_df["year"] == latest_year]
            
            rental_features = latest_rental.groupby("district").agg({
                "average_rent": "mean",
                "vacancy_rate": "mean",
                "rent_change_1yr": "mean",
                "rental_universe": "sum"
            }).reset_index()
            
            rental_features.columns = [
                "district_name", "avg_rent", "vacancy_rate", 
                "rent_growth", "rental_supply"
            ]
            
            features_list.append(rental_features)
        
        # Process housing starts data
        if not starts_df.empty:
            # Recent housing starts (last 12 months)
            recent_date = starts_df["date"].max() - timedelta(days=365)
            recent_starts = starts_df[starts_df["date"] >= recent_date]
            
            starts_features = recent_starts.groupby("region").agg({
                "housing_starts": "sum"
            }).reset_index()
            
            starts_features.columns = ["region_name", "recent_housing_starts"]
            
            # Map regions to districts (simplified mapping)
            region_district_map = {
                "Montreal Island": "Montreal",
                "Laval": "Laval",
                "North Shore": "North Shore",
                "South Shore": "South Shore"
            }
            
            starts_features["district_name"] = starts_features["region_name"].map(region_district_map)
            features_list.append(starts_features[["district_name", "recent_housing_starts"]])
        
        # Combine all housing market features
        if features_list:
            housing_features = features_list[0]
            for df in features_list[1:]:
                housing_features = housing_features.merge(df, on="district_name", how="outer")
            
            housing_features.fillna(0, inplace=True)
            
            logger.info(f"Calculated housing market features for {len(housing_features)} areas")
            return housing_features
        else:
            return pd.DataFrame()
            
    except Exception as e:
        logger.error(f"Error calculating housing market features: {e}")
        return pd.DataFrame()

def calculate_accessibility_features(base_geo: gpd.GeoDataFrame) -> pd.DataFrame:
    """Calculate accessibility features (simplified version)."""
    try:
        # This is a simplified version - real implementation would use GTFS data
        # and calculate actual travel times to key destinations
        
        access_features = []
        
        for idx, area in base_geo.iterrows():
            # Calculate distance to downtown Montreal (approximate)
            downtown_lat, downtown_lon = 45.5017, -73.5673
            area_lat, area_lon = area["centroid_lat"], area["centroid_lon"]
            
            # Euclidean distance (simplified)
            distance_to_cbd = np.sqrt(
                (area_lat - downtown_lat)**2 + (area_lon - downtown_lon)**2
            ) * 111  # Rough conversion to km
            
            # Accessibility score (inverse of distance, scaled)
            accessibility_score = max(0, 100 - distance_to_cbd * 2)
            
            access_features.append({
                "area_id": area["area_id"],
                "area_name": area["area_name"],
                "distance_to_cbd": distance_to_cbd,
                "accessibility_score": accessibility_score,
                "transit_accessibility": min(100, accessibility_score * 1.2),  # Placeholder
            })
        
        df = pd.DataFrame(access_features)
        logger.info(f"Calculated accessibility features for {len(df)} areas")
        return df
        
    except Exception as e:
        logger.error(f"Error calculating accessibility features: {e}")
        return pd.DataFrame()

def combine_all_features(base_geo: gpd.GeoDataFrame, feature_dfs: list) -> gpd.GeoDataFrame:
    """Combine all features into final dataset."""
    try:
        # Start with base geography
        combined = base_geo.copy()
        
        # Merge each feature dataset
        for feature_df in feature_dfs:
            if feature_df.empty:
                continue
                
            # Determine merge key
            if "area_id" in feature_df.columns:
                merge_key = "area_id"
            elif "district_name" in feature_df.columns:
                merge_key = "area_name"
                feature_df = feature_df.rename(columns={"district_name": "area_name"})
            else:
                logger.warning(f"Cannot merge feature dataset - no matching key")
                continue
            
            combined = combined.merge(feature_df, on=merge_key, how="left")
        
        # Fill missing values
        numeric_columns = combined.select_dtypes(include=[np.number]).columns
        combined[numeric_columns] = combined[numeric_columns].fillna(0)
        
        # Add metadata
        combined["last_updated"] = datetime.now().isoformat()
        combined["data_quality_score"] = 0.8  # Placeholder
        
        logger.info(f"Combined features for {len(combined)} areas with {len(combined.columns)} variables")
        return combined
        
    except Exception as e:
        logger.error(f"Error combining features: {e}")
        return base_geo

def main():
    """Main feature engineering pipeline."""
    logger.info("Starting feature engineering")
    setup_directories()
    
    # Load raw data
    raw_data = load_raw_data()
    
    # Create base geography
    base_geo = create_base_geography(
        raw_data.get("districts", gpd.GeoDataFrame()),
        raw_data.get("dissemination_areas", pd.DataFrame())
    )
    
    if base_geo.empty:
        logger.error("No base geography available - cannot continue")
        return
    
    # Calculate feature sets
    feature_datasets = []
    
    # Construction features
    construction_features = calculate_construction_features(
        raw_data.get("permits", pd.DataFrame()), base_geo
    )
    if not construction_features.empty:
        feature_datasets.append(construction_features)
    
    # Demographic features  
    demographic_features = calculate_demographic_features(
        raw_data.get("census", pd.DataFrame())
    )
    if not demographic_features.empty:
        feature_datasets.append(demographic_features)
    
    # Housing market features
    housing_features = calculate_housing_market_features(
        raw_data.get("rental", pd.DataFrame()),
        raw_data.get("housing_starts", pd.DataFrame())
    )
    if not housing_features.empty:
        feature_datasets.append(housing_features)
    
    # Accessibility features
    accessibility_features = calculate_accessibility_features(base_geo)
    if not accessibility_features.empty:
        feature_datasets.append(accessibility_features)
    
    # Combine all features
    final_features = combine_all_features(base_geo, feature_datasets)
    
    # Save results
    final_features.to_file("data/processed/montreal_features.geojson", driver="GeoJSON")
    
    # Also save as parquet for faster loading
    features_df = final_features.drop(columns="geometry")
    features_df.to_parquet("data/processed/montreal_features.parquet", index=False)
    
    # Create feature summary
    summary = {
        "processing_date": datetime.now().isoformat(),
        "areas_count": len(final_features),
        "features_count": len(final_features.columns) - 2,  # Exclude geometry and index
        "feature_categories": [
            "construction", "demographic", "housing_market", "accessibility"
        ],
        "data_sources": list(raw_data.keys())
    }
    
    with open("data/processed/features_summary.json", "w") as f:
        json.dump(summary, f, indent=2)
    
    logger.info("Feature engineering completed successfully")

if __name__ == "__main__":
    main()
