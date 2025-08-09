#!/usr/bin/env python3
"""
Ingest data from CMHC (Canada Mortgage and Housing Corporation).
Downloads rental market data for Montreal.
"""

import json
import os
import requests
import pandas as pd
from pathlib import Path
from datetime import datetime
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# CMHC Housing Market Information Portal
# Note: CMHC data often requires subscription or has limited free access
# This implementation creates sample data structure

def setup_directories():
    """Create necessary directories."""
    for dir_name in ["data/raw", "data/processed", "data/curated"]:
        Path(dir_name).mkdir(parents=True, exist_ok=True)

def create_sample_rental_data() -> pd.DataFrame:
    """
    Create sample rental market data.
    In production, would fetch from CMHC API or data files.
    """
    try:
        logger.info("Creating sample CMHC rental data...")
        
        # Sample data structure based on CMHC rental market survey
        sample_data = []
        
        # Montreal districts
        districts = [
            "Ahuntsic-Cartierville", "Anjou", "Côte-des-Neiges–Notre-Dame-de-Grâce",
            "Lachine", "LaSalle", "Le Plateau-Mont-Royal", "Le Sud-Ouest",
            "L'Île-Bizard–Sainte-Geneviève", "Mercier–Hochelaga-Maisonneuve",
            "Montréal-Nord", "Outremont", "Pierrefonds-Roxboro", "Rivière-des-Prairies–Pointe-aux-Trembles",
            "Rosemont–La Petite-Patrie", "Saint-Laurent", "Saint-Léonard", 
            "Verdun", "Ville-Marie", "Villeray–Saint-Michel–Parc-Extension"
        ]
        
        # Generate data for last 3 years
        for year in [2023, 2024, 2025]:
            for district in districts:
                for bedroom_type in ["Bachelor", "1 Bedroom", "2 Bedroom", "3+ Bedroom"]:
                    # Simulate realistic Montreal rental data
                    base_rent = {
                        "Bachelor": 900,
                        "1 Bedroom": 1200,
                        "2 Bedroom": 1600,
                        "3+ Bedroom": 2100
                    }[bedroom_type]
                    
                    # Add variation by district and year
                    district_multiplier = 1.0 + (hash(district) % 100) / 1000
                    year_growth = (year - 2023) * 0.05
                    
                    avg_rent = base_rent * district_multiplier * (1 + year_growth)
                    vacancy_rate = max(0.5, 4.0 - (year - 2023) * 0.5 + (hash(district) % 20) / 10)
                    
                    sample_data.append({
                        "year": year,
                        "district": district,
                        "bedroom_type": bedroom_type,
                        "average_rent": round(avg_rent, 0),
                        "vacancy_rate": round(vacancy_rate, 2),
                        "rental_universe": 1000 + (hash(f"{district}{bedroom_type}") % 2000),
                        "rent_change_1yr": round((year - 2023) * 3.5 + (hash(district) % 10) - 5, 2),
                        "survey_date": f"{year}-10-01"
                    })
        
        df = pd.DataFrame(sample_data)
        logger.info(f"Created {len(df)} rental market records")
        return df
        
    except Exception as e:
        logger.error(f"Error creating sample rental data: {e}")
        return pd.DataFrame()

