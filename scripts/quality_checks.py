#!/usr/bin/env python3
"""
Monthly data quality and health checks for InvestMTL platform
Validates data completeness, prediction accuracy, and system health
"""

import argparse
import json
import sqlite3
import requests
import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, List, Any
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class QualityChecker:
    def __init__(self, db_path: str = None, api_base: str = None):
        self.db_path = db_path or './data/investmtl.db'
        self.api_base = api_base or 'https://investmtl.your-domain.workers.dev/api'
        self.results = {
            'timestamp': datetime.now().isoformat(),
            'checks_passed': 0,
            'checks_failed': 0,
            'warnings': [],
            'errors': [],
            'details': {}
        }

    def check_data_completeness(self) -> bool:
        """Check if all expected data is present and up-to-date"""
        logger.info("Checking data completeness...")
        
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Check zones table
            cursor.execute("SELECT COUNT(*) FROM zones")
            zone_count = cursor.fetchone()[0]
            
            if zone_count < 50:  # Expect at least 50 zones for Montreal
                self.results['errors'].append(f"Insufficient zones data: {zone_count}")
                return False
            
            # Check recent data updates
            cursor.execute("""
                SELECT MAX(updated_at) as latest_update 
                FROM zones 
                WHERE updated_at IS NOT NULL
            """)
            latest_update = cursor.fetchone()[0]
            
            if latest_update:
                update_date = datetime.fromisoformat(latest_update.replace('Z', '+00:00'))
                days_since_update = (datetime.now() - update_date.replace(tzinfo=None)).days
                
                if days_since_update > 35:  # More than 35 days old
                    self.results['warnings'].append(f"Data is {days_since_update} days old")
            
            # Check properties table
            cursor.execute("SELECT COUNT(*) FROM properties")
            property_count = cursor.fetchone()[0]
            
            if property_count < 1000:  # Expect at least 1000 properties
                self.results['errors'].append(f"Insufficient properties data: {property_count}")
                return False
            
            # Check predictions table
            cursor.execute("SELECT COUNT(*) FROM predictions WHERE prediction_date >= date('now', '-7 days')")
            recent_predictions = cursor.fetchone()[0]
            
            if recent_predictions < zone_count * 0.8:  # At least 80% of zones should have recent predictions
                self.results['warnings'].append(f"Only {recent_predictions}/{zone_count} zones have recent predictions")
            
            self.results['details']['data_completeness'] = {
                'zones': zone_count,
                'properties': property_count,
                'recent_predictions': recent_predictions,
                'latest_update': latest_update
            }
            
            conn.close()
            logger.info("Data completeness check passed")
            return True
            
        except Exception as e:
            self.results['errors'].append(f"Data completeness check failed: {str(e)}")
            logger.error(f"Data completeness check failed: {e}")
            return False

    def validate_predictions(self) -> bool:
        """Validate ML prediction accuracy and consistency"""
        logger.info("Validating ML predictions...")
        
        try:
            conn = sqlite3.connect(self.db_path)
            
            # Check prediction ranges are reasonable
            df = pd.read_sql_query("""
                SELECT 
                    zone_id,
                    predicted_price,
                    predicted_rent,
                    price_confidence_min,
                    price_confidence_max,
                    rent_confidence_min,
                    rent_confidence_max
                FROM predictions 
                WHERE prediction_date >= date('now', '-30 days')
            """, conn)
            
            if df.empty:
                self.results['errors'].append("No recent predictions found")
                return False
            
            # Check for unrealistic predictions
            unrealistic_prices = df[
                (df['predicted_price'] < 100) | 
                (df['predicted_price'] > 2000) |
                (df['predicted_rent'] < 1) |
                (df['predicted_rent'] > 100)
            ]
            
            if not unrealistic_prices.empty:
                self.results['warnings'].append(f"{len(unrealistic_prices)} zones have unrealistic predictions")
            
            # Check confidence intervals
            invalid_confidence = df[
                (df['price_confidence_min'] >= df['price_confidence_max']) |
                (df['rent_confidence_min'] >= df['rent_confidence_max'])
            ]
            
            if not invalid_confidence.empty:
                self.results['errors'].append(f"{len(invalid_confidence)} zones have invalid confidence intervals")
                return False
            
            # Calculate prediction spread (confidence interval width)
            df['price_spread'] = df['price_confidence_max'] - df['price_confidence_min']
            df['rent_spread'] = df['rent_confidence_max'] - df['rent_confidence_min']
            
            avg_price_spread = df['price_spread'].mean()
            avg_rent_spread = df['rent_spread'].mean()
            
            # If spreads are too wide, model uncertainty is high
            if avg_price_spread > df['predicted_price'].mean() * 0.5:
                self.results['warnings'].append("High price prediction uncertainty detected")
            
            if avg_rent_spread > df['predicted_rent'].mean() * 0.5:
                self.results['warnings'].append("High rent prediction uncertainty detected")
            
            self.results['details']['prediction_validation'] = {
                'total_predictions': len(df),
                'unrealistic_count': len(unrealistic_prices),
                'invalid_confidence_count': len(invalid_confidence),
                'avg_price_spread': round(avg_price_spread, 2),
                'avg_rent_spread': round(avg_rent_spread, 4)
            }
            
            conn.close()
            logger.info("Prediction validation passed")
            return True
            
        except Exception as e:
            self.results['errors'].append(f"Prediction validation failed: {str(e)}")
            logger.error(f"Prediction validation failed: {e}")
            return False

    def check_api_health(self, production: bool = False) -> bool:
        """Check API endpoints are responding correctly"""
        logger.info(f"Checking API health ({'production' if production else 'staging'})...")
        
        endpoints = [
            '/zones',
            '/zones/MTL001',
            '/predictions',
            '/predictions/summary'
        ]
        
        failed_endpoints = []
        
        for endpoint in endpoints:
            try:
                url = f"{self.api_base}{endpoint}"
                response = requests.get(url, timeout=10)
                
                if response.status_code != 200:
                    failed_endpoints.append(f"{endpoint}: HTTP {response.status_code}")
                else:
                    # Basic JSON validation
                    data = response.json()
                    if not isinstance(data, dict):
                        failed_endpoints.append(f"{endpoint}: Invalid JSON response")
            
            except Exception as e:
                failed_endpoints.append(f"{endpoint}: {str(e)}")
        
        if failed_endpoints:
            self.results['errors'].extend(failed_endpoints)
            return False
        
        self.results['details']['api_health'] = {
            'endpoints_checked': len(endpoints),
            'all_healthy': True
        }
        
        logger.info("API health check passed")
        return True

    def check_database_integrity(self) -> bool:
        """Check database schema and referential integrity"""
        logger.info("Checking database integrity...")
        
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Check for orphaned records
            cursor.execute("""
                SELECT COUNT(*) FROM properties p 
                LEFT JOIN zones z ON p.zone_id = z.zone_id 
                WHERE z.zone_id IS NULL
            """)
            orphaned_properties = cursor.fetchone()[0]
            
            if orphaned_properties > 0:
                self.results['warnings'].append(f"{orphaned_properties} properties have invalid zone references")
            
            cursor.execute("""
                SELECT COUNT(*) FROM predictions p 
                LEFT JOIN zones z ON p.zone_id = z.zone_id 
                WHERE z.zone_id IS NULL
            """)
            orphaned_predictions = cursor.fetchone()[0]
            
            if orphaned_predictions > 0:
                self.results['warnings'].append(f"{orphaned_predictions} predictions have invalid zone references")
            
            # Check for duplicate records
            cursor.execute("""
                SELECT zone_id, COUNT(*) as count 
                FROM zones 
                GROUP BY zone_id 
                HAVING COUNT(*) > 1
            """)
            duplicate_zones = cursor.fetchall()
            
            if duplicate_zones:
                self.results['errors'].append(f"Duplicate zones found: {[zone[0] for zone in duplicate_zones]}")
                return False
            
            # Check for NULL values in critical fields
            cursor.execute("""
                SELECT COUNT(*) FROM zones 
                WHERE zone_id IS NULL OR zone_name IS NULL OR investment_score IS NULL
            """)
            null_critical_fields = cursor.fetchone()[0]
            
            if null_critical_fields > 0:
                self.results['errors'].append(f"{null_critical_fields} zones have NULL critical fields")
                return False
            
            self.results['details']['database_integrity'] = {
                'orphaned_properties': orphaned_properties,
                'orphaned_predictions': orphaned_predictions,
                'duplicate_zones': len(duplicate_zones),
                'null_critical_fields': null_critical_fields
            }
            
            conn.close()
            logger.info("Database integrity check passed")
            return True
            
        except Exception as e:
            self.results['errors'].append(f"Database integrity check failed: {str(e)}")
            logger.error(f"Database integrity check failed: {e}")
            return False

    def run_all_checks(self, include_api: bool = True, production: bool = False) -> Dict[str, Any]:
        """Run all quality checks and return comprehensive results"""
        logger.info("Starting comprehensive quality checks...")
        
        checks = [
            ('data_completeness', self.check_data_completeness),
            ('prediction_validation', self.validate_predictions),
            ('database_integrity', self.check_database_integrity)
        ]
        
        if include_api:
            checks.append(('api_health', lambda: self.check_api_health(production)))
        
        for check_name, check_func in checks:
            try:
                if check_func():
                    self.results['checks_passed'] += 1
                    logger.info(f"✅ {check_name} passed")
                else:
                    self.results['checks_failed'] += 1
                    logger.error(f"❌ {check_name} failed")
            except Exception as e:
                self.results['checks_failed'] += 1
                self.results['errors'].append(f"{check_name} exception: {str(e)}")
                logger.error(f"❌ {check_name} exception: {e}")
        
        # Overall health status
        total_checks = self.results['checks_passed'] + self.results['checks_failed']
        success_rate = (self.results['checks_passed'] / total_checks) * 100 if total_checks > 0 else 0
        
        self.results['overall_health'] = {
            'success_rate': round(success_rate, 1),
            'is_healthy': success_rate >= 80,  # 80% success rate threshold
            'total_checks': total_checks
        }
        
        logger.info(f"Quality checks completed: {success_rate:.1f}% success rate")
        return self.results

    def save_results(self, output_file: str = None):
        """Save check results to JSON file"""
        if not output_file:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            output_file = f'quality_check_results_{timestamp}.json'
        
        with open(output_file, 'w') as f:
            json.dump(self.results, f, indent=2, default=str)
        
        logger.info(f"Results saved to {output_file}")

