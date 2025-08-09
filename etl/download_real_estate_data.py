#!/usr/bin/env python3
"""
Téléchargement automatisé des données immobilières de Montréal

Ce script télécharge automatiquement tous les CSV et datasets
contenant des données sur l'immobilier de Montréal depuis différentes sources :
- Open Canada (permis de construction)
- Données Montréal (évaluation foncière, urbanisme)
- Données Québec (rôles d'évaluation)

Usage: python download_real_estate_data.py
"""

import os
import logging
import requests
from pathlib import Path
from urllib.parse import urlparse
import time
import json
from datetime import datetime

# Configuration des logs
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('download_real_estate.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Configuration des répertoires
BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "data" / "raw" / "real_estate"
DATA_DIR.mkdir(parents=True, exist_ok=True)

# Configuration des sources de données
DATA_SOURCES = {
    "open_canada": {
        "name": "Open Canada - Construction Permits",
        "datasets": [
            {
                "url": "https://open.canada.ca/data/en/dataset/d90eaf1b-2de8-43f0-923a-27a620ecdf41",
                "files": [
                    {
                        "name": "construction_permits.csv",
                        "direct_url": "https://donnees.montreal.ca/dataset/4ad6baea-4d2c-460f-a8bf-5d000db498f7/resource/84be03b9-342a-4c0a-8591-7d835b7e65c2/download/permis-construction-demolition-transformation.csv",
                        "description": "Permis de construction, transformation et démolition"
                    },
                    {
                        "name": "construction_statistics.csv", 
                        "direct_url": "https://donnees.montreal.ca/dataset/4ad6baea-4d2c-460f-a8bf-5d000db498f7/resource/1613d602-70ce-42b5-b189-acfe19e4189b/download/statistiques-permis-construction-demolition-transformation.csv",
                        "description": "Statistiques sur les permis de construction"
                    }
                ]
            }
        ]
    },
    "montreal_open_data": {
        "name": "Données Montréal",
        "datasets": [
            {
                "url": "https://donnees.montreal.ca/dataset/unites-evaluation-fonciere",
                "files": [
                    {
                        "name": "unites_evaluation_fonciere.csv",
                        "direct_url": "https://donnees.montreal.ca/dataset/4ad6baea-4d2c-460f-a8bf-5d000db498f7/resource/2b9dfc3d-91d3-48de-b32c-a2a6d9417079/download/uniteevaluationfonciere.csv",
                        "description": "Unités d'évaluation foncière (72,6 MB)"
                    }
                ]
            },
            {
                "url": "https://donnees.montreal.ca/dataset/plan-urbanisme-ppu",
                "files": [
                    {
                        "name": "plan_urbanisme_ppu.geojson",
                        "direct_url": "https://donnees.montreal.ca/dataset/cac53a2b-af5a-4ffc-9a8e-6b979d7ac4e4/resource/dd4f8f7c-41b4-4e45-81df-b18dd7a8e9a5/download/ppu.geojson",
                        "description": "Plan d'urbanisme - Programmes particuliers d'urbanisme"
                    }
                ]
            }
        ]
    },
    "quebec_open_data": {
        "name": "Données Québec",
        "datasets": [
            {
                "url": "https://www.donneesquebec.ca/recherche/dataset/roles-d-evaluation-fonciere-du-quebec",
                "files": [
                    {
                        "name": "roles_evaluation_quebec.csv",
                        "api_url": "https://www.donneesquebec.ca/recherche/api/3/action/package_show?id=roles-d-evaluation-fonciere-du-quebec",
                        "description": "Rôles d'évaluation foncière du Québec"
                    }
                ]
            }
        ]
    },
    "statistics_canada": {
        "name": "Statistique Canada",
        "datasets": [
            {
                "url": "https://open.canada.ca/data/en/dataset/93ce9cb5-0811-48e5-885e-98dce192d293",
                "files": [
                    {
                        "name": "census_housing_characteristics.csv",
                        "api_url": "https://open.canada.ca/data/api/3/action/package_show?id=93ce9cb5-0811-48e5-885e-98dce192d293",
                        "description": "Caractéristiques du logement - Recensement"
                    }
                ]
            },
            {
                "url": "https://open.canada.ca/data/en/dataset/324befd1-893b-42e6-bece-6d30af3dd9f1",
                "files": [
                    {
                        "name": "census_dwelling_conditions.csv", 
                        "api_url": "https://open.canada.ca/data/api/3/action/package_show?id=324befd1-893b-42e6-bece-6d30af3dd9f1",
                        "description": "Conditions des logements - Recensement"
                    }
                ]
            },
            {
                "url": "https://open.canada.ca/data/en/dataset/4dbc98c3-a80d-46cb-8a44-fc6bdf77eaf5",
                "files": [
                    {
                        "name": "census_housing_affordability.csv",
                        "api_url": "https://open.canada.ca/data/api/3/action/package_show?id=4dbc98c3-a80d-46cb-8a44-fc6bdf77eaf5", 
                        "description": "Abordabilité du logement - Recensement"
                    }
                ]
            }
        ]
    }
}

class RealEstateDataDownloader:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'InvestMTL Real Estate Data Collector 1.0 (maxence@investmtl.com)'
        })
        self.downloaded_files = []
        self.failed_downloads = []

    def download_file(self, url, filename, max_retries=3):
        """Télécharge un fichier avec gestion des erreurs et retry"""
        file_path = DATA_DIR / filename
        
        logger.info(f"Téléchargement de {filename} depuis {url}")
        
        for attempt in range(max_retries):
            try:
                response = self.session.get(url, timeout=60, stream=True)
                response.raise_for_status()
                
                # Vérifier le type de contenu
                content_type = response.headers.get('content-type', '').lower()
                if 'text/html' in content_type and filename.endswith('.csv'):
                    logger.warning(f"⚠️  URL {url} retourne du HTML au lieu de CSV")
                    self.failed_downloads.append({
                        'filename': filename,
                        'url': url,
                        'error': 'HTML returned instead of CSV'
                    })
                    return False
                
                # Télécharger le fichier
                with open(file_path, 'wb') as f:
                    for chunk in response.iter_content(chunk_size=8192):
                        if chunk:
                            f.write(chunk)
                
                file_size = file_path.stat().st_size
                logger.info(f"✅ {filename} téléchargé ({file_size / 1024 / 1024:.1f} MB)")
                
                self.downloaded_files.append({
                    'filename': filename,
                    'size_mb': file_size / 1024 / 1024,
                    'url': url,
                    'timestamp': datetime.now().isoformat()
                })
                return True
                
            except requests.exceptions.RequestException as e:
                logger.warning(f"Tentative {attempt + 1}/{max_retries} échouée pour {filename}: {e}")
                if attempt < max_retries - 1:
                    time.sleep(5)  # Attendre avant de réessayer
                else:
                    logger.error(f"❌ Échec du téléchargement de {filename} après {max_retries} tentatives")
                    self.failed_downloads.append({
                        'filename': filename,
                        'url': url,
                        'error': str(e)
                    })
                    return False
            except Exception as e:
                logger.error(f"❌ Erreur inattendue lors du téléchargement de {filename}: {e}")
                self.failed_downloads.append({
                    'filename': filename,
                    'url': url,
                    'error': str(e)
                })
                return False

    def get_ckan_download_urls(self, api_url):
        """Récupère les URLs de téléchargement depuis l'API CKAN"""
        try:
            response = self.session.get(api_url)
            response.raise_for_status()
            data = response.json()
            
            if data.get('success'):
                resources = data['result']['resources']
                csv_resources = [r for r in resources if r.get('format', '').upper() == 'CSV']
                return [(r['url'], r.get('name', 'data.csv')) for r in csv_resources]
            else:
                logger.error(f"Erreur API CKAN: {data.get('error', 'Erreur inconnue')}")
                return []
                
        except Exception as e:
            logger.error(f"Erreur lors de l'appel à l'API CKAN {api_url}: {e}")
            return []

    def download_all_datasets(self):
        """Télécharge tous les datasets configurés"""
        logger.info("🚀 Début du téléchargement des données immobilières")
        
        total_datasets = sum(len(source['datasets']) for source in DATA_SOURCES.values())
        current_dataset = 0
        
        for source_key, source_info in DATA_SOURCES.items():
            logger.info(f"\n📂 Traitement de la source: {source_info['name']}")
            
            for dataset in source_info['datasets']:
                current_dataset += 1
                logger.info(f"Dataset {current_dataset}/{total_datasets}: {dataset['url']}")
                
                for file_info in dataset['files']:
                    filename = file_info['name']
                    description = file_info.get('description', '')
                    
                    logger.info(f"📄 {description}")
                    
                    # Téléchargement direct si URL fournie
                    if 'direct_url' in file_info:
                        self.download_file(file_info['direct_url'], filename)
                        
                    # Téléchargement via API CKAN
                    elif 'api_url' in file_info:
                        urls = self.get_ckan_download_urls(file_info['api_url'])
                        if urls:
                            for url, suggested_name in urls:
                                actual_filename = f"{source_key}_{suggested_name}" if suggested_name != 'data.csv' else filename
                                self.download_file(url, actual_filename)
                        else:
                            logger.warning(f"⚠️  Aucune URL CSV trouvée pour {filename}")
                    
                    time.sleep(1)  # Respecter les serveurs

    def generate_summary_report(self):
        """Génère un rapport de synthèse"""
        report = {
            'timestamp': datetime.now().isoformat(),
            'total_downloaded': len(self.downloaded_files),
            'total_failed': len(self.failed_downloads),
            'total_size_mb': sum(f['size_mb'] for f in self.downloaded_files),
            'downloaded_files': self.downloaded_files,
            'failed_downloads': self.failed_downloads
        }
        
        # Sauvegarder le rapport JSON
        report_file = DATA_DIR / 'download_report.json'
        with open(report_file, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        
        # Afficher le résumé
        logger.info(f"\n📊 RAPPORT DE SYNTHÈSE")
        logger.info(f"✅ Fichiers téléchargés: {report['total_downloaded']}")
        logger.info(f"❌ Échecs: {report['total_failed']}")
        logger.info(f"📦 Taille totale: {report['total_size_mb']:.1f} MB")
        logger.info(f"📁 Répertoire: {DATA_DIR}")
        logger.info(f"📄 Rapport détaillé: {report_file}")
        
        if self.failed_downloads:
            logger.warning(f"\n⚠️  ÉCHECS DÉTAILLÉS:")
            for failed in self.failed_downloads:
                logger.warning(f"  • {failed['filename']}: {failed['error']}")

def main():
    """Fonction principale"""
    downloader = RealEstateDataDownloader()
    
    try:
        downloader.download_all_datasets()
        downloader.generate_summary_report()
        
        logger.info(f"\n🎉 Téléchargement terminé !")
        logger.info(f"📁 Vérifiez le répertoire: {DATA_DIR}")
        
    except KeyboardInterrupt:
        logger.info("\n⏹️  Téléchargement interrompu par l'utilisateur")
    except Exception as e:
        logger.error(f"\n💥 Erreur fatale: {e}")
        raise

if __name__ == "__main__":
    main()
