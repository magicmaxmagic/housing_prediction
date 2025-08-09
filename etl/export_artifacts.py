#!/usr/bin/env python3
"""
Export artifacts to Cloudflare R2 and D1 for API consumption.
Final step of ETL pipeline - prepares data for production use.
"""

import json
import pandas as pd
import geopandas as gpd
import numpy as np
from pathlib import Path
from datetime import datetime
import logging
import sqlite3
import os
from typing import Dict, Any
import subprocess

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def setup_directories():
    """Create necessary directories."""
    for dir_name in ["data/curated", "data/export"]:
        Path(dir_name).mkdir(parents=True, exist_ok=True)

def load_final_data() -> Dict[str, Any]:
    """Load all final processed data."""
    data = {}
    
    try:
        # Load scores
        if Path("data/curated/scores.parquet").exists():
            data["scores"] = pd.read_parquet("data/curated/scores.parquet")
            logger.info(f"Loaded scores for {len(data['scores'])} areas")
        
        # Load forecasts
        if Path("data/curated/forecasts.json").exists():
            with open("data/curated/forecasts.json", "r") as f:
                data["forecasts"] = json.load(f)
            logger.info(f"Loaded {len(data['forecasts'])} forecasts")
        
        # Load features with geometry
        if Path("data/processed/montreal_features.geojson").exists():
            data["features_geo"] = gpd.read_file("data/processed/montreal_features.geojson")
            logger.info(f"Loaded geographic features for {len(data['features_geo'])} areas")
        
    except Exception as e:
        logger.error(f"Error loading final data: {e}")
    
    return data

def create_areas_topojson(features_gdf: gpd.GeoDataFrame, scores_df: pd.DataFrame) -> dict:
    """Create simplified TopoJSON for map visualization."""
    try:
        if features_gdf.empty or scores_df.empty:
            return {}
        
        # Merge scores with geometry
        areas_gdf = features_gdf.merge(
            scores_df[["area_id", "total", "quantile"]], 
            on="area_id", 
            how="left"
        )
        
        # Simplify geometries for web use
        areas_gdf["geometry"] = areas_gdf["geometry"].simplify(
            tolerance=0.001, preserve_topology=True
        )
        
        # Select only necessary columns
        columns_to_keep = [
            "area_id", "area_name", "total", "quantile", "geometry"
        ]
        available_columns = [col for col in columns_to_keep if col in areas_gdf.columns]
        areas_gdf = areas_gdf[available_columns]
        
        # Convert to GeoJSON format
        geojson = json.loads(areas_gdf.to_json())
        
        # Simplify properties
        for feature in geojson["features"]:
            props = feature["properties"]
            feature["properties"] = {
                "id": props.get("area_id", ""),
                "name": props.get("area_name", ""),
                "score": round(props.get("total", 0), 1),
                "quantile": int(props.get("quantile", 3))
            }
        
        logger.info(f"Created TopoJSON with {len(geojson['features'])} areas")
        return geojson
        
    except Exception as e:
        logger.error(f"Error creating TopoJSON: {e}")
        return {}

def prepare_api_data(scores_df: pd.DataFrame, forecasts: dict) -> dict:
    """Prepare data structures optimized for API responses."""
    try:
        api_data = {}
        
        # Areas summary for map
        if not scores_df.empty:
            areas_summary = []
            for _, row in scores_df.iterrows():
                areas_summary.append({
                    "id": row["area_id"],
                    "name": row["area_name"],
                    "score": round(row["total"], 1),
                    "quantile": int(row["quantile"]),
                    "scores": {
                        "growth": round(row["growth"], 1),
                        "supply": round(row["supply"], 1), 
                        "tension": round(row["tension"], 1),
                        "accessibility": round(row["accessibility"], 1),
                        "returns": round(row["returns"], 1)
                    }
                })
            
            api_data["areas"] = areas_summary
        
        # Forecasts organized by area and metric
        if forecasts:
            forecasts_by_area = {}
            
            for forecast_key, forecast_data in forecasts.items():
                # Parse forecast key to extract area and metric info
                if "district" in forecast_data:
                    area_name = forecast_data["district"]
                elif "region" in forecast_data:
                    area_name = forecast_data["region"] 
                else:
                    continue
                
                metric = forecast_data.get("metric", "unknown")
                
                if area_name not in forecasts_by_area:
                    forecasts_by_area[area_name] = {}
                
                forecasts_by_area[area_name][metric] = {
                    "current_value": forecast_data.get("current_value", 0),
                    "forecast": forecast_data.get("forecast", []),
                    "confidence": forecast_data.get("confidence", 0.5),
                    "model_type": forecast_data.get("model_type", "unknown")
                }
            
            api_data["forecasts"] = forecasts_by_area
        
        logger.info("Prepared API data structures")
        return api_data
        
    except Exception as e:
        logger.error(f"Error preparing API data: {e}")
        return {}

