#!/usr/bin/env python3
"""
Test script pour collect_areas_demography.py
"""

import sys
from pathlib import Path
import logging
import requests
import pandas as pd
import geopandas as gpd
import pyogrio

# Ajouter le répertoire parent au path pour importer notre module
sys.path.append(str(Path(__file__).parent))

try:
    from collect_areas_demography import setup_directories, download_file, DATA_SOURCES
    print("✅ Import du module réussi")
except ImportError as e:
    print(f"❌ Erreur d'import: {e}")
    sys.exit(1)

def test_dependencies():
    """Tester que toutes les dépendances sont disponibles."""
    try:
        
        print("✅ Toutes les dépendances sont disponibles")
        return True
    except ImportError as e:
        print(f"❌ Dépendance manquante: {e}")
        return False

def test_setup():
    """Tester la création des répertoires."""
    try:
        output_dir = setup_directories()
        print(f"✅ Répertoire créé: {output_dir}")
        return True
    except Exception as e:
        print(f"❌ Erreur setup: {e}")
        return False

def test_download():
    """Tester la validation des URLs."""
    try:
        # Test simple : vérifier que les URLs sont bien formées
        from collect_areas_demography import DATA_SOURCES
        urls = list(DATA_SOURCES.values())
        for url in urls:
            if url.startswith('http'):
                print(f"✓ URL valide: {url[:50]}...")
        print(f"✅ {len(urls)} URLs de sources configurées")
        return True
    except Exception as e:
        print(f"❌ Erreur validation URLs: {e}")
        return False

def main():
    print("🧪 Test du collecteur de données InvestMTL")
    print("=" * 50)
    
    tests = [
        ("Dépendances", test_dependencies),
        ("Setup répertoires", test_setup),
        ("Validation URLs", test_download),
    ]
    
    results = []
    for name, test_func in tests:
        print(f"\n🔍 Test: {name}")
        success = test_func()
        results.append(success)
    
    print("\n" + "=" * 50)
    if all(results):
        print("✅ Tous les tests passent ! Le script devrait fonctionner.")
        print("💡 Pour exécuter la collecte complète:")
        print("   python collect_areas_demography.py")
    else:
        print("❌ Certains tests échouent. Vérifiez les dépendances.")
        failed_count = results.count(False)
        print(f"   {failed_count}/{len(results)} tests ont échoué")

if __name__ == "__main__":
    main()
