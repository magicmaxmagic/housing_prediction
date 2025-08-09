#!/usr/bin/env python3
"""
Test rapide pour collect_data_improved.py
"""

import sys
from pathlib import Path

# Ajouter le répertoire parent au path
sys.path.append(str(Path(__file__).parent))

def test_imports():
    """Test des imports et de la configuration."""
    try:
        from collect_data_improved import DATA_SOURCES, CURATED_DIR, logger
        print("✅ Import réussi")
        print(f"✅ Répertoire de sortie: {CURATED_DIR}")
        print(f"✅ {len(DATA_SOURCES)} types de sources configurés:")
        for key, sources in DATA_SOURCES.items():
            print(f"   • {key}: {len(sources)} sources")
        return True
    except Exception as e:
        print(f"❌ Erreur import: {e}")
        return False

def test_dependencies():
    """Test des dépendances."""
    try:
        import requests
        import pandas as pd
        import geopandas as gpd
        print("✅ Dépendances principales OK")
        return True
    except ImportError as e:
        print(f"❌ Dépendance manquante: {e}")
        return False

def main():
    print("🧪 Test collect_data_improved.py")
    print("=" * 40)
    
    tests = [
        ("Imports et config", test_imports),
        ("Dépendances", test_dependencies),
    ]
    
    results = []
    for name, test_func in tests:
        print(f"\n🔍 Test: {name}")
        success = test_func()
        results.append(success)
    
    print("\n" + "=" * 40)
    if all(results):
        print("✅ Tous les tests passent!")
        print("💡 Pour lancer la collecte complète:")
        print("   python collect_data_improved.py")
    else:
        failed = results.count(False)
        print(f"❌ {failed}/{len(results)} tests échoués")

if __name__ == "__main__":
    main()
