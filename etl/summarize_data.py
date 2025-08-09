#!/usr/bin/env python3
"""
Résumé des données collectées pour InvestMTL
"""

from pathlib import Path
import pandas as pd
import json

def summarize_data():
    """Analyse et résume les données collectées."""
    data_dir = Path(__file__).parent.parent / "data"
    curated_dir = data_dir / "curated"
    
    print("📊 === RÉSUMÉ DES DONNÉES INVESTMTL ===")
    print("=" * 50)
    
    # Points d'intérêt (POI)
    poi_file = curated_dir / "poi.parquet"
    if poi_file.exists():
        df_poi = pd.read_parquet(poi_file)
        print(f"📍 Points d'intérêt (POI): {len(df_poi):,} points")
        print("   Types d'équipements:")
        for kind, count in df_poi['kind'].value_counts().head(10).items():
            print(f"     • {kind}: {count:,}")
        
        # Analyse géographique
        print(f"   Zone couverte:")
        print(f"     • Longitude: {df_poi['lon'].min():.3f} à {df_poi['lon'].max():.3f}")
        print(f"     • Latitude: {df_poi['lat'].min():.3f} à {df_poi['lat'].max():.3f}")
        print()
    
    # Aires géographiques
    areas_file = curated_dir / "areas.geojson"
    if areas_file.exists():
        print("🗺️  Aires géographiques: ✅ Disponibles")
        # Note: Analyse GeoJSON nécessiterait geopandas
    else:
        print("🗺️  Aires géographiques: ❌ Non disponibles")
        print("     • Problème avec l'URL StatCan (page HTML au lieu de ZIP)")
    
    # Permis de construction
    permits_file = curated_dir / "permits.geojson"
    permits_parquet = curated_dir / "permits.parquet"
    if permits_file.exists() or permits_parquet.exists():
        print("🏢 Permis de construction: ✅ Disponibles")
    else:
        print("🏢 Permis de construction: ❌ Non disponibles")
        print("     • Problème avec l'API de Montréal (404)")
    
    # Données démographiques
    demo_file = curated_dir / "demography.parquet" 
    if demo_file.exists():
        print("👥 Démographie: ✅ Disponibles")
    else:
        print("👥 Démographie: ❌ Non disponibles")
    
    # Taille totale des données
    total_size = 0
    file_count = 0
    for file_path in curated_dir.glob("*"):
        if file_path.is_file():
            size = file_path.stat().st_size
            total_size += size
            file_count += 1
    
    print(f"\n📦 Résumé stockage:")
    print(f"   • {file_count} fichiers générés")
    print(f"   • Taille totale: {total_size / (1024*1024):.1f} MB")
    
    print("\n💡 Actions recommandées:")
    if not areas_file.exists():
        print("   1. Corriger l'URL StatCan pour les aires de diffusion")
    if not (permits_file.exists() or permits_parquet.exists()):
        print("   2. Corriger l'URL de l'API Montréal pour les permis")
    if file_count > 0:
        print("   3. ✅ Intégrer les POI dans l'application frontend")
    
    print("=" * 50)

if __name__ == "__main__":
    summarize_data()
