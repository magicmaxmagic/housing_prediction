#!/usr/bin/env python3
"""
Scoring module for Montreal housing investment analysis.
Combines features and forecasts to generate investment attractiveness scores.
"""

import json
import pandas as pd
import numpy as np
from pathlib import Path
from datetime import datetime
import logging
from sklearn.preprocessing import RobustScaler, MinMaxScaler
from sklearn.ensemble import IsolationForest
from typing import Optional

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Scoring weights (can be adjusted)
DEFAULT_WEIGHTS = {
    "growth": 0.25,      # Population/economic growth
    "supply": 0.20,      # Future housing supply  
    "tension": 0.20,     # Market tension (low vacancy, high rent growth)
    "accessibility": 0.20, # Transit accessibility
    "returns": 0.15      # Rental yield potential
}

def setup_directories():
    """Create necessary directories."""
    for dir_name in ["data/curated"]:
        Path(dir_name).mkdir(parents=True, exist_ok=True)

def load_features_and_forecasts() -> tuple:
    """Load processed features and forecasts."""
    features_df = pd.DataFrame()
    forecasts = {}
    
    try:
        if Path("data/processed/montreal_features.parquet").exists():
            features_df = pd.read_parquet("data/processed/montreal_features.parquet")
            logger.info(f"Loaded features for {len(features_df)} areas")
        
        if Path("data/curated/forecasts.json").exists():
            with open("data/curated/forecasts.json", "r") as f:
                forecasts = json.load(f)
            logger.info(f"Loaded {len(forecasts)} forecasts")
                
    except Exception as e:
        logger.error(f"Error loading data: {e}")
    
    return features_df, forecasts

def calculate_growth_score(features_df: pd.DataFrame) -> pd.Series:
    """Calculate growth potential score (0-100)."""
    try:
        scores = pd.Series(index=features_df.index, dtype=float)
        
        # Population density as growth proxy
        if "population" in features_df.columns:
            pop_scores = MinMaxScaler().fit_transform(
                features_df[["population"]].fillna(0)
            ).flatten() * 100
            scores = scores.fillna(0) + pop_scores * 0.4
        
        # Income growth potential
        if "income_median" in features_df.columns:
            income_scores = MinMaxScaler().fit_transform(
                features_df[["income_median"]].fillna(0)
            ).flatten() * 100
            scores = scores.fillna(0) + income_scores * 0.3
        
        # Construction activity
        if "recent_construction_value" in features_df.columns:
            construction_scores = MinMaxScaler().fit_transform(
                features_df[["recent_construction_value"]].fillna(0)
            ).flatten() * 100
            scores = scores.fillna(0) + construction_scores * 0.3
        
        # Ensure scores are in 0-100 range
        scores = pd.Series(np.clip(scores.fillna(50), 0, 100), index=features_df.index)
        
        logger.info("Calculated growth scores")
        return scores
        
    except Exception as e:
        logger.error(f"Error calculating growth scores: {e}")
        return pd.Series(index=features_df.index, dtype=float).fillna(50)

def calculate_supply_score(features_df: pd.DataFrame, forecasts: dict) -> pd.Series:
    """Calculate future supply score (0-100). Lower supply = higher score."""
    try:
        scores = pd.Series(index=features_df.index, dtype=float).fillna(50)
        
        # Recent construction permits (inverse - more permits = lower score)
        if "permits_count" in features_df.columns:
            permit_data = features_df["permits_count"].fillna(0)
            # Invert scale - fewer permits = higher score
            permit_scores = 100 - MinMaxScaler().fit_transform(
                permit_data.to_numpy().reshape(-1, 1)
            ).flatten() * 100
            scores = scores * 0.3 + permit_scores * 0.4
        
        # Housing starts forecast impact
        starts_forecast_impact = []
        for _, area in features_df.iterrows():
            area_name = area.get("area_name", "").replace(" ", "_")
            
            # Look for relevant housing starts forecast
            forecast_key = f"starts_Montreal_Island"  # Simplified - would map properly
            if forecast_key in forecasts:
                forecast = forecasts[forecast_key]
                if forecast.get("forecast"):
                    # Average forecast over next 12 months
                    avg_forecast = np.mean([
                        point["yhat"] for point in forecast["forecast"]
                    ])
                    # Normalize and invert (higher starts = lower investment score)
                    starts_impact = max(0, 100 - (avg_forecast / 500) * 100)  # Scale factor
                    starts_forecast_impact.append(min(100, starts_impact))
                else:
                    starts_forecast_impact.append(50)
            else:
                starts_forecast_impact.append(50)
        
        if starts_forecast_impact:
            scores = scores * 0.7 + pd.Series(starts_forecast_impact, index=features_df.index) * 0.3
        
        scores = np.clip(scores, 0, 100)
        logger.info("Calculated supply scores")
        # Always return as pd.Series with correct index
        scores = pd.Series(scores, index=features_df.index)
        return scores
        
    except Exception as e:
        logger.error(f"Error calculating supply scores: {e}")
        return pd.Series(index=features_df.index, dtype=float).fillna(50)

