#!/usr/bin/env python3
"""
Analyse et traitement des données immobilières téléchargées

Ce script analyse les fichiers CSV téléchargés et prépare les données
pour InvestMTL en les transformant en format exploitable.
"""

import os
import pandas as pd
import logging
from pathlib import Path
import json
import numpy as np
from datetime import datetime
import zipfile

# Configuration des logs
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Répertoires
BASE_DIR = Path(__file__).parent.parent
RAW_DATA_DIR = BASE_DIR / "data" / "raw" / "real_estate"
PROCESSED_DATA_DIR = BASE_DIR / "data" / "processed"
PROCESSED_DATA_DIR.mkdir(parents=True, exist_ok=True)

class RealEstateProcessor:
    def __init__(self):
        self.datasets = {}
        self.summary = {
            'files_processed': 0,
            'total_records': 0,
            'processing_errors': [],
            'timestamp': datetime.now().isoformat()
        }

    def load_montreal_evaluation_units(self):
        """Charge les unités d'évaluation foncière de Montréal"""
        logger.info("🏠 Traitement des unités d'évaluation foncière de Montréal")
        
        file_path = RAW_DATA_DIR / "unites_evaluation_fonciere.csv"
        if not file_path.exists():
            logger.error(f"❌ Fichier non trouvé: {file_path}")
            return None
            
        try:
            # Charger le fichier CSV
            df = pd.read_csv(file_path, low_memory=False)
            
            # Optimiser les types après chargement
            for col in ['ID_UEV', 'CIVIQUE_DEBUT', 'CIVIQUE_FIN', 'NOM_RUE', 'SUITE_DEBUT', 
                       'MUNICIPALITE', 'CODE_UTILISATION', 'LIBELLE_UTILISATION', 
                       'CATEGORIE_UEF', 'MATRICULE83', 'NO_ARROND_ILE_CUM']:
                if col in df.columns:
                    df[col] = df[col].astype('string')
            
            for col in ['ETAGE_HORS_SOL', 'NOMBRE_LOGEMENT', 'ANNEE_CONSTRUCTION']:
                if col in df.columns:
                    df[col] = pd.to_numeric(df[col], errors='coerce').astype('Int64')
                    
            for col in ['SUPERFICIE_TERRAIN', 'SUPERFICIE_BATIMENT']:
                if col in df.columns:
                    df[col] = pd.to_numeric(df[col], errors='coerce')
            
            logger.info(f"📊 {len(df):,} unités d'évaluation chargées")
            logger.info(f"🏢 Colonnes: {list(df.columns)}")
            
            # Statistiques de base
            logger.info(f"🏠 Logements résidentiels: {len(df[df['LIBELLE_UTILISATION'].str.contains('Logement', na=False)]):,}")
            logger.info(f"🏢 Condominiums: {len(df[df['CATEGORIE_UEF'] == 'Condominium']):,}")
            logger.info(f"📅 Années construction: {df['ANNEE_CONSTRUCTION'].min()} - {df['ANNEE_CONSTRUCTION'].max()}")
            
            # Filtrer pour Montréal seulement (municipalité 50)
            df_montreal = df[df['MUNICIPALITE'] == '50'].copy()
            logger.info(f"🌆 Unités dans Montréal: {len(df_montreal):,}")
            
            # Sauvegarder
            output_path = PROCESSED_DATA_DIR / "montreal_evaluation_units.parquet"
            df_montreal.to_parquet(output_path, index=False)
            logger.info(f"💾 Sauvegardé: {output_path}")
            
            self.datasets['montreal_units'] = {
                'records': len(df_montreal),
                'file': str(output_path),
                'description': 'Unités d\'évaluation foncière de Montréal'
            }
            
            return df_montreal
            
        except Exception as e:
            logger.error(f"❌ Erreur lors du traitement: {e}")
            self.summary['processing_errors'].append(f"montreal_evaluation_units: {str(e)}")
            return None

    def load_quebec_evaluation_rolls(self):
        """Charge les rôles d'évaluation du Québec"""
        logger.info("🏛️ Traitement des rôles d'évaluation du Québec")
        
        file_path = RAW_DATA_DIR / "quebec_open_data_Rôles d'évaluation foncière du Québec géoréférencés 2025"
        if not file_path.exists():
            logger.error(f"❌ Fichier non trouvé: {file_path}")
            return None
            
        try:
            # Le fichier semble avoir un format spécial avec des types de colonnes
            df = pd.read_csv(file_path, low_memory=False)
            
            logger.info(f"📊 {len(df):,} rôles d'évaluation chargés")
            logger.info(f"🏢 Colonnes: {list(df.columns)}")
            
            # Nettoyer les noms de colonnes (enlever les types)
            df.columns = [col.split(',')[0] for col in df.columns]
            
            # Sauvegarder un échantillon pour analyse
            sample_size = min(10000, len(df))
            df_sample = df.head(sample_size).copy()
            
            output_path = PROCESSED_DATA_DIR / "quebec_evaluation_sample.parquet"
            df_sample.to_parquet(output_path, index=False)
            logger.info(f"💾 Échantillon sauvegardé: {output_path} ({sample_size:,} lignes)")
            
            self.datasets['quebec_sample'] = {
                'records': sample_size,
                'file': str(output_path),
                'description': f'Échantillon rôles d\'évaluation Québec ({sample_size:,} sur {len(df):,})'
            }
            
            return df_sample
            
        except Exception as e:
            logger.error(f"❌ Erreur lors du traitement: {e}")
            self.summary['processing_errors'].append(f"quebec_evaluation_rolls: {str(e)}")
            return None

    def process_statistics_canada_files(self):
        """Traite les fichiers de Statistique Canada"""
        logger.info("📈 Traitement des données de Statistique Canada")
        
        stats_can_files = [f for f in RAW_DATA_DIR.glob("statistics_canada_*")]
        
        for file_path in stats_can_files:
            logger.info(f"📄 Traitement: {file_path.name}")
            
            try:
                # Vérifier si c'est un ZIP
                if file_path.name.endswith(('.zip', '.ZIP')):
                    with zipfile.ZipFile(file_path, 'r') as zip_ref:
                        csv_files = [f for f in zip_ref.namelist() if f.endswith('.csv')]
                        if csv_files:
                            for csv_file in csv_files:
                                with zip_ref.open(csv_file) as csv_f:
                                    df = pd.read_csv(csv_f, low_memory=False)
                                    logger.info(f"📊 {csv_file}: {len(df):,} lignes, {len(df.columns)} colonnes")
                elif file_path.is_file() and not file_path.name.endswith('.json'):
                    df = pd.read_csv(file_path, low_memory=False)
                    logger.info(f"📊 {file_path.name}: {len(df):,} lignes, {len(df.columns)} colonnes")
                    
                    # Sauvegarder en Parquet pour efficacité
                    output_name = file_path.stem + ".parquet"
                    output_path = PROCESSED_DATA_DIR / output_name
                    df.to_parquet(output_path, index=False)
                    
                    self.datasets[file_path.stem] = {
                        'records': len(df),
                        'file': str(output_path),
                        'description': f'Statistique Canada - {file_path.name}'
                    }
                    
            except Exception as e:
                logger.error(f"❌ Erreur avec {file_path.name}: {e}")
                self.summary['processing_errors'].append(f"{file_path.name}: {str(e)}")

    def analyze_property_types_and_values(self, df_montreal):
        """Analyse les types de propriétés et leurs valeurs"""
        if df_montreal is None or len(df_montreal) == 0:
            return
            
        logger.info("🏠 Analyse des types de propriétés")
        
        # Analyse par type d'utilisation
        usage_stats = df_montreal['LIBELLE_UTILISATION'].value_counts().head(10)
        logger.info("🏢 Top 10 des types d'utilisation:")
        for usage, count in usage_stats.items():
            logger.info(f"   {usage}: {count:,} unités")
        
        # Analyse par année de construction
        construction_years = df_montreal['ANNEE_CONSTRUCTION'].dropna()
        if len(construction_years) > 0:
            logger.info(f"🏗️ Années de construction: {construction_years.min():.0f} à {construction_years.max():.0f}")
            logger.info(f"📅 Année médiane: {construction_years.median():.0f}")
        
        # Analyse des superficies
        surfaces_terrain = df_montreal['SUPERFICIE_TERRAIN'].dropna()
        surfaces_batiment = df_montreal['SUPERFICIE_BATIMENT'].dropna()
        
        if len(surfaces_terrain) > 0:
            logger.info(f"🏞️ Superficie terrain médiane: {surfaces_terrain.median():.0f} m²")
        
        if len(surfaces_batiment) > 0:
            logger.info(f"🏠 Superficie bâtiment médiane: {surfaces_batiment.median():.0f} m²")
        
        # Créer un résumé analytique
        analysis = {
            'total_units': len(df_montreal),
            'property_types': usage_stats.to_dict(),
            'construction_period': {
                'min_year': int(construction_years.min()) if len(construction_years) > 0 else None,
                'max_year': int(construction_years.max()) if len(construction_years) > 0 else None,
                'median_year': int(construction_years.median()) if len(construction_years) > 0 else None
            },
            'surface_stats': {
                'median_land_surface': float(surfaces_terrain.median()) if len(surfaces_terrain) > 0 else None,
                'median_building_surface': float(surfaces_batiment.median()) if len(surfaces_batiment) > 0 else None
            }
        }
        
        # Sauvegarder l'analyse
        analysis_path = PROCESSED_DATA_DIR / "montreal_property_analysis.json"
        with open(analysis_path, 'w', encoding='utf-8') as f:
            json.dump(analysis, f, indent=2, ensure_ascii=False)
        
        logger.info(f"📊 Analyse sauvegardée: {analysis_path}")

    def generate_investment_zones(self, df_montreal):
        """Génère des zones d'investissement basées sur les données"""
        if df_montreal is None or len(df_montreal) == 0:
            return
            
        logger.info("🎯 Génération des zones d'investissement")
        
        # Logements résidentiels uniquement
        residential = df_montreal[
            df_montreal['LIBELLE_UTILISATION'].str.contains('Logement', na=False)
        ].copy()
        
        if len(residential) == 0:
            logger.warning("⚠️ Aucun logement résidentiel trouvé")
            return
        
        logger.info(f"🏠 {len(residential):,} logements résidentiels analysés")
        
        # Grouper par rue pour créer des zones
        street_analysis = residential.groupby('NOM_RUE').agg({
            'ID_UEV': 'count',
            'NOMBRE_LOGEMENT': 'sum',
            'ANNEE_CONSTRUCTION': ['mean', 'min', 'max'],
            'SUPERFICIE_TERRAIN': 'mean',
            'SUPERFICIE_BATIMENT': 'mean',
            'ETAGE_HORS_SOL': 'mean'
        }).reset_index()
        
        # Aplatir les colonnes multi-niveau
        street_analysis.columns = ['_'.join(col).strip('_') for col in street_analysis.columns]
        street_analysis.rename(columns={'NOM_RUE_': 'street_name'}, inplace=True)
        
        # Vérifier les colonnes créées
        logger.info(f"📋 Colonnes créées: {list(street_analysis.columns)}")
        
        # Filtrer les rues avec au moins 5 propriétés
        significant_streets = street_analysis[street_analysis['ID_UEV_count'] >= 5].copy()
        
        # Calculer un score d'attractivité
        significant_streets['density_score'] = significant_streets['NOMBRE_LOGEMENT_sum'] / significant_streets['ID_UEV_count']
        significant_streets['modernity_score'] = (significant_streets['ANNEE_CONSTRUCTION_mean'] - 1950) / (2024 - 1950) * 100
        significant_streets['size_score'] = significant_streets['SUPERFICIE_BATIMENT_mean'] / 100
        
        # Score composite (normalisé sur 100)
        max_density = significant_streets['density_score'].max()
        max_size = significant_streets['size_score'].max()
        
        significant_streets['investment_score'] = (
            (significant_streets['density_score'] / max_density * 30) +
            (significant_streets['modernity_score'] * 0.4) +
            (significant_streets['size_score'] / max_size * 30)
        ).round(1)
        
        # Trier par score d'investissement
        top_zones = significant_streets.sort_values('investment_score', ascending=False).head(50)
        
        logger.info(f"🎯 Top 10 des zones d'investissement:")
        for _, zone in top_zones.head(10).iterrows():
            street_col = 'street_name' if 'street_name' in zone.index else zone.index[0]
            logger.info(f"   {zone[street_col]}: Score {zone['investment_score']}/100 ({zone['ID_UEV_count']} propriétés)")
        
        # Sauvegarder les zones d'investissement
        zones_path = PROCESSED_DATA_DIR / "investment_zones.parquet"
        top_zones.to_parquet(zones_path, index=False)
        logger.info(f"🎯 Zones d'investissement sauvegardées: {zones_path}")
        
        self.datasets['investment_zones'] = {
            'records': len(top_zones),
            'file': str(zones_path),
            'description': 'Top 50 des zones d\'investissement immobilier à Montréal'
        }

    def process_all(self):
        """Traite tous les datasets"""
        logger.info("🚀 Début du traitement des données immobilières")
        
        # 1. Charger les unités d'évaluation de Montréal
        df_montreal = self.load_montreal_evaluation_units()
        if df_montreal is not None:
            self.summary['files_processed'] += 1
            self.summary['total_records'] += len(df_montreal)
        
        # 2. Analyser les propriétés et valeurs
        self.analyze_property_types_and_values(df_montreal)
        
        # 3. Générer les zones d'investissement
        self.generate_investment_zones(df_montreal)
        
        # 4. Charger un échantillon des rôles du Québec
        df_quebec = self.load_quebec_evaluation_rolls()
        if df_quebec is not None:
            self.summary['files_processed'] += 1
            self.summary['total_records'] += len(df_quebec)
        
        # 5. Traiter les fichiers de Statistique Canada
        self.process_statistics_canada_files()
        
        # 6. Générer le rapport final
        self.generate_final_report()

    def generate_final_report(self):
        """Génère le rapport final de traitement"""
        self.summary['datasets'] = self.datasets
        
        report_path = PROCESSED_DATA_DIR / "processing_report.json"
        with open(report_path, 'w', encoding='utf-8') as f:
            json.dump(self.summary, f, indent=2, ensure_ascii=False)
        
        logger.info(f"\n📊 RAPPORT FINAL")
        logger.info(f"✅ Fichiers traités: {self.summary['files_processed']}")
        logger.info(f"📊 Total enregistrements: {self.summary['total_records']:,}")
        logger.info(f"🗂️ Datasets créés: {len(self.datasets)}")
        logger.info(f"❌ Erreurs: {len(self.summary['processing_errors'])}")
        logger.info(f"📁 Répertoire: {PROCESSED_DATA_DIR}")
        logger.info(f"📄 Rapport détaillé: {report_path}")
        
        if self.summary['processing_errors']:
            logger.warning(f"⚠️ Erreurs détaillées:")
            for error in self.summary['processing_errors']:
                logger.warning(f"  • {error}")

def main():
    """Fonction principale"""
    processor = RealEstateProcessor()
    
    try:
        processor.process_all()
        logger.info(f"\n🎉 Traitement terminé avec succès !")
        
    except Exception as e:
        logger.error(f"\n💥 Erreur fatale: {e}")
        raise

if __name__ == "__main__":
    main()
