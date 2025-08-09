#!/usr/bin/env python3
"""
Forecasting module for Montreal housing investment analysis.
Generates predictions for key metrics using time series models.
"""

import json
import pandas as pd
import numpy as np
from pathlib import Path
from datetime import datetime, timedelta
import logging
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_absolute_error, mean_squared_error
import warnings

# Suppress sklearn warnings
warnings.filterwarnings("ignore")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def setup_directories():
    """Create necessary directories."""
    for dir_name in ["data/curated"]:
        Path(dir_name).mkdir(parents=True, exist_ok=True)

def load_processed_data() -> dict:
    """Load processed data for forecasting."""
    data = {}
    
    try:
        if Path("data/raw/cmhc_rental.parquet").exists():
            data["rental"] = pd.read_parquet("data/raw/cmhc_rental.parquet")
            logger.info(f"Loaded rental data: {len(data['rental'])} records")
        
        if Path("data/raw/cmhc_housing_starts.parquet").exists():
            data["housing_starts"] = pd.read_parquet("data/raw/cmhc_housing_starts.parquet")
            logger.info(f"Loaded housing starts data: {len(data['housing_starts'])} records")
        
        if Path("data/processed/montreal_features.parquet").exists():
            data["features"] = pd.read_parquet("data/processed/montreal_features.parquet")
            logger.info(f"Loaded features data: {len(data['features'])} areas")
    
    except Exception as e:
        logger.error(f"Error loading processed data: {e}")
    
    return data

from typing import Optional, List

def prepare_time_series_data(df: pd.DataFrame, value_col: str, date_col: str, 
                           group_cols: Optional[List] = None) -> dict:
    """Prepare data for time series forecasting."""
    try:
        if group_cols is None:
            group_cols = []
        
        # Ensure date column is datetime
        df[date_col] = pd.to_datetime(df[date_col])
        
        # Sort by date
        df = df.sort_values(date_col)
        
        # Group data if grouping columns provided
        if group_cols:
            grouped_series = {}
            for group_vals, group_df in df.groupby(group_cols):
                if not isinstance(group_vals, tuple):
                    group_vals = (group_vals,)
                
                # Create time series
                ts = group_df.set_index(date_col)[value_col]
                ts = ts.resample('M').mean()  # Monthly aggregation
                ts = ts.dropna()
                
                if len(ts) > 3:  # Minimum data points for forecasting
                    grouped_series[group_vals] = ts
            
            logger.info(f"Prepared {len(grouped_series)} time series")
            return grouped_series
        else:
            # Single time series
            ts = df.set_index(date_col)[value_col]
            ts = ts.resample('M').mean()
            ts = ts.dropna()
            return {"overall": ts}
            
    except Exception as e:
        logger.error(f"Error preparing time series data: {e}")
        return {}

def simple_trend_forecast(ts: pd.Series, horizon: int = 12) -> dict:
    """
    Simple trend-based forecasting using linear regression.
    Alternative to Prophet for environments where it's not available.
    """
    try:
        if len(ts) < 3:
            return {"forecast": [], "confidence": 0.0}
        
        # Prepare data
        y = np.asarray(ts.values, dtype=np.float64)
        x = np.arange(len(y), dtype=np.float64)
        
        # Fit linear trend
        coeffs = np.polyfit(x, y, 1)
        trend = np.poly1d(coeffs)
        
        # Calculate residuals for confidence intervals
        fitted = trend(x)
        residuals = y - fitted
        rmse = np.sqrt(np.mean(residuals**2))
        
        # Generate forecasts
        forecast_x = np.arange(len(y), len(y) + horizon)
        forecast_y = trend(forecast_x)
        
        # Simple confidence intervals (±1.96 * RMSE)
        confidence_multiplier = 1.96
        forecast_lower = forecast_y - confidence_multiplier * rmse
        forecast_upper = forecast_y + confidence_multiplier * rmse
        
        # Create forecast periods
        last_date = ts.index[-1]
        # Ensure last_date is a pd.Timestamp, not a DatetimeIndex
        if isinstance(last_date, pd.DatetimeIndex):
            last_date = last_date[-1]
        if not isinstance(last_date, pd.Timestamp):
            last_date = pd.to_datetime(last_date)
        # Ensure last_date is a scalar Timestamp for pd.date_range
        if isinstance(last_date, pd.DatetimeIndex):
            last_date = last_date[-1]
        forecast_dates = pd.date_range(
            start=last_date + pd.DateOffset(months=1),
            periods=horizon,
            freq='MS'  # Month start
        )
        
        # Format results
        forecast_results = []
        for i, date in enumerate(forecast_dates):
            forecast_results.append({
                "month": date.strftime("%Y-%m"),
                "yhat": round(forecast_y[i], 2),
                "yhat_lower": round(forecast_lower[i], 2),
                "yhat_upper": round(forecast_upper[i], 2)
            })
        
        # Calculate R-squared as confidence measure
        ss_res = np.sum(residuals ** 2)
        ss_tot = np.sum((y - np.mean(y)) ** 2)
        r_squared = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0
        confidence = max(0.1, min(0.95, r_squared))
        
        return {
            "forecast": forecast_results,
            "confidence": round(confidence, 3),
            "model_type": "linear_trend",
            "rmse": round(rmse, 2)
        }
        
    except Exception as e:
        logger.error(f"Error in trend forecasting: {e}")
        return {"forecast": [], "confidence": 0.0}