def create_d1_tables(scores_df: pd.DataFrame, forecasts: dict) -> str:
    """Create SQL statements for D1 database."""
    try:
        sql_statements = []
        
        # Clear existing data
        sql_statements.extend([
            "DELETE FROM areas;",
            "DELETE FROM scores;", 
            "DELETE FROM forecasts;"
        ])
        
        # Insert areas
        if not scores_df.empty:
            for _, row in scores_df.iterrows():
                sql_statements.append(f"""
                INSERT OR REPLACE INTO areas (id, name, geo_bbox) VALUES (
                    '{row["area_id"]}',
                    '{row["area_name"].replace("'", "''")}',
                    ''  -- Placeholder for bounding box
                );""")
            
            # Insert scores
            for _, row in scores_df.iterrows():
                sql_statements.append(f"""
                INSERT OR REPLACE INTO scores (
                    area_id, as_of, s_growth, s_supply, s_tension, 
                    s_access, s_return, s_total
                ) VALUES (
                    '{row["area_id"]}',
                    '{datetime.now().strftime("%Y-%m-%d")}',
                    {row["growth"]:.2f},
                    {row["supply"]:.2f},
                    {row["tension"]:.2f},
                    {row["accessibility"]:.2f},
                    {row["returns"]:.2f},
                    {row["total"]:.2f}
                );""")
        
        # Insert forecasts
        for forecast_key, forecast_data in forecasts.items():
            area_id = forecast_data.get("district", forecast_data.get("region", "unknown"))
            area_id = area_id.replace(" ", "_")
            metric = forecast_data.get("metric", "unknown")
            
            for i, point in enumerate(forecast_data.get("forecast", [])):
                sql_statements.append(f"""
                INSERT OR REPLACE INTO forecasts (
                    area_id, metric, horizon, yhat, yhat_low, yhat_upper, as_of
                ) VALUES (
                    '{area_id}',
                    '{metric}',
                    {i + 1},
                    {point["yhat"]:.2f},
                    {point["yhat_lower"]:.2f},
                    {point["yhat_upper"]:.2f},
                    '{datetime.now().strftime("%Y-%m-%d")}'
                );""")
        
        sql_script = "\n".join(sql_statements)
        logger.info(f"Generated {len(sql_statements)} SQL statements")
        return sql_script
        
    except Exception as e:
        logger.error(f"Error creating D1 tables: {e}")
        return ""

def export_to_files(data: dict, api_data: dict, areas_geojson: dict, sql_script: str):
    """Export all artifacts to files."""
    try:
        # Export GeoJSON for map
        if areas_geojson:
            with open("data/curated/areas_topojson.json", "w") as f:
                json.dump(areas_geojson, f, separators=(",", ":"))
            logger.info("Exported areas TopoJSON")
        
        # Export API-ready data
        if api_data:
            with open("data/curated/api_data.json", "w") as f:
                json.dump(api_data, f, indent=2)
            logger.info("Exported API data")
        
        # Export SQL script
        if sql_script:
            with open("data/curated/d1_migration.sql", "w") as f:
                f.write(sql_script)
            logger.info("Exported D1 migration SQL")
        
        # Export summary CSV for D1 (lightweight)
        if "scores" in data and not data["scores"].empty:
            summary_df = data["scores"][[
                "area_id", "area_name", "total", "quantile", "last_updated"
            ]].copy()
            summary_df.columns = ["id", "name", "score", "quantile", "updated"]
            summary_df.to_csv("data/curated/summary.csv", index=False)
            logger.info("Exported summary CSV")
        
        # Create data manifest
        manifest = {
            "export_date": datetime.now().isoformat(),
            "files": {
                "areas_topojson.json": "Simplified GeoJSON for map visualization",
                "api_data.json": "API-ready data structures", 
                "d1_migration.sql": "SQL script for D1 database",
                "summary.csv": "Lightweight summary for D1",
                "scores.json": "Complete scores data",
                "forecasts.json": "Complete forecasts data"
            },
            "data_counts": {
                "areas": len(data.get("scores", [])),
                "forecasts": len(data.get("forecasts", {}))
            }
        }
        
        with open("data/curated/manifest.json", "w") as f:
            json.dump(manifest, f, indent=2)
        
        logger.info("Created data manifest")
        
    except Exception as e:
        logger.error(f"Error exporting files: {e}")

