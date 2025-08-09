import os, io, json, time, hashlib, zipfile
from pathlib import Path
import requests, pandas as pd, geopandas as gpd
import duckdb, yaml

DATA = Path("data")
RAW, CUR = DATA/"raw", DATA/"curated"
RAW.mkdir(parents=True, exist_ok=True); CUR.mkdir(parents=True, exist_ok=True)

def dl(url, dest, method="get", body=None):
    dest = Path(dest); dest.parent.mkdir(parents=True, exist_ok=True)
    if method.lower() == "post":
        data = body.encode("utf-8") if isinstance(body, str) else body
        r = requests.post(url, data=data)
    else:
        r = requests.get(url, stream=True)
    r.raise_for_status()
    with open(dest, "wb") as f: f.write(r.content)
    return dest

def load_yaml(path="etl/sources.yaml"):
    with open(path, "r") as f: return yaml.safe_load(f)

def collect():
    cfg = load_yaml()
    # Areas
    for src in cfg.get("areas", []):
        print("Areas:", src["id"])
        dest = dl(src["url"], src["dest"])
        gdf = gpd.read_file(dest)
        # garder Montréal seulement si besoin
        gdf = gdf.rename(columns={c: c.lower() for c in gdf.columns})
        gdf.to_file(CUR/"areas.geojson", driver="GeoJSON")

    # Démographie
    for src in cfg.get("demography", []):
        print("Demography:", src["id"])
        dest = dl(src["url"], src["dest"])
        df = pd.read_csv(dest)
        df.columns = [c.lower() for c in df.columns]
        df.to_parquet(CUR/"demography.parquet", index=False)

    # Loyers/Vacance CMHC
    for src in cfg.get("rent_vacancy", []):
        print("Rent/Vacancy:", src["id"])
        dest = dl(src["url"], src["dest"])
        df = pd.read_csv(dest)
        df.columns = [c.lower() for c in df.columns]
        df["date"] = pd.to_datetime(df["date"])
        df.to_parquet(CUR/"rent_vacancy.parquet", index=False)

    # Mises en chantier
    for src in cfg.get("starts", []):
        print("Starts:", src["id"])
        dest = dl(src["url"], src["dest"])
        df = pd.read_csv(dest)
        df.columns = [c.lower() for c in df.columns]
        df["date"] = pd.to_datetime(df["date"])
        df.to_parquet(CUR/"starts.parquet", index=False)

    # Permis (Ville de MTL)
    for src in cfg.get("permits", []):
        print("Permits:", src["id"])
        dest = dl(src["url"], src["dest"])
        gdf = gpd.read_file(dest).to_crs(4326)
        gdf.columns = [c.lower() for c in gdf.columns]
        # normaliser nb_units si absent
        if "nb_units" not in gdf.columns:
            gdf["nb_units"] = gdf.get("unites", 1)
        date_series = (
            gdf["date"] if "date" in gdf.columns else
            gdf["date_debut"] if "date_debut" in gdf.columns else
            gdf["datefin"] if "datefin" in gdf.columns else
            pd.Series([None] * len(gdf))
        )
        gdf["date"] = pd.to_datetime(date_series, errors="coerce")
        gdf = gdf.dropna(subset=["geometry"])
        gdf.to_file(CUR/"permits.geojson", driver="GeoJSON")

    # POI OSM
    for src in cfg.get("poi", []):
        print("OSM POI:", src["id"])
        dest = dl(src["url"], src["dest"], method=src.get("method","get"), body=src.get("body"))
        js = json.load(open(dest))
        # convertir en DF simple (lon,lat,type)
        elements = js.get("elements", [])
        rows=[]
        for e in elements:
            if "lon" in e and "lat" in e:
                tag = (e.get("tags") or {}).get("amenity") or (e.get("tags") or {}).get("shop") or (e.get("tags") or {}).get("leisure")
                rows.append({"lon": e["lon"], "lat": e["lat"], "kind": tag})
        pd.DataFrame(rows).to_parquet(CUR/"poi.parquet", index=False)

if __name__ == "__main__":
    collect()
    print("✅ Collecte terminée")