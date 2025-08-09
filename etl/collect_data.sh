#!/bin/bash
# Script d'aide pour la collecte de données InvestMTL
# Usage: ./collect_data.sh [test|run|help]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ETL_DIR="$SCRIPT_DIR"

echo "🎯 InvestMTL - Collecte de données"
echo "================================="

case "${1:-help}" in
    "test")
        echo "🧪 Exécution des tests..."
        cd "$ETL_DIR"
        python test_collect.py
        ;;
    
    "run")
        echo "🚀 Lancement de la collecte complète..."
        cd "$ETL_DIR"
        
        # Vérifier les dépendances
        echo "📋 Vérification des dépendances..."
        python -c "import requests, pandas, geopandas; print('✅ Dépendances OK')" || {
            echo "❌ Dépendances manquantes. Installez-les avec:"
            echo "   pip install -r requirements.txt"
            exit 1
        }
        
        # Lancer la collecte
        echo "📊 Collecte des données..."
        python collect_areas_demography.py
        
        # Vérifier les résultats
        if [ -f "../data/curated/areas.geojson" ] && [ -f "../data/curated/demography.parquet" ]; then
            echo ""
            echo "✅ Collecte terminée avec succès!"
            echo "📁 Fichiers générés:"
            ls -lh ../data/curated/areas.geojson ../data/curated/demography.parquet
        else
            echo "❌ Erreur: fichiers de sortie manquants"
            exit 1
        fi
        ;;
    
    "help"|*)
        echo "Usage: $0 [test|run|help]"
        echo ""
        echo "Commandes:"
        echo "  test    - Exécuter les tests de validation"
        echo "  run     - Lancer la collecte complète de données"
        echo "  help    - Afficher cette aide"
        echo ""
        echo "Sources de données:"
        echo "  • Aires de diffusion 2021 (Statistique Canada)"
        echo "  • Profil du recensement 2021 (Statistique Canada)"
        echo "  • Filtrage automatique pour Montréal"
        echo ""
        echo "Sorties:"
        echo "  • data/curated/areas.geojson"
        echo "  • data/curated/demography.parquet"
        ;;
esac