def upload_to_r2():
    """Upload artifacts to Cloudflare R2 (requires wrangler CLI)."""
    try:
        # Check if wrangler is available and configured
        result = subprocess.run(["wrangler", "--version"], 
                              capture_output=True, text=True)
        
        if result.returncode != 0:
            logger.warning("Wrangler CLI not available - skipping R2 upload")
            return
        
        # Upload files to R2
        files_to_upload = [
            "data/curated/areas_topojson.json",
            "data/curated/api_data.json", 
            "data/curated/scores.json",
            "data/curated/forecasts.json",
            "data/curated/manifest.json"
        ]
        
        bucket_name = os.getenv("R2_BUCKET_NAME", "investmtl-data")
        
        for file_path in files_to_upload:
            if Path(file_path).exists():
                file_name = Path(file_path).name
                cmd = ["wrangler", "r2", "object", "put", f"{bucket_name}/{file_name}", 
                       "--file", file_path]
                
                result = subprocess.run(cmd, capture_output=True, text=True)
                
                if result.returncode == 0:
                    logger.info(f"Uploaded {file_name} to R2")
                else:
                    logger.error(f"Failed to upload {file_name}: {result.stderr}")
        
    except Exception as e:
        logger.warning(f"R2 upload failed: {e}")

def update_d1_database():
    """Update D1 database with new data (requires wrangler CLI)."""
    try:
        # Check if D1 migration file exists
        if not Path("data/curated/d1_migration.sql").exists():
            logger.warning("No D1 migration file - skipping database update")
            return
        
        # Check if wrangler is available
        result = subprocess.run(["wrangler", "--version"], 
                              capture_output=True, text=True)
        
        if result.returncode != 0:
            logger.warning("Wrangler CLI not available - skipping D1 update")
            return
        
        # Execute D1 migration
        db_name = os.getenv("D1_DATABASE_NAME", "investmtl-db")
        cmd = ["wrangler", "d1", "execute", db_name, 
               "--file", "data/curated/d1_migration.sql"]
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode == 0:
            logger.info("D1 database updated successfully")
        else:
            logger.error(f"Failed to update D1: {result.stderr}")
        
    except Exception as e:
        logger.warning(f"D1 update failed: {e}")

def main():
    """Main export artifacts pipeline."""
    logger.info("Starting artifacts export")
    setup_directories()
    
    # Load final data
    data = load_final_data()
    
    if not data:
        logger.error("No data available for export")
        return
    
    # Create areas TopoJSON
    areas_geojson = create_areas_topojson(
        data.get("features_geo", gpd.GeoDataFrame()),
        data.get("scores", pd.DataFrame())
    )
    
    # Prepare API data
    api_data = prepare_api_data(
        data.get("scores", pd.DataFrame()),
        data.get("forecasts", {})
    )
    
    # Create D1 SQL script
    sql_script = create_d1_tables(
        data.get("scores", pd.DataFrame()),
        data.get("forecasts", {})
    )
    
    # Export all files
    export_to_files(data, api_data, areas_geojson, sql_script)
    
    # Upload to cloud services (optional, requires credentials)
    upload_to_r2()
    update_d1_database()
    
    logger.info("Artifacts export completed")

if __name__ == "__main__":
    main()
