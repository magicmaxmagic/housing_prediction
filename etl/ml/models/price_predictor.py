"""
XGBoost Price Prediction Model for Montreal Real Estate
Predicts price per square meter based on property characteristics
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

class PricePredictor:
    """XGBoost model for predicting property prices per m²"""
    
    def __init__(self, model_version: str = "v1.0.0"):
        self.model = None
        self.scaler = StandardScaler()
        self.label_encoders = {}
        self.feature_names = []
        self.model_version = model_version
        self.training_date = None
        self.performance_metrics = {}
        
    def prepare_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Prepare and engineer features for the model"""
        
        # Create a copy to avoid modifying original data
        data = df.copy()
        
        # Basic features
        features = [
            'superficie_terrain',
            'superficie_batiment', 
            'nb_logements',
            'annee_construction',
            'etages'
        ]
        
        # Derived features
        data['age'] = 2025 - data['annee_construction']
        data['surface_ratio'] = data['superficie_batiment'] / (data['superficie_terrain'] + 1)
        data['units_per_floor'] = data['nb_logements'] / (data['etages'] + 1)
        data['building_efficiency'] = data['superficie_batiment'] / (data['nb_logements'] + 1)
        
        # Age categories
        data['is_new'] = (data['age'] <= 10).astype(int)
        data['is_modern'] = ((data['age'] > 10) & (data['age'] <= 30)).astype(int)
        data['is_mature'] = ((data['age'] > 30) & (data['age'] <= 50)).astype(int)
        data['is_old'] = (data['age'] > 50).astype(int)
        
        # Building size categories
        data['is_small_building'] = (data['nb_logements'] <= 3).astype(int)
        data['is_medium_building'] = ((data['nb_logements'] > 3) & (data['nb_logements'] <= 12)).astype(int)
        data['is_large_building'] = (data['nb_logements'] > 12).astype(int)
        
        # Categorical features
        categorical_features = ['libelle_utilisation']
        
        for col in categorical_features:
            if col in data.columns:
                # Group rare categories
                value_counts = data[col].value_counts()
                rare_categories = value_counts[value_counts < 50].index
                data[col] = data[col].replace(list(rare_categories), 'Autre')
                
                # Label encode
                if col not in self.label_encoders:
                    self.label_encoders[col] = LabelEncoder()
                    data[f'{col}_encoded'] = self.label_encoders[col].fit_transform(data[col].fillna('Unknown'))
                else:
                    # Handle unseen categories during prediction
                    known_categories = set(self.label_encoders[col].classes_)
                    data[col] = data[col].apply(lambda x: x if x in known_categories else 'Unknown')
                    data[f'{col}_encoded'] = self.label_encoders[col].transform(data[col].fillna('Unknown'))
        
        # Select final features
        final_features = features + [
            'age', 'surface_ratio', 'units_per_floor', 'building_efficiency',
            'is_new', 'is_modern', 'is_mature', 'is_old',
            'is_small_building', 'is_medium_building', 'is_large_building'
        ]
        
        # Add categorical features
        for col in categorical_features:
            if col in data.columns:
                final_features.append(f'{col}_encoded')
        
        # Remove any features not in data
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
        """Create target variable (price per m²) from market data"""
        
        # This would typically come from actual sales data
        # For now, we'll create a synthetic target based on property characteristics
        
        # Base price per m² (Montreal average ~$4000/m²)
        base_price = 4000
        
        # Adjust for age
        age_factor = np.where(df['annee_construction'] >= 2010, 1.3,
                     np.where(df['annee_construction'] >= 2000, 1.2,
                     np.where(df['annee_construction'] >= 1990, 1.1,
                     np.where(df['annee_construction'] >= 1980, 1.0,
                     np.where(df['annee_construction'] >= 1970, 0.9, 0.8)))))
        
        # Adjust for size (larger buildings often have lower price per m²)
        size_factor = np.where(df['nb_logements'] <= 3, 1.2,
                      np.where(df['nb_logements'] <= 12, 1.0, 0.85))
        
        # Adjust for location (simplified - would use actual neighborhood data)
        location_factor = np.random.normal(1.0, 0.15, len(df))  # Random variation
        location_factor = np.clip(location_factor, 0.6, 1.5)
        
        # Calculate synthetic price
        price_per_m2 = base_price * age_factor * size_factor * location_factor
        
        # Add some noise
        noise = np.random.normal(0, price_per_m2 * 0.1)
        price_per_m2 += noise
        
        return pd.Series(price_per_m2, index=df.index)
    
    def train(self, df: pd.DataFrame, test_size: float = 0.2) -> Dict:
        """Train the XGBoost model"""
        
        logger.info(f"Training price prediction model on {len(df)} samples")
        
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
        
        # Train XGBoost model
        self.model = xgb.XGBRegressor(
            n_estimators=300,
            max_depth=6,
            learning_rate=0.1,
            subsample=0.8,
            colsample_bytree=0.8,
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
            'cv_score': cross_val_score(self.model, X_train_scaled, y_train, cv=5).mean()
        }
        
        self.training_date = datetime.now().isoformat()
        
        logger.info(f"Model trained. Test R²: {self.performance_metrics['test_r2']:.3f}")
        logger.info(f"Test RMSE: ${self.performance_metrics['test_rmse']:.0f}/m²")
        
        return self.performance_metrics
    
    def predict(self, df: pd.DataFrame, return_confidence: bool = True) -> Dict:
        """Make predictions with confidence intervals"""
        
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
            # Calculate confidence intervals using quantile regression approach
            # This is a simplified approach - ideally would use proper uncertainty quantification
            rmse = self.performance_metrics.get('test_rmse', predictions.std())
            confidence_lower = predictions - 1.96 * rmse
            confidence_upper = predictions + 1.96 * rmse
            
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
        
        # Sort by importance
        sorted_importance = dict(sorted(
            importance_dict.items(),
            key=lambda x: x[1],
            reverse=True
        ))
        
        return sorted_importance
    
    def save_model(self, filepath: str) -> None:
        """Save the trained model and preprocessing objects"""
        
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
        logger.info(f"Model saved to {filepath}")
    
    def load_model(self, filepath: str) -> None:
        """Load a trained model and preprocessing objects"""
        
        model_data = joblib.load(filepath)
        
        self.model = model_data['model']
        self.scaler = model_data['scaler']
        self.label_encoders = model_data['label_encoders']
        self.feature_names = model_data['feature_names']
        self.model_version = model_data['model_version']
        self.training_date = model_data['training_date']
        self.performance_metrics = model_data['performance_metrics']
        
        logger.info(f"Model loaded from {filepath}")
        logger.info(f"Model version: {self.model_version}")
        logger.info(f"Training date: {self.training_date}")


def main():
    """Example usage of the PricePredictor"""
    
    # This would typically load real data
    sample_data = pd.DataFrame({
        'superficie_terrain': [300, 250, 400, 350, 200],
        'superficie_batiment': [200, 180, 300, 250, 150],
        'nb_logements': [4, 3, 6, 5, 2],
        'annee_construction': [2010, 1995, 2005, 2015, 1985],
        'etages': [2, 2, 3, 2, 1],
        'libelle_utilisation': ['Habitation', 'Habitation', 'Habitation', 'Habitation', 'Habitation']
    })
    
    # Train model
    predictor = PricePredictor()
    metrics = predictor.train(sample_data)
    
    print("Training Metrics:")
    for key, value in metrics.items():
        print(f"  {key}: {value:.3f}")
    
    # Make predictions
    predictions = predictor.predict(sample_data.head(2))
    print(f"\nPredictions: {predictions}")
    
    # Feature importance
    importance = predictor.get_feature_importance()
    print(f"\nTop 5 Most Important Features:")
    for feature, score in list(importance.items())[:5]:
        print(f"  {feature}: {score:.3f}")


if __name__ == "__main__":
    main()