def calculate_tension_score(features_df: pd.DataFrame, forecasts: dict) -> pd.Series:
    """Calculate market tension score (0-100). High tension = high score."""
    try:
        scores = pd.Series(index=features_df.index, dtype=float).fillna(50)
        
        # Use rental market data from features if available
        tension_factors = []
        
        for _, area in features_df.iterrows():
            area_tension = 50  # Default
            
            # Low vacancy rate increases tension score
            if "vacancy_rate" in area:
                vacancy = area["vacancy_rate"]
                if not pd.isna(vacancy):
                    # Lower vacancy = higher tension (invert scale)
                    vacancy_score = max(0, 100 - (vacancy / 5) * 100)  # 5% vacancy = 0 points
                    area_tension = area_tension * 0.5 + vacancy_score * 0.3
            
            # High rent growth increases tension score
            if "rent_growth" in area:
                rent_growth = area["rent_growth"]
                if not pd.isna(rent_growth) and rent_growth > 0:
                    # Scale rent growth to score (5% growth = 100 points)
                    growth_score = min(100, (rent_growth / 5) * 100)
                    area_tension = area_tension * 0.7 + growth_score * 0.2
            
            tension_factors.append(min(100, max(0, area_tension)))
        
        scores = pd.Series(tension_factors, index=features_df.index)
        
        logger.info("Calculated tension scores")
        return scores
        
    except Exception as e:
        logger.error(f"Error calculating tension scores: {e}")
        return pd.Series(index=features_df.index, dtype=float).fillna(50)

def calculate_accessibility_score(features_df: pd.DataFrame) -> pd.Series:
    """Calculate accessibility score (0-100)."""
    try:
        # Use pre-calculated accessibility score if available
        if "accessibility_score" in features_df.columns:
            scores = features_df["accessibility_score"].fillna(50)
            scores = np.clip(scores, 0, 100)
        else:
            # Fallback to distance-based calculation
            if "distance_to_cbd" in features_df.columns:
                distances = features_df["distance_to_cbd"].fillna(20)  # Default 20km
                # Convert distance to score (closer = higher score)
                scores = np.clip(100 - (distances / 30) * 100, 0, 100)
            else:
                scores = pd.Series(index=features_df.index, dtype=float).fillna(50)
        
        logger.info("Calculated accessibility scores")
        return scores
        
    except Exception as e:
        logger.error(f"Error calculating accessibility scores: {e}")
        return pd.Series(index=features_df.index, dtype=float).fillna(50)

def calculate_returns_score(features_df: pd.DataFrame, forecasts: dict) -> pd.Series:
    """Calculate rental returns potential score (0-100)."""
    try:
        scores = pd.Series(index=features_df.index, dtype=float).fillna(50)
        
        return_factors = []
        
        for _, area in features_df.iterrows():
            area_return = 50  # Default
            
            # Current rent levels (normalized)
            if "avg_rent" in area:
                avg_rent = area["avg_rent"]
                if not pd.isna(avg_rent):
                    # Scale rent to score (higher rent can mean higher returns)
                    # But also consider affordability
                    rent_score = min(100, (avg_rent / 2000) * 60)  # $2000 = 60 points
                    area_return = area_return * 0.6 + rent_score * 0.2
            
            # Rent growth forecast
            area_name = area.get("area_name", "").replace(" ", "_")
            for forecast_key, forecast in forecasts.items():
                if ("rent" in forecast_key.lower() and 
                    area_name.lower() in forecast_key.lower()):
                    if forecast.get("forecast"):
                        # Calculate average rent growth from forecast
                        current_rent = forecast.get("current_value", 1000)
                        future_rent = forecast["forecast"][11]["yhat"]  # 12 months out
                        
                        if current_rent > 0:
                            growth_rate = ((future_rent - current_rent) / current_rent) * 100
                            growth_score = min(100, max(0, growth_rate * 10))  # 10% growth = 100 points
                            area_return = area_return * 0.8 + growth_score * 0.2
                        break
            
            return_factors.append(min(100, max(0, area_return)))
        
        scores = pd.Series(return_factors, index=features_df.index)
        
        logger.info("Calculated returns scores")
        return scores
        
    except Exception as e:
        logger.error(f"Error calculating returns scores: {e}")
        return pd.Series(index=features_df.index, dtype=float).fillna(50)