def seasonal_naive_forecast(ts: pd.Series, horizon: int = 12, season_length: int = 12) -> dict:
    """
    Seasonal naive forecasting - repeats seasonal pattern from previous year.
    """
    try:
        if len(ts) < season_length:
            return simple_trend_forecast(ts, horizon)
        
        # Get last season pattern
        last_season = ts.iloc[-season_length:].values
        
        # Calculate trend
        if len(ts) >= season_length * 2:
            recent_avg = np.mean(ts.iloc[-season_length:])
            previous_avg = np.mean(ts.iloc[-season_length*2:-season_length])
            trend_factor = recent_avg / previous_avg if previous_avg > 0 else 1.0
        else:
            trend_factor = 1.0
        
        # Generate forecasts by repeating seasonal pattern with trend
        forecast_values = []
        for i in range(horizon):
            seasonal_value = last_season[i % season_length]
            trend_adjusted = seasonal_value * (trend_factor ** (i // season_length + 1))
            forecast_values.append(trend_adjusted)
        
        # Simple confidence intervals based on historical volatility
        volatility = np.std(np.asarray(ts.values, dtype=np.float64))
        confidence_multiplier = 1.96
        
        # Create forecast periods
        last_date = ts.index[-1]
        # Ensure last_date is a scalar Timestamp, not a tuple or DatetimeIndex
        if isinstance(last_date, tuple):
            last_date = last_date[-1]
        if isinstance(last_date, pd.DatetimeIndex):
            last_date = last_date[-1]
        if not isinstance(last_date, pd.Timestamp):
            last_date = pd.to_datetime(last_date)
        forecast_dates = pd.date_range(
            start=last_date + pd.DateOffset(months=1),
            periods=horizon,
            freq='MS'
        )
        
        # Format results
        forecast_results = []
        for i, date in enumerate(forecast_dates):
            yhat = forecast_values[i]
            forecast_results.append({
                "month": date.strftime("%Y-%m"),
                "yhat": round(yhat, 2),
                "yhat_lower": round(yhat - confidence_multiplier * volatility, 2),
                "yhat_upper": round(yhat + confidence_multiplier * volatility, 2)
            })
        
        # Confidence based on pattern stability
        if len(ts) >= season_length * 2:
            recent_pattern = np.asarray(ts.iloc[-season_length:].values, dtype=np.float64)
            prev_pattern = np.asarray(ts.iloc[-season_length*2:-season_length].values, dtype=np.float64)
            pattern_correlation = np.corrcoef(recent_pattern, prev_pattern)[0, 1]
            confidence = max(0.1, min(0.9, abs(pattern_correlation)))
        else:
            confidence = 0.5
        
        return {
            "forecast": forecast_results,
            "confidence": round(confidence, 3),
            "model_type": "seasonal_naive",
            "trend_factor": round(trend_factor, 3)
        }
        
    except Exception as e:
        logger.error(f"Error in seasonal naive forecasting: {e}")
        return simple_trend_forecast(ts, horizon)

def forecast_rental_prices(rental_data: pd.DataFrame) -> dict:
    """Generate rental price forecasts by district and bedroom type."""
    try:
        logger.info("Generating rental price forecasts...")
        
        # Convert year to datetime for time series analysis
        rental_data["date"] = pd.to_datetime(rental_data["year"].astype(str) + "-01-01")
        
        # Prepare time series data
        ts_data = prepare_time_series_data(
            rental_data, 
            value_col="average_rent",
            date_col="date",
            group_cols=["district", "bedroom_type"]
        )
        
        forecasts = {}
        
        for group_key, ts in ts_data.items():
            district, bedroom_type = group_key
            
            # Choose forecasting method based on data length and seasonality
            if len(ts) >= 12:
                forecast_result = seasonal_naive_forecast(ts, horizon=12)
            else:
                forecast_result = simple_trend_forecast(ts, horizon=12)
            
            # Store forecast
            group_id = f"{district}_{bedroom_type}".replace(" ", "_").replace("+", "plus")
            forecasts[group_id] = {
                "district": district,
                "bedroom_type": bedroom_type,
                "metric": "average_rent",
                "current_value": float(ts.iloc[-1]),
                **forecast_result
            }
        
        logger.info(f"Generated rental forecasts for {len(forecasts)} district-bedroom combinations")
        return forecasts
        
    except Exception as e:
        logger.error(f"Error forecasting rental prices: {e}")
        return {}

def forecast_vacancy_rates(rental_data: pd.DataFrame) -> dict:
    """Generate vacancy rate forecasts by district."""
    try:
        logger.info("Generating vacancy rate forecasts...")
        
        rental_data["date"] = pd.to_datetime(rental_data["year"].astype(str) + "-01-01")
        
        # Aggregate by district (average across bedroom types)
        district_vacancy = rental_data.groupby(["district", "date"]).agg({
            "vacancy_rate": "mean"
        }).reset_index()
        
        ts_data = prepare_time_series_data(
            district_vacancy,
            value_col="vacancy_rate", 
            date_col="date",
            group_cols=["district"]
        )
        
        forecasts = {}
        
        for group_key, ts in ts_data.items():
            district = group_key[0] if isinstance(group_key, tuple) else group_key
            
            # Vacancy rates tend to be less seasonal, use trend forecast
            forecast_result = simple_trend_forecast(ts, horizon=12)
            
            # Ensure vacancy rates stay within reasonable bounds (0-15%)
            for point in forecast_result.get("forecast", []):
                point["yhat"] = max(0, min(15, point["yhat"]))
                point["yhat_lower"] = max(0, min(15, point["yhat_lower"]))
                point["yhat_upper"] = max(0, min(15, point["yhat_upper"]))
            
            forecasts[district.replace(" ", "_")] = {
                "district": district,
                "metric": "vacancy_rate",
                "current_value": float(ts.iloc[-1]),
                **forecast_result
            }
        
        logger.info(f"Generated vacancy forecasts for {len(forecasts)} districts")
        return forecasts
        
    except Exception as e:
        logger.error(f"Error forecasting vacancy rates: {e}")
        return {}

def forecast_housing_starts(starts_data: pd.DataFrame) -> dict:
    """Generate housing starts forecasts by region."""
    try:
        logger.info("Generating housing starts forecasts...")
        
        # Monthly aggregation
        monthly_starts = starts_data.groupby(["region", "date"]).agg({
            "housing_starts": "sum"
        }).reset_index()
        
        ts_data = prepare_time_series_data(
            monthly_starts,
            value_col="housing_starts",
            date_col="date", 
            group_cols=["region"]
        )
        
        forecasts = {}
        
        for group_key, ts in ts_data.items():
            region = group_key[0] if isinstance(group_key, tuple) else group_key
            
            # Housing starts are highly seasonal, use seasonal forecast
            forecast_result = seasonal_naive_forecast(ts, horizon=12, season_length=12)
            
            # Ensure non-negative values
            for point in forecast_result.get("forecast", []):
                point["yhat"] = max(0, point["yhat"])
                point["yhat_lower"] = max(0, point["yhat_lower"])
            
            forecasts[region.replace(" ", "_")] = {
                "region": region,
                "metric": "housing_starts",
                "current_value": float(ts.iloc[-1]),
                **forecast_result
            }
        
        logger.info(f"Generated housing starts forecasts for {len(forecasts)} regions")
        return forecasts
        
    except Exception as e:
        logger.error(f"Error forecasting housing starts: {e}")
        return {}

def main():
    """Main forecasting pipeline."""
    logger.info("Starting forecasting pipeline")
    setup_directories()
    
    # Load processed data
    data = load_processed_data()
    
    all_forecasts = {}
    
    # Generate rental price forecasts
    if "rental" in data:
        rental_forecasts = forecast_rental_prices(data["rental"])
        all_forecasts.update(rental_forecasts)
    
    # Generate vacancy rate forecasts
    if "rental" in data:
        vacancy_forecasts = forecast_vacancy_rates(data["rental"])
        for key, forecast in vacancy_forecasts.items():
            all_forecasts[f"vacancy_{key}"] = forecast
    
    # Generate housing starts forecasts  
    if "housing_starts" in data:
        starts_forecasts = forecast_housing_starts(data["housing_starts"])
        for key, forecast in starts_forecasts.items():
            all_forecasts[f"starts_{key}"] = forecast
    
    # Save all forecasts
    with open("data/curated/forecasts.json", "w") as f:
        json.dump(all_forecasts, f, indent=2)
    
    # Create summary
    forecast_summary = {
        "generation_date": datetime.now().isoformat(),
        "forecast_horizon": 12,
        "total_forecasts": len(all_forecasts),
        "metrics_forecasted": ["average_rent", "vacancy_rate", "housing_starts"],
        "model_types": ["linear_trend", "seasonal_naive"],
        "confidence_range": [0.1, 0.95]
    }
    
    with open("data/curated/forecast_summary.json", "w") as f:
        json.dump(forecast_summary, f, indent=2)
    
    logger.info(f"Forecasting completed - generated {len(all_forecasts)} forecasts")

if __name__ == "__main__":
    main()
