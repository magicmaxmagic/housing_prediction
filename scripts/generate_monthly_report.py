#!/usr/bin/env python3
"""
Monthly report generator for InvestMTL platform
Generates comprehensive reports on market trends, predictions, and platform health
"""

import argparse
import json
import sqlite3
import pandas as pd
from datetime import datetime, timedelta
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class MonthlyReportGenerator:
    def __init__(self, db_path: str = './data/investmtl.db', output_dir: str = './reports'):
        self.db_path = db_path
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
        
        # Set up matplotlib for better-looking plots
        plt.style.use('seaborn-v0_8')
        sns.set_palette("husl")
        
    def connect_db(self):
        """Create database connection"""
        return sqlite3.connect(self.db_path)

    def get_monthly_stats(self, year: int, month: int):
        """Get key statistics for the specified month"""
        conn = self.connect_db()
        
        # Date range for the month
        start_date = f"{year}-{month:02d}-01"
        if month == 12:
            end_date = f"{year + 1}-01-01"
        else:
            end_date = f"{year}-{month + 1:02d}-01"
        
        stats = {}
        
        # Zone statistics
        zones_df = pd.read_sql_query("""
            SELECT 
                COUNT(*) as total_zones,
                AVG(investment_score) as avg_investment_score,
                AVG(avg_price_per_sqft) as avg_price_per_sqft,
                AVG(avg_rent_per_sqft) as avg_rent_per_sqft,
                AVG(avg_annual_return) as avg_annual_return,
                MAX(updated_at) as last_update
            FROM zones
        """, conn)
        
        stats['zones'] = zones_df.iloc[0].to_dict()
        
        # Properties added this month
        properties_df = pd.read_sql_query("""
            SELECT 
                COUNT(*) as properties_added,
                AVG(price_per_sqft) as avg_new_property_price
            FROM properties 
            WHERE created_at >= ? AND created_at < ?
        """, conn, params=[start_date, end_date])
        
        stats['properties'] = properties_df.iloc[0].to_dict()
        
        # Predictions statistics
        predictions_df = pd.read_sql_query("""
            SELECT 
                COUNT(*) as total_predictions,
                AVG(predicted_price) as avg_predicted_price,
                AVG(predicted_rent) as avg_predicted_rent,
                AVG(price_confidence_max - price_confidence_min) as avg_price_confidence_range,
                AVG(rent_confidence_max - rent_confidence_min) as avg_rent_confidence_range
            FROM predictions
            WHERE prediction_date >= ? AND prediction_date < ?
        """, conn, params=[start_date, end_date])
        
        stats['predictions'] = predictions_df.iloc[0].to_dict()
        
        # User activity (if user tables exist)
        try:
            users_df = pd.read_sql_query("""
                SELECT 
                    COUNT(*) as new_users,
                    (SELECT COUNT(*) FROM user_favorites WHERE added_at >= ? AND added_at < ?) as new_favorites
                FROM users 
                WHERE created_at >= ? AND created_at < ?
            """, conn, params=[start_date, end_date, start_date, end_date])
            
            stats['users'] = users_df.iloc[0].to_dict()
        except:
            stats['users'] = {'new_users': 0, 'new_favorites': 0}
        
        conn.close()
        return stats

    def get_top_zones_analysis(self):
        """Analyze top performing zones"""
        conn = self.connect_db()
        
        # Top zones by investment score
        top_zones_df = pd.read_sql_query("""
            SELECT 
                z.*,
                p.predicted_price,
                p.predicted_rent,
                (p.predicted_price - z.avg_price_per_sqft) / z.avg_price_per_sqft * 100 as price_growth_forecast,
                (p.predicted_rent - z.avg_rent_per_sqft) / z.avg_rent_per_sqft * 100 as rent_growth_forecast
            FROM zones z
            LEFT JOIN predictions p ON z.zone_id = p.zone_id
            ORDER BY z.investment_score DESC
            LIMIT 20
        """, conn)
        
        # Borough analysis
        borough_df = pd.read_sql_query("""
            SELECT 
                borough,
                COUNT(*) as zone_count,
                AVG(investment_score) as avg_investment_score,
                AVG(avg_price_per_sqft) as avg_price,
                AVG(avg_rent_per_sqft) as avg_rent,
                AVG(avg_annual_return) as avg_return
            FROM zones
            GROUP BY borough
            ORDER BY avg_investment_score DESC
        """, conn)
        
        conn.close()
        return top_zones_df, borough_df

    def create_visualizations(self, stats: dict, top_zones_df: pd.DataFrame, borough_df: pd.DataFrame, output_prefix: str):
        """Create visualization charts"""
        
        # 1. Investment Score Distribution
        conn = self.connect_db()
        all_zones_df = pd.read_sql_query("SELECT investment_score, borough FROM zones", conn)
        
        fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2, figsize=(15, 12))
        
        # Investment score histogram
        ax1.hist(all_zones_df['investment_score'], bins=20, alpha=0.7, color='skyblue', edgecolor='black')
        ax1.set_title('Investment Score Distribution')
        ax1.set_xlabel('Investment Score')
        ax1.set_ylabel('Number of Zones')
        ax1.axvline(all_zones_df['investment_score'].mean(), color='red', linestyle='--', 
                   label=f'Mean: {all_zones_df["investment_score"].mean():.1f}')
        ax1.legend()
        
        # Top zones by investment score
        top_10 = top_zones_df.head(10)
        ax2.barh(range(len(top_10)), top_10['investment_score'])
        ax2.set_yticks(range(len(top_10)))
        ax2.set_yticklabels(top_10['zone_name'])
        ax2.set_xlabel('Investment Score')
        ax2.set_title('Top 10 Zones by Investment Score')
        ax2.invert_yaxis()
        
        # Borough comparison
        ax3.bar(borough_df['borough'], borough_df['avg_investment_score'])
        ax3.set_title('Average Investment Score by Borough')
        ax3.set_xlabel('Borough')
        ax3.set_ylabel('Average Investment Score')
        ax3.tick_params(axis='x', rotation=45)
        
        # Price vs Rent scatter plot
        scatter_df = pd.read_sql_query("""
            SELECT avg_price_per_sqft, avg_rent_per_sqft, investment_score, zone_name 
            FROM zones 
            WHERE avg_price_per_sqft IS NOT NULL AND avg_rent_per_sqft IS NOT NULL
        """, conn)
        
        scatter = ax4.scatter(scatter_df['avg_price_per_sqft'], scatter_df['avg_rent_per_sqft'], 
                             c=scatter_df['investment_score'], cmap='viridis', alpha=0.6)
        ax4.set_xlabel('Average Price per sq ft ($)')
        ax4.set_ylabel('Average Rent per sq ft ($)')
        ax4.set_title('Price vs Rent (colored by Investment Score)')
        plt.colorbar(scatter, ax=ax4, label='Investment Score')
        
        plt.tight_layout()
        plt.savefig(self.output_dir / f'{output_prefix}_visualizations.png', dpi=300, bbox_inches='tight')
        plt.close()
        
        # 2. Prediction Analysis Chart
        if stats['predictions']['total_predictions'] > 0:
            predictions_df = pd.read_sql_query("""
                SELECT 
                    z.zone_name,
                    z.avg_price_per_sqft as current_price,
                    p.predicted_price,
                    z.avg_rent_per_sqft as current_rent,
                    p.predicted_rent,
                    z.investment_score
                FROM zones z
                JOIN predictions p ON z.zone_id = p.zone_id
                ORDER BY z.investment_score DESC
                LIMIT 15
            """, conn)
            
            fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(15, 6))
            
            # Price predictions
            x = range(len(predictions_df))
            ax1.bar([i - 0.2 for i in x], predictions_df['current_price'], width=0.4, 
                   label='Current Price', alpha=0.7)
            ax1.bar([i + 0.2 for i in x], predictions_df['predicted_price'], width=0.4, 
                   label='Predicted Price', alpha=0.7)
            ax1.set_xlabel('Zones')
            ax1.set_ylabel('Price per sq ft ($)')
            ax1.set_title('Current vs Predicted Prices (Top 15 Zones)')
            ax1.set_xticks(x)
            ax1.set_xticklabels(predictions_df['zone_name'], rotation=45, ha='right')
            ax1.legend()
            
            # Rent predictions
            ax2.bar([i - 0.2 for i in x], predictions_df['current_rent'], width=0.4, 
                   label='Current Rent', alpha=0.7)
            ax2.bar([i + 0.2 for i in x], predictions_df['predicted_rent'], width=0.4, 
                   label='Predicted Rent', alpha=0.7)
            ax2.set_xlabel('Zones')
            ax2.set_ylabel('Rent per sq ft ($)')
            ax2.set_title('Current vs Predicted Rents (Top 15 Zones)')
            ax2.set_xticks(x)
            ax2.set_xticklabels(predictions_df['zone_name'], rotation=45, ha='right')
            ax2.legend()
            
            plt.tight_layout()
            plt.savefig(self.output_dir / f'{output_prefix}_predictions.png', dpi=300, bbox_inches='tight')
            plt.close()
        
        conn.close()

    def generate_html_report(self, year: int, month: int, stats: dict, top_zones_df: pd.DataFrame, 
                           borough_df: pd.DataFrame, output_prefix: str):
        """Generate comprehensive HTML report"""
        
        month_name = datetime(year, month, 1).strftime('%B %Y')
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>InvestMTL Monthly Report - {month_name}</title>
            <style>
                body {{ font-family: 'Arial', sans-serif; margin: 40px; line-height: 1.6; }}
                .header {{ text-align: center; margin-bottom: 40px; border-bottom: 3px solid #2563eb; padding-bottom: 20px; }}
                .header h1 {{ color: #1e40af; margin-bottom: 10px; }}
                .summary {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin: 30px 0; }}
                .metric-card {{ background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); padding: 20px; border-radius: 10px; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }}
                .metric-card h3 {{ margin: 0 0 10px 0; color: #374151; }}
                .metric-card .value {{ font-size: 2em; font-weight: bold; color: #1e40af; }}
                .metric-card .label {{ color: #6b7280; font-size: 0.9em; }}
                .section {{ margin: 40px 0; }}
                .section h2 {{ color: #1e40af; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; }}
                table {{ width: 100%; border-collapse: collapse; margin: 20px 0; }}
                th, td {{ border: 1px solid #d1d5db; padding: 12px; text-align: left; }}
                th {{ background-color: #f3f4f6; font-weight: bold; }}
                tr:nth-child(even) {{ background-color: #f9fafb; }}
                .chart-container {{ text-align: center; margin: 30px 0; }}
                .chart-container img {{ max-width: 100%; height: auto; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }}
                .highlight {{ background-color: #dbeafe; padding: 15px; border-radius: 8px; border-left: 4px solid #2563eb; }}
                .footer {{ margin-top: 60px; text-align: center; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 20px; }}
                .growth-positive {{ color: #059669; }}
                .growth-negative {{ color: #dc2626; }}
            </style>
        </head>
        <body>
            <div class="header">
                <h1>InvestMTL Monthly Report</h1>
                <h2>{month_name}</h2>
                <p>Generated on {datetime.now().strftime('%B %d, %Y at %I:%M %p')}</p>
            </div>

            <div class="section">
                <h2>📊 Key Metrics Summary</h2>
                <div class="summary">
                    <div class="metric-card">
                        <h3>Total Zones</h3>
                        <div class="value">{stats['zones']['total_zones']:.0f}</div>
                        <div class="label">Active investment zones</div>
                    </div>
                    <div class="metric-card">
                        <h3>Avg Investment Score</h3>
                        <div class="value">{stats['zones']['avg_investment_score']:.1f}</div>
                        <div class="label">Out of 100</div>
                    </div>
                    <div class="metric-card">
                        <h3>Avg Price/sq ft</h3>
                        <div class="value">${stats['zones']['avg_price_per_sqft']:.0f}</div>
                        <div class="label">Montreal average</div>
                    </div>
                    <div class="metric-card">
                        <h3>Avg Annual Return</h3>
                        <div class="value">{stats['zones']['avg_annual_return']:.1f}%</div>
                        <div class="label">Investment return</div>
                    </div>
                </div>
            </div>

            <div class="section">
                <h2>🎯 AI Predictions Summary</h2>
                <div class="highlight">
                    <p><strong>Predictions Generated:</strong> {stats['predictions']['total_predictions']:.0f} zones analyzed with AI models</p>
                    <p><strong>Average Predicted Price:</strong> ${stats['predictions']['avg_predicted_price']:.0f} per sq ft</p>
                    <p><strong>Average Predicted Rent:</strong> ${stats['predictions']['avg_predicted_rent']:.2f} per sq ft</p>
                    <p><strong>Model Confidence:</strong> ±${stats['predictions']['avg_price_confidence_range']:.0f} price range, ±${stats['predictions']['avg_rent_confidence_range']:.3f} rent range</p>
                </div>
            </div>

            <div class="chart-container">
                <h3>Market Analysis Visualizations</h3>
                <img src="{output_prefix}_visualizations.png" alt="Market Analysis Charts">
            </div>
        """

        # Add predictions chart if available
        if stats['predictions']['total_predictions'] > 0:
            html_content += f"""
            <div class="chart-container">
                <h3>AI Prediction Analysis</h3>
                <img src="{output_prefix}_predictions.png" alt="Prediction Analysis Charts">
            </div>
            """

        # Top zones table
        html_content += f"""
            <div class="section">
                <h2>🏆 Top Investment Opportunities</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Rank</th>
                            <th>Zone</th>
                            <th>Borough</th>
                            <th>Investment Score</th>
                            <th>Price/sq ft</th>
                            <th>Rent/sq ft</th>
                            <th>Annual Return</th>
                            <th>Price Forecast</th>
                        </tr>
                    </thead>
                    <tbody>
        """

        for rank, (_, zone) in enumerate(top_zones_df.head(10).iterrows(), start=1):
            price_growth = zone['price_growth_forecast'] if pd.notna(zone['price_growth_forecast']) else 0
            growth_class = 'growth-positive' if price_growth >= 0 else 'growth-negative'
            
            html_content += f"""
                        <tr>
                            <td>{rank}</td>
                            <td>{zone['zone_name']}</td>
                            <td>{zone['borough']}</td>
                            <td>{zone['investment_score']:.1f}</td>
                            <td>${zone['avg_price_per_sqft']:.0f}</td>
                            <td>${zone['avg_rent_per_sqft']:.2f}</td>
                            <td>{zone['avg_annual_return']:.1f}%</td>
                            <td class="{growth_class}">{price_growth:+.1f}%</td>
                        </tr>
            """

        html_content += """
                    </tbody>
                </table>
            </div>

            <div class="section">
                <h2>🏘️ Borough Performance Analysis</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Borough</th>
                            <th>Zones</th>
                            <th>Avg Investment Score</th>
                            <th>Avg Price/sq ft</th>
                            <th>Avg Rent/sq ft</th>
                            <th>Avg Annual Return</th>
                        </tr>
                    </thead>
                    <tbody>
        """

        for _, borough in borough_df.iterrows():
            html_content += f"""
                        <tr>
                            <td>{borough['borough']}</td>
                            <td>{borough['zone_count']:.0f}</td>
                            <td>{borough['avg_investment_score']:.1f}</td>
                            <td>${borough['avg_price']:.0f}</td>
                            <td>${borough['avg_rent']:.2f}</td>
                            <td>{borough['avg_return']:.1f}%</td>
                        </tr>
            """

        html_content += f"""
                    </tbody>
                </table>
            </div>

            <div class="section">
                <h2>📈 Platform Activity</h2>
                <div class="highlight">
                    <p><strong>New Properties Added:</strong> {stats['properties']['properties_added']:.0f} properties this month</p>
                    <p><strong>New Users:</strong> {stats['users']['new_users']:.0f} users joined</p>
                    <p><strong>New Favorites:</strong> {stats['users']['new_favorites']:.0f} zones favorited</p>
                    <p><strong>Last Data Update:</strong> {stats['zones']['last_update'] or 'N/A'}</p>
                </div>
            </div>

            <div class="footer">
                <p>This report was automatically generated by the InvestMTL platform</p>
                <p>Montreal Real Estate Investment Analysis • {datetime.now().year}</p>
                <p>For questions or support, please contact the development team</p>
            </div>
        </body>
        </html>
        """

        # Save HTML report
        html_file = self.output_dir / f'{output_prefix}_report.html'
        with open(html_file, 'w', encoding='utf-8') as f:
            f.write(html_content)
        
        return html_file

    def generate_json_summary(self, year: int, month: int, stats: dict, output_prefix: str):
        """Generate machine-readable JSON summary"""
        summary = {
            'report_meta': {
                'year': year,
                'month': month,
                'generated_at': datetime.now().isoformat(),
                'platform': 'InvestMTL',
                'version': '1.0'
            },
            'key_metrics': {
                'zones': stats['zones'],
                'properties': stats['properties'], 
                'predictions': stats['predictions'],
                'users': stats['users']
            },
            'market_insights': {
                'total_zones_analyzed': stats['zones']['total_zones'],
                'market_health_score': stats['zones']['avg_investment_score'],
                'prediction_coverage': stats['predictions']['total_predictions'] / stats['zones']['total_zones'] * 100 if stats['zones']['total_zones'] > 0 else 0,
                'platform_growth_indicators': {
                    'new_properties_monthly': stats['properties']['properties_added'],
                    'new_users_monthly': stats['users']['new_users'],
                    'user_engagement': stats['users']['new_favorites']
                }
            }
        }
        
        json_file = self.output_dir / f'{output_prefix}_summary.json'
        with open(json_file, 'w') as f:
            json.dump(summary, f, indent=2, default=str)
        
        return json_file

    def generate_report(self, year: int, month: int):
        """Generate complete monthly report"""
        logger.info(f"Generating monthly report for {year}-{month:02d}")
        
        # Create output prefix
        output_prefix = f"monthly_report_{year}_{month:02d}"
        
        try:
            # Gather data
            stats = self.get_monthly_stats(year, month)
            top_zones_df, borough_df = self.get_top_zones_analysis()
            
            # Create visualizations
            self.create_visualizations(stats, top_zones_df, borough_df, output_prefix)
            
            # Generate reports
            html_file = self.generate_html_report(year, month, stats, top_zones_df, borough_df, output_prefix)
            json_file = self.generate_json_summary(year, month, stats, output_prefix)
            
            logger.info(f"Report generated successfully:")
            logger.info(f"  HTML: {html_file}")
            logger.info(f"  JSON: {json_file}")
            logger.info(f"  Charts: {output_prefix}_*.png")
            
            return {
                'html_report': html_file,
                'json_summary': json_file,
                'visualizations': [
                    self.output_dir / f'{output_prefix}_visualizations.png',
                    self.output_dir / f'{output_prefix}_predictions.png'
                ]
            }
            
        except Exception as e:
            logger.error(f"Failed to generate report: {e}")
            raise

def main():
    parser = argparse.ArgumentParser(description='Generate monthly report for InvestMTL')
    parser.add_argument('--month', help='Month in YYYY-MM format (default: current month)')
    parser.add_argument('--db-path', help='Path to SQLite database')
    parser.add_argument('--output', help='Output directory for reports')
    
    args = parser.parse_args()
    
    # Parse month
    if args.month:
        try:
            year, month = map(int, args.month.split('-'))
        except ValueError:
            logger.error("Month must be in YYYY-MM format")
            exit(1)
    else:
        now = datetime.now()
        year, month = now.year, now.month
    
    # Initialize generator
    generator = MonthlyReportGenerator(
        db_path=args.db_path or './data/investmtl.db',
        output_dir=args.output or './reports'
    )
    
    # Generate report
    try:
        result = generator.generate_report(year, month)
        logger.info("Monthly report generation completed successfully!")
        
    except Exception as e:
        logger.error(f"Report generation failed: {e}")
        exit(1)

if __name__ == "__main__":
    main()
