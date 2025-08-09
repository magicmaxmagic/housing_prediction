"""
XGBoost Rent Prediction Model for Montreal Real Estate
Predicts monthly rent based on property characteristics
"""

import pandas as pd
import numpy as np
import xgboost as xgb
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import joblib
import json
from typing import Dict, List, Tuple, Optional
from datetime import datetime
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class RentPredictor:
    """XGBoost model for predicting monthly rent"""
    
    def __init__(self, model_version: str = "v1.0.0"):
        self.model = None
        self.scaler = StandardScaler()
        self.label_encoders = {}
        self.feature_names = []
        self.model_version = model_version
        self.training_date = None
        self.performance_metrics = {}
        
    def prepare_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Prepare and engineer features for rent prediction"""
        
        data = df.copy()
        
        # Basic features
        features = [
            'superficie_terrain',
            'superficie_batiment', 
            'nb_logements',
            'annee_construction',
            'etages'
        ]
        
        # Derived features for rent prediction
        data['age'] = 2025 - data['annee_construction']
        data['avg_unit_size'] = data['superficie_batiment'] / (data['nb_logements'] + 1)
        data['units_per_floor'] = data['nb_logements'] / (data['etages'] + 1)
        data['lot_coverage'] = data['superficie_batiment'] / (data['superficie_terrain'] + 1)
        
        # Age categories (newer = higher rent)
        data['is_very_new'] = (data['age'] <= 5).astype(int)
        data['is_new'] = ((data['age'] > 5) & (data['age'] <= 15)).astype(int)
        data['is_modern'] = ((data['age'] > 15) & (data['age'] <= 30)).astype(int)
        data['is_older'] = (data['age'] > 30).astype(int)
        
        # Unit size categories (larger units = higher rent)
        data['is_small_units'] = (data['avg_unit_size'] <= 60).astype(int)
        data['is_medium_units'] = ((data['avg_unit_size'] > 60) & (data['avg_unit_size'] <= 100)).astype(int)
        data['is_large_units'] = (data['avg_unit_size'] > 100).astype(int)
        
        # Building type
        data['is_duplex_triplex'] = (data['nb_logements'] <= 3).astype(int)
        data['is_small_apartment'] = ((data['nb_logements'] > 3) & (data['nb_logements'] <= 12)).astype(int)
        data['is_large_apartment'] = (data['nb_logements'] > 12).astype(int)
        
        # Handle categorical features
        categorical_features = ['libelle_utilisation']
        
        for col in categorical_features:
            if col in data.columns:
                # Group rare categories
                value_counts = data[col].value_counts()
                rare_categories = value_counts[value_counts < 50].index.tolist()
                for rare_cat in rare_categories:
                    data.loc[data[col] == rare_cat, col] = 'Autre'
                
                # Label encode
                if col not in self.label_encoders:
                    self.label_encoders[col] = LabelEncoder()
                    data[f'{col}_encoded'] = self.label_encoders[col].fit_transform(data[col].fillna('Unknown'))
                else:
                    # Handle unseen categories
                    known_categories = set(self.label_encoders[col].classes_)
                    data[col] = data[col].apply(lambda x: x if x in known_categories else 'Unknown')
                    data[f'{col}_encoded'] = self.label_encoders[col].transform(data[col].fillna('Unknown'))
        
        # Select final features
        final_features = features + [
            'age', 'avg_unit_size', 'units_per_floor', 'lot_coverage',
            'is_very_new', 'is_new', 'is_modern', 'is_older',
            'is_small_units', 'is_medium_units', 'is_large_units',
            'is_duplex_triplex', 'is_small_apartment', 'is_large_apartment'
        ]
        
        # Add categorical features
        for col in categorical_features:
            if col in data.columns:
                final_features.append(f'{col}_encoded')
        
        # Keep only available features
        final_features = [f for f in final_features if f in data.columns]
        
        # Fill missing values
        for col in final_features:
            if data[col].dtype in ['float64', 'int64']:
                data[col] = data[col].fillna(data[col].median())
            else:
                data[col] = data[col].fillna(0)
        
        self.feature_names = final_features
        return data[final_features]
    
    def create_target_variable(self, df: pd.DataFrame) -> pd.Series:
        """Create synthetic monthly rent target variable"""
        
        # Base rent per unit (Montreal average)
        base_monthly_rent = {
            'studio': 1200,
            '1_bedroom': 1500,
            '2_bedroom': 1800,
            '3_bedroom': 2200,
            'large': 2800
        }
        
        # Estimate unit type based on average unit size
        avg_unit_size = df['superficie_batiment'] / (df['nb_logements'] + 1)
        
        # Classify units
        unit_type = np.where(avg_unit_size <= 40, 'studio',
                    np.where(avg_unit_size <= 60, '1_bedroom', 
                    np.where(avg_unit_size <= 85, '2_bedroom',
                    np.where(avg_unit_size <= 120, '3_bedroom', 'large'))))
        
        # Base rent
        base_rent = np.array([base_monthly_rent[ut] for ut in unit_type])
        
        # Age adjustment (newer = higher rent)
        age_factor = np.where(df['annee_construction'] >= 2015, 1.25,
                     np.where(df['annee_construction'] >= 2010, 1.15,
                     np.where(df['annee_construction'] >= 2000, 1.05,
                     np.where(df['annee_construction'] >= 1990, 1.0,
                     np.where(df['annee_construction'] >= 1980, 0.95, 0.85)))))
        
        # Building type adjustment
        building_factor = np.where(df['nb_logements'] <= 3, 1.1,  # Duplex/triplex premium
                          np.where(df['nb_logements'] <= 12, 1.0,  # Small apartment
                          0.95))  # Large apartment discount
        
        # Location factor (simplified)
        location_factor = np.random.normal(1.0, 0.2, len(df))
        location_factor = np.clip(location_factor, 0.7, 1.4)
        
        # Calculate rent per unit
        rent_per_unit = base_rent * age_factor * building_factor * location_factor
        
        # Add noise
        noise = np.random.normal(0, rent_per_unit * 0.08)
        rent_per_unit += noise
        
        # Ensure positive values
        rent_per_unit = np.maximum(rent_per_unit, 800)
        
        return pd.Series(rent_per_unit, index=df.index)
    
    def train(self, df: pd.DataFrame, test_size: float = 0.2) -> Dict:
        """Train the rent prediction model"""
        
        logger.info(f"Training rent prediction model on {len(df)} samples")
        
        # Prepare features and target
        X = self.prepare_features(df)
        y = self.create_target_variable(df)
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=42
        )
        
        # Scale features
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)
        
        # Train XGBoost model with parameters optimized for rent prediction
        self.model = xgb.XGBRegressor(
            n_estimators=250,
            max_depth=5,
            learning_rate=0.1,
            subsample=0.85,
            colsample_bytree=0.8,
            reg_alpha=0.1,
            reg_lambda=0.1,
            random_state=42,
            n_jobs=-1
        )
        
        self.model.fit(X_train_scaled, y_train)
        
        # Evaluate model
        train_pred = self.model.predict(X_train_scaled)
        test_pred = self.model.predict(X_test_scaled)
        
        # Calculate metrics
        self.performance_metrics = {
            'train_mae': mean_absolute_error(y_train, train_pred),
            'test_mae': mean_absolute_error(y_test, test_pred),
            'train_rmse': np.sqrt(mean_squared_error(y_train, train_pred)),
            'test_rmse': np.sqrt(mean_squared_error(y_test, test_pred)),
            'train_r2': r2_score(y_train, train_pred),
            'test_r2': r2_score(y_test, test_pred),
            'cv_score': cross_val_score(self.model, X_train_scaled, y_train, cv=5).mean(),
            'mean_rent': y.mean(),
            'median_rent': y.median()
        }
        
        self.training_date = datetime.now().isoformat()
        
        logger.info(f"Model trained. Test R²: {self.performance_metrics['test_r2']:.3f}")
        logger.info(f"Test MAE: ${self.performance_metrics['test_mae']:.0f}/month")
        
        return self.performance_metrics
    
    def predict(self, df: pd.DataFrame, return_confidence: bool = True) -> Dict:
        """Make rent predictions with confidence intervals"""
        
        if self.model is None:
            raise ValueError("Model not trained. Call train() first.")
        
        # Prepare features
        X = self.prepare_features(df)
        X_scaled = self.scaler.transform(X)
        
        # Make predictions
        predictions = self.model.predict(X_scaled)
        
        results = {
            'predictions': predictions.tolist(),
            'model_version': self.model_version,
            'prediction_date': datetime.now().isoformat()
        }
        
        if return_confidence:
            # Calculate confidence intervals
            mae = self.performance_metrics.get('test_mae', predictions.std())
            confidence_lower = predictions - 1.96 * mae
            confidence_upper = predictions + 1.96 * mae
            
            # Ensure positive bounds
            confidence_lower = np.maximum(confidence_lower, 500)
            
            results['confidence_lower'] = confidence_lower.tolist()
            results['confidence_upper'] = confidence_upper.tolist()
        
        return results
    
    def get_feature_importance(self) -> Dict:
        """Get feature importance from the trained model"""
        
        if self.model is None:
            raise ValueError("Model not trained.")
        
        importance_dict = dict(zip(
            self.feature_names,
            self.model.feature_importances_
        ))
        
        return dict(sorted(importance_dict.items(), key=lambda x: x[1], reverse=True))
    
    def save_model(self, filepath: str) -> None:
        """Save the trained model"""
        
        model_data = {
            'model': self.model,
            'scaler': self.scaler,
            'label_encoders': self.label_encoders,
            'feature_names': self.feature_names,
            'model_version': self.model_version,
            'training_date': self.training_date,
            'performance_metrics': self.performance_metrics
        }
        
        joblib.dump(model_data, filepath)
        logger.info(f"Rent model saved to {filepath}")
    
    def load_model(self, filepath: str) -> None:
        """Load a trained model"""
        
        model_data = joblib.load(filepath)
        
        self.model = model_data['model']
        self.scaler = model_data['scaler']
        self.label_encoders = model_data['label_encoders']
        self.feature_names = model_data['feature_names']
        self.model_version = model_data['model_version']
        self.training_date = model_data['training_date']
        self.performance_metrics = model_data['performance_metrics']
        
        logger.info(f"Rent model loaded from {filepath}")


def main():
    """Example usage"""
    
    sample_data = pd.DataFrame({
        'superficie_terrain': [300, 250, 400, 350, 200],
        'superficie_batiment': [200, 180, 300, 250, 150],
        'nb_logements': [4, 3, 6, 5, 2],
        'annee_construction': [2010, 1995, 2005, 2015, 1985],
        'etages': [2, 2, 3, 2, 1],
        'libelle_utilisation': ['Habitation', 'Habitation', 'Habitation', 'Habitation', 'Habitation']
    })
    
    predictor = RentPredictor()
    metrics = predictor.train(sample_data)
    
    print("Training Metrics:")
    for key, value in metrics.items():
        print(f"  {key}: {value:.3f}")
    
    predictions = predictor.predict(sample_data.head(2))
    print(f"\nRent Predictions: {predictions}")


if __name__ == "__main__":
    main()
