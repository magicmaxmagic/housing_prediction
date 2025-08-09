#!/usr/bin/env python3
"""
Export des données SQLite vers un fichier SQL pour D1

Ce script exporte notre base de données SQLite locale vers un fichier .sql
compatible avec Cloudflare D1.
"""

import sqlite3
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).parent.parent
API_DIR = BASE_DIR / "api"
DB_PATH = API_DIR / "database.sqlite"
SQL_EXPORT_PATH = API_DIR / "database_export.sql"

def export_to_sql():
    """Exporte la base SQLite vers un fichier SQL"""
    logger.info("🗄️ Export de la base de données vers SQL")
    
    if not DB_PATH.exists():
        logger.error(f"❌ Base de données non trouvée: {DB_PATH}")
        return
    
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        
        # Ouvrir le fichier de sortie
        with open(SQL_EXPORT_PATH, 'w', encoding='utf-8') as sql_file:
            
            # Récupérer la liste des tables
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = cursor.fetchall()
            
            logger.info(f"📋 Tables trouvées: {[table[0] for table in tables]}")
            
            for table_name, in tables:
                if table_name == 'sqlite_sequence':
                    continue
                    
                logger.info(f"📄 Export de la table: {table_name}")
                
                # Récupérer le schéma de la table
                cursor.execute(f"SELECT sql FROM sqlite_master WHERE type='table' AND name='{table_name}'")
                create_table_sql = cursor.fetchone()[0]
                
                sql_file.write(f"-- Table: {table_name}\n")
                sql_file.write(f"{create_table_sql};\n\n")
                
                # Récupérer les données
                cursor.execute(f"SELECT * FROM {table_name}")
                rows = cursor.fetchall()
                
                if rows:
                    # Récupérer les noms des colonnes
                    cursor.execute(f"PRAGMA table_info({table_name})")
                    columns_info = cursor.fetchall()
                    column_names = [col[1] for col in columns_info]
                    
                    logger.info(f"📊 {len(rows):,} lignes à exporter pour {table_name}")
                    
                    # Limiter les données si trop nombreuses
                    export_limit = 1000 if table_name == 'evaluation_units' else len(rows)
                    rows_to_export = rows[:export_limit]
                    
                    if len(rows) > export_limit:
                        logger.info(f"⚠️ Limitation à {export_limit:,} lignes pour {table_name}")
                    
                    # Écrire les données par lots
                    batch_size = 100
                    for i in range(0, len(rows_to_export), batch_size):
                        batch = rows_to_export[i:i+batch_size]
                        
                        sql_file.write(f"INSERT INTO {table_name} ({', '.join(column_names)}) VALUES\n")
                        
                        values_list = []
                        for row in batch:
                            # Échapper les valeurs
                            escaped_values = []
                            for value in row:
                                if value is None:
                                    escaped_values.append('NULL')
                                elif isinstance(value, str):
                                    # Échapper les apostrophes
                                    escaped_value = value.replace("'", "''")
                                    escaped_values.append(f"'{escaped_value}'")
                                else:
                                    escaped_values.append(str(value))
                            values_list.append(f"({', '.join(escaped_values)})")
                        
                        sql_file.write(',\n'.join(values_list))
                        sql_file.write(';\n\n')
                
                else:
                    logger.info(f"⚠️ Table {table_name} est vide")
                    
    logger.info(f"✅ Export terminé: {SQL_EXPORT_PATH}")
    logger.info(f"📦 Taille du fichier: {SQL_EXPORT_PATH.stat().st_size / 1024:.1f} KB")

if __name__ == "__main__":
    export_to_sql()
