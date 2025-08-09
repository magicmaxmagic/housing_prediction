"""
Model Training Script for InvestMTL
Trains XGBoost models for price and rent predictions
"""

import pandas as pd
import sqlite3
import os
import sys
from pathlib import Path
import logging
from datetime import datetime
import json
from typing import Optional

# Add the project root to Python path
project_root = Path(__file__).parent.parent.parent
sys.path.append(str(project_root))

from ml.models.price_predictor import PricePredictor
from ml.models.rent_predictor import RentPredictor

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class ModelTrainer:
    """Handles training and saving of ML models"""
    def __init__(self, database_path: Optional[str] = None):
        if database_path is None:
            # Try to find database in different locations
            possible_paths = [
                project_root / "api" / "database.sqlite",
                project_root / "etl" / "database.sqlite",
                project_root / "database.sqlite"
            ]
            
            for path in possible_paths:
                if path.exists():
                    self.database_path = str(path)
                    break
            else:
                raise FileNotFoundError("Could not find database.sqlite")
        else:
            self.database_path = database_path
            
        self.models_dir = project_root / "etl" / "data" / "models"
        self.models_dir.mkdir(parents=True, exist_ok=True)
        
        logger.info(f"Using database: {self.database_path}")
        logger.info(f"Models will be saved to: {self.models_dir}")
    
    def load_data(self) -> pd.DataFrame:
        """Load data from SQLite database"""
        
        logger.info("Loading data from database...")
        
        conn = sqlite3.connect(self.database_path)
        
        # Load evaluation units data
        query = """
        SELECT 
            id,
            civique_debut,
            civique_fin,
            nom_rue,
            nb_logements,
            annee_construction,
            libelle_utilisation,
            superficie_terrain,
            superficie_batiment,
            etages
        FROM evaluation_units
        WHERE nb_logements > 0 
        AND annee_construction > 1900 
        AND superficie_terrain > 0
        AND superficie_batiment > 0
        AND etages > 0
        """
        
        df = pd.read_sql_query(query, conn)
        conn.close()
        
        logger.info(f"Loaded {len(df)} records from database")
        
        # Basic data cleaning
        df = df.dropna(subset=['nb_logements', 'annee_construction', 'superficie_terrain', 'superficie_batiment'])
        
        # Remove outliers
        df = df[
            (df['superficie_terrain'] >= 50) & (df['superficie_terrain'] <= 2000) &
            (df['superficie_batiment'] >= 30) & (df['superficie_batiment'] <= 1500) &
            (df['nb_logements'] >= 1) & (df['nb_logements'] <= 50) &
            (df['annee_construction'] >= 1950) & (df['annee_construction'] <= 2025) &
            (df['etages'] >= 1) & (df['etages'] <= 10)
        ]
        
        logger.info(f"After cleaning: {len(df)} records")
        
        return df
    
    def train_price_model(self, df: pd.DataFrame) -> dict:
        """Train the price prediction model"""
        
        logger.info("Training price prediction model...")
        
        model_version = f"v1.0.{datetime.now().strftime('%Y%m%d')}"
        predictor = PricePredictor(model_version=model_version)
        
        # Train model
        metrics = predictor.train(df, test_size=0.2)
        
        # Save model
        model_path = self.models_dir / f"price_predictor_{model_version}.joblib"
        predictor.save_model(str(model_path))
        
        # Save latest version link
        latest_path = self.models_dir / "price_predictor_latest.joblib"
        if latest_path.exists():
            latest_path.unlink()
        latest_path.symlink_to(model_path.name)
        
        # Get feature importance
        feature_importance = predictor.get_feature_importance()
        
        # Save training report
        report = {
            'model_type': 'price_predictor',
            'model_version': model_version,
            'training_date': datetime.now().isoformat(),
            'data_size': len(df),
            'metrics': metrics,
            'feature_importance': feature_importance,
            'model_path': str(model_path)
        }
        
        report_path = self.models_dir / f"price_model_report_{model_version}.json"
        with open(report_path, 'w') as f:
            json.dump(report, f, indent=2)
        
        logger.info(f"Price model training completed. R²: {metrics['test_r2']:.3f}")
        
        return report
    
    def train_rent_model(self, df: pd.DataFrame) -> dict:
        """Train the rent prediction model"""
        
        logger.info("Training rent prediction model...")
        
        model_version = f"v1.0.{datetime.now().strftime('%Y%m%d')}"
        predictor = RentPredictor(model_version=model_version)
        
        # Train model
        metrics = predictor.train(df, test_size=0.2)
        
        # Save model
        model_path = self.models_dir / f"rent_predictor_{model_version}.joblib"
        predictor.save_model(str(model_path))
        
        # Save latest version link
        latest_path = self.models_dir / "rent_predictor_latest.joblib"
        if latest_path.exists():
            latest_path.unlink()
        latest_path.symlink_to(model_path.name)
        
        # Get feature importance
        feature_importance = predictor.get_feature_importance()
        
        # Save training report
        report = {
            'model_type': 'rent_predictor',
            'model_version': model_version,
            'training_date': datetime.now().isoformat(),
            'data_size': len(df),
            'metrics': metrics,
            'feature_importance': feature_importance,
            'model_path': str(model_path)
        }
        
        report_path = self.models_dir / f"rent_model_report_{model_version}.json"
        with open(report_path, 'w') as f:
            json.dump(report, f, indent=2)
        
        logger.info(f"Rent model training completed. R²: {metrics['test_r2']:.3f}")
        
        return report
    
    def generate_predictions_for_zones(self, df: pd.DataFrame) -> pd.DataFrame:
        """Generate predictions for all investment zones"""
        
        logger.info("Generating predictions for investment zones...")
        
        # Load trained models
        price_model = PricePredictor()
        rent_model = RentPredictor()
        
        price_model_path = self.models_dir / "price_predictor_latest.joblib"
        rent_model_path = self.models_dir / "rent_predictor_latest.joblib"
        
        if not price_model_path.exists() or not rent_model_path.exists():
            raise FileNotFoundError("Trained models not found. Run training first.")
        
        price_model.load_model(str(price_model_path))
        rent_model.load_model(str(rent_model_path))
        
        # Group by street to create zone-level predictions
        zone_predictions = []
        
        for street, group in df.groupby('nom_rue'):
            if len(group) < 3:  # Skip streets with very few properties
                continue
            
            # Calculate representative values for the zone
            zone_data = pd.DataFrame({
                'superficie_terrain': [group['superficie_terrain'].median()],
                'superficie_batiment': [group['superficie_batiment'].median()],
                'nb_logements': [group['nb_logements'].median()],
                'annee_construction': [group['annee_construction'].median()],
                'etages': [group['etages'].median()],
                'libelle_utilisation': [group['libelle_utilisation'].mode().iloc[0]]
            })
            
            # Make predictions
            price_pred = price_model.predict(zone_data)
            rent_pred = rent_model.predict(zone_data)
            
            zone_predictions.append({
                'zone_id': street,
                'street_name': street,
                'property_count': len(group),
                'total_units': group['nb_logements'].sum(),
                'price_per_m2_prediction': price_pred['predictions'][0],
                'price_confidence_lower': price_pred['confidence_lower'][0],
                'price_confidence_upper': price_pred['confidence_upper'][0],
                'rent_prediction': rent_pred['predictions'][0],
                'rent_confidence_lower': rent_pred['confidence_lower'][0],
                'rent_confidence_upper': rent_pred['confidence_upper'][0],
                'model_version': f"{price_model.model_version}_{rent_model.model_version}",
                'quarter': f"{datetime.now().year}Q{((datetime.now().month-1)//3)+1}"
            })
        
        predictions_df = pd.DataFrame(zone_predictions)
        
        # Save predictions to database
        conn = sqlite3.connect(self.database_path)
        predictions_df.to_sql('predictions', conn, if_exists='replace', index=False)
        conn.close()
        
        logger.info(f"Generated predictions for {len(predictions_df)} zones")
        
        return predictions_df
    
    def train_all_models(self):
        """Train all models and generate predictions"""
        
        logger.info("Starting complete model training pipeline...")
        
        # Load data
        df = self.load_data()
        
        if len(df) < 100:
            logger.error("Insufficient data for training. Need at least 100 records.")
            return
        
        # Train models
        price_report = self.train_price_model(df)
        rent_report = self.train_rent_model(df)
        
        # Generate predictions for zones
        predictions_df = self.generate_predictions_for_zones(df)
        
        # Create summary report
        summary = {
            'training_date': datetime.now().isoformat(),
            'data_records': len(df),
            'zones_predicted': len(predictions_df),
            'price_model': {
                'version': price_report['model_version'],
                'test_r2': price_report['metrics']['test_r2'],
                'test_mae': price_report['metrics']['test_mae']
            },
            'rent_model': {
                'version': rent_report['model_version'],
                'test_r2': rent_report['metrics']['test_r2'],
                'test_mae': rent_report['metrics']['test_mae']
            }
        }
        
        summary_path = self.models_dir / "training_summary.json"
        with open(summary_path, 'w') as f:
            json.dump(summary, f, indent=2)
        
        logger.info("Model training pipeline completed successfully!")
        logger.info(f"Price Model R²: {summary['price_model']['test_r2']:.3f}")
        logger.info(f"Rent Model R²: {summary['rent_model']['test_r2']:.3f}")
        logger.info(f"Predictions generated for {summary['zones_predicted']} zones")
        
        return summary


def main():
    """Main training function"""
    
    try:
        trainer = ModelTrainer()
        summary = trainer.train_all_models()
        
        if summary is not None:
            print("\n" + "="*60)
            print("MODEL TRAINING COMPLETED SUCCESSFULLY")
            print("="*60)
            print(f"Training Date: {summary['training_date']}")
            print(f"Data Records: {summary['data_records']:,}")
            print(f"Zones Predicted: {summary['zones_predicted']:,}")
            print(f"\nPrice Model (R²): {summary['price_model']['test_r2']:.3f}")
            print(f"Rent Model (R²): {summary['rent_model']['test_r2']:.3f}")
            print("="*60)
        else:
            print("Model training did not complete successfully. No summary available.")
        
    except Exception as e:
        logger.error(f"Training failed: {str(e)}")
        sys.exit(1)


if __name__ == "__main__":
    main()
