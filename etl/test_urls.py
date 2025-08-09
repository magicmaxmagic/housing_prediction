#!/usr/bin/env python3
"""
URLs de remplacement pour les sources cassées
"""

# URLs corrigées pour les sources qui ne fonctionnent pas

# 1. StatCan - Aires de diffusion 2021 
# URL alternative trouvée sur le site officiel
STATCAN_DA_2021_ALT = "https://www12.statcan.gc.ca/census-recensement/2021/geo/sip-pis/boundary-limites/files/lda_000b21a_e.zip"

# 2. Montréal - Permis de construction
# URL directe du dataset CKAN
MONTREAL_PERMITS_ALT = "https://donnees.montreal.ca/dataset/f52e154f-9d8c-4ea5-bf26-a27db4e3ed05/resource/f52e154f-9d8c-4ea5-bf26-a27db4e3ed05/download/permis.csv"

# 3. Montréal - Dataset GeoJSON si disponible
MONTREAL_PERMITS_GEOJSON = "https://donnees.montreal.ca/dataset/permis-construction/resource/f52e154f-9d8c-4ea5-bf26-a27db4e3ed05"

print("🔧 URLs de remplacement disponibles:")
print(f"StatCan DA: {STATCAN_DA_2021_ALT}")
print(f"Permis MTL: {MONTREAL_PERMITS_ALT}")

# Test rapide des URLs
import requests

def test_url(url, name):
    try:
        response = requests.head(url, timeout=10)
        if response.status_code == 200:
            print(f"✅ {name}: OK ({response.headers.get('content-length', 'N/A')} bytes)")
        else:
            print(f"❌ {name}: {response.status_code}")
    except Exception as e:
        print(f"❌ {name}: {e}")

if __name__ == "__main__":
    test_url(STATCAN_DA_2021_ALT, "StatCan (EN)")
    test_url(MONTREAL_PERMITS_ALT, "Permis MTL CSV")