def main():
    parser = argparse.ArgumentParser(description='Run data quality checks for InvestMTL')
    parser.add_argument('--check-completeness', action='store_true', help='Check data completeness only')
    parser.add_argument('--validate-predictions', action='store_true', help='Validate predictions only')
    parser.add_argument('--check-api', action='store_true', help='Check API health only')
    parser.add_argument('--check-db-integrity', action='store_true', help='Check database integrity only')
    parser.add_argument('--production', action='store_true', help='Run against production environment')
    parser.add_argument('--db-path', help='Path to SQLite database file')
    parser.add_argument('--api-base', help='Base URL for API endpoints')
    parser.add_argument('--output', help='Output file for results')
    parser.add_argument('--all', action='store_true', help='Run all checks (default)')
    
    args = parser.parse_args()
    
    # Initialize checker
    checker = QualityChecker(db_path=args.db_path, api_base=args.api_base)
    
    # Run specific checks or all checks
    if args.check_completeness:
        result = checker.check_data_completeness()
    elif args.validate_predictions:
        result = checker.validate_predictions()
    elif args.check_api:
        result = checker.check_api_health(production=args.production)
    elif args.check_db_integrity:
        result = checker.check_database_integrity()
    else:
        # Run all checks by default
        results = checker.run_all_checks(include_api=True, production=args.production)
        result = results['overall_health']['is_healthy']
    
    # Save results
    if args.output:
        checker.save_results(args.output)
    
    # Exit with appropriate code
    exit_code = 0 if result else 1
    exit(exit_code)

if __name__ == "__main__":
    main()