def create_sample_housing_starts() -> pd.DataFrame:
    """
    Create sample housing starts data.
    In production, would fetch from CMHC housing starts survey.
    """
    try:
        logger.info("Creating sample housing starts data...")
        
        sample_data = []
        
        # Montreal regions
        regions = [
            "Montreal Island", "Laval", "North Shore", "South Shore", "Vaudreuil-Soulanges"
        ]
        
        # Generate monthly data for last 2 years
        for year in [2024, 2025]:
            for month in range(1, 13):
                for region in regions:
                    for dwelling_type in ["Single", "Semi", "Row", "Apartment"]:
                        # Simulate seasonal patterns
                        seasonal_factor = 1.0
                        if month in [5, 6, 7, 8, 9]:  # Construction season
                            seasonal_factor = 1.5
                        elif month in [12, 1, 2]:  # Winter slowdown
                            seasonal_factor = 0.5
                        
                        base_starts = {
                            "Single": 50,
                            "Semi": 30,
                            "Row": 40,
                            "Apartment": 200
                        }[dwelling_type]
                        
                        starts = int(base_starts * seasonal_factor * (1 + (hash(region) % 50) / 100))
                        
                        sample_data.append({
                            "year": year,
                            "month": month,
                            "date": f"{year}-{month:02d}-01",
                            "region": region,
                            "dwelling_type": dwelling_type,
                            "housing_starts": starts,
                            "intended_market": "Rental" if dwelling_type == "Apartment" else "Ownership"
                        })
        
        df = pd.DataFrame(sample_data)
        df["date"] = pd.to_datetime(df["date"])
        
        logger.info(f"Created {len(df)} housing starts records")
        return df
        
    except Exception as e:
        logger.error(f"Error creating sample housing starts data: {e}")
        return pd.DataFrame()

def process_cmhc_data(rental_df: pd.DataFrame, starts_df: pd.DataFrame) -> dict:
    """Process and aggregate CMHC data."""
    try:
        processed = {}
        
        # Process rental data
        if not rental_df.empty:
            # Calculate market indicators
            rental_summary = rental_df.groupby(["year", "district"]).agg({
                "average_rent": "weighted_average",  # Would need proper weighting
                "vacancy_rate": "mean",
                "rent_change_1yr": "mean",
                "rental_universe": "sum"
            }).reset_index()
            
            processed["rental_market"] = rental_summary
        
        # Process housing starts data
        if not starts_df.empty:
            # Monthly totals
            starts_monthly = starts_df.groupby(["year", "month", "region"]).agg({
                "housing_starts": "sum"
            }).reset_index()
            
            # Annual totals by type
            starts_annual = starts_df.groupby(["year", "region", "dwelling_type"]).agg({
                "housing_starts": "sum"
            }).reset_index()
            
            processed["housing_starts_monthly"] = starts_monthly
            processed["housing_starts_annual"] = starts_annual
        
        logger.info("Processed CMHC data successfully")
        return processed
        
    except Exception as e:
        logger.error(f"Error processing CMHC data: {e}")
        return {}

def main():
    """Main ingestion function for CMHC data."""
    logger.info("Starting CMHC data ingestion")
    setup_directories()
    
    # Create sample data (replace with real CMHC API calls in production)
    rental_df = create_sample_rental_data()
    starts_df = create_sample_housing_starts()
    
    # Process the data
    processed_data = process_cmhc_data(rental_df, starts_df)
    
    # Save raw data
    if not rental_df.empty:
        rental_df.to_parquet("data/raw/cmhc_rental.parquet", index=False)
        logger.info("Saved rental data to data/raw/cmhc_rental.parquet")
    
    if not starts_df.empty:
        starts_df.to_parquet("data/raw/cmhc_housing_starts.parquet", index=False)
        logger.info("Saved housing starts to data/raw/cmhc_housing_starts.parquet")
    
    # Save processed data
    for key, df in processed_data.items():
        if not df.empty:
            df.to_parquet(f"data/processed/cmhc_{key}.parquet", index=False)
    
    # Create summary
    summary = {
        "ingestion_date": datetime.now().isoformat(),
        "rental_records": len(rental_df),
        "housing_starts_records": len(starts_df),
        "districts_covered": rental_df["district"].nunique() if not rental_df.empty else 0,
        "regions_covered": starts_df["region"].nunique() if not starts_df.empty else 0,
        "note": "Sample data for demonstration - replace with real CMHC data access"
    }
    
    with open("data/raw/cmhc_summary.json", "w") as f:
        json.dump(summary, f, indent=2)
    
    logger.info("CMHC data ingestion completed")

if __name__ == "__main__":
    main()