def calculate_composite_scores(subscores: pd.DataFrame, weights: Optional[dict] = None) -> pd.DataFrame:
    """Calculate composite investment scores using weights."""
    try:
        if weights is None:
            weights = DEFAULT_WEIGHTS
        
        # Ensure all weights sum to 1
        total_weight = sum(weights.values())
        if total_weight != 1.0:
            weights = {k: v / total_weight for k, v in weights.items()}
        
        # Calculate weighted composite score
        composite_scores = (
            subscores["growth"] * weights["growth"] +
            subscores["supply"] * weights["supply"] +
            subscores["tension"] * weights["tension"] + 
            subscores["accessibility"] * weights["accessibility"] +
            subscores["returns"] * weights["returns"]
        )
        
        # Add composite score to dataframe
        result = subscores.copy()
        result["total"] = composite_scores
        
        # Calculate quantiles for ranking
        result["quantile"] = pd.qcut(
            result["total"], 
            q=5, 
            labels=[1, 2, 3, 4, 5],
            duplicates="drop"
        )
        
        # Handle any NaN quantiles
        result["quantile"] = result["quantile"].fillna(3).astype(int)
        
        logger.info("Calculated composite scores")
        return result
        
    except Exception as e:
        logger.error(f"Error calculating composite scores: {e}")
        return subscores

def detect_outliers(scores_df: pd.DataFrame) -> pd.Series:
    """Detect outlier areas using Isolation Forest."""
    try:
        # Select numeric columns for outlier detection
        numeric_cols = ["growth", "supply", "tension", "accessibility", "returns"]
        available_cols = [col for col in numeric_cols if col in scores_df.columns]
        
        if len(available_cols) < 2:
            return pd.Series(False, index=scores_df.index)
        
        # Fit Isolation Forest
        iso_forest = IsolationForest(contamination=0.1, random_state=42)
        outlier_labels = iso_forest.fit_predict(scores_df[available_cols])
        
        # Convert to boolean series (True = outlier)
        is_outlier = pd.Series(outlier_labels == -1, index=scores_df.index)
        
        logger.info(f"Detected {is_outlier.sum()} outlier areas")
        return is_outlier
        
    except Exception as e:
        logger.error(f"Error detecting outliers: {e}")
        return pd.Series(False, index=scores_df.index)

def main():
    """Main scoring pipeline."""
    logger.info("Starting scoring pipeline")
    setup_directories()
    
    # Load data
    features_df, forecasts = load_features_and_forecasts()
    
    if features_df.empty:
        logger.error("No features data available - cannot calculate scores")
        return
    
    # Calculate individual scores
    logger.info("Calculating individual scores...")
    
    subscores = pd.DataFrame(index=features_df.index)
    subscores["growth"] = calculate_growth_score(features_df)
    subscores["supply"] = calculate_supply_score(features_df, forecasts)
    subscores["tension"] = calculate_tension_score(features_df, forecasts)
    subscores["accessibility"] = calculate_accessibility_score(features_df)
    subscores["returns"] = calculate_returns_score(features_df, forecasts)
    
    # Calculate composite scores
    scores_df = calculate_composite_scores(subscores, DEFAULT_WEIGHTS)
    
    # Detect outliers
    scores_df["is_outlier"] = detect_outliers(scores_df)
    
    # Combine with area metadata
    result_df = features_df[["area_id", "area_name"]].copy()
    result_df = result_df.join(scores_df)
    result_df["last_updated"] = datetime.now().isoformat()
    result_df["weights_used"] = json.dumps(DEFAULT_WEIGHTS)
    
    # Save results
    result_df.to_parquet("data/curated/scores.parquet", index=False)
    
    # Create JSON version for API
    scores_json = []
    for _, row in result_df.iterrows():
        scores_json.append({
            "area_id": row["area_id"],
            "area_name": row["area_name"],
            "scores": {
                "growth": round(row["growth"], 1),
                "supply": round(row["supply"], 1),
                "tension": round(row["tension"], 1),
                "accessibility": round(row["accessibility"], 1),
                "returns": round(row["returns"], 1),
                "total": round(row["total"], 1)
            },
            "quantile": int(row["quantile"]),
            "is_outlier": bool(row["is_outlier"]),
            "last_updated": row["last_updated"]
        })
    
    with open("data/curated/scores.json", "w") as f:
        json.dump(scores_json, f, indent=2)
    
    # Create summary statistics
    summary = {
        "scoring_date": datetime.now().isoformat(),
        "areas_scored": len(result_df),
        "score_statistics": {
            "total_score": {
                "mean": float(scores_df["total"].mean()),
                "std": float(scores_df["total"].std()),
                "min": float(scores_df["total"].min()),
                "max": float(scores_df["total"].max())
            }
        },
        "quantile_distribution": scores_df["quantile"].value_counts().to_dict(),
        "outliers_detected": int(scores_df["is_outlier"].sum()),
        "weights_used": DEFAULT_WEIGHTS,
        "score_components": ["growth", "supply", "tension", "accessibility", "returns"]
    }
    
    with open("data/curated/scoring_summary.json", "w") as f:
        json.dump(summary, f, indent=2)
    
    logger.info(f"Scoring completed - scored {len(result_df)} areas")

if __name__ == "__main__":
    main()
