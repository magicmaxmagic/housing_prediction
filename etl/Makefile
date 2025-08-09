.PHONY: setup ingest features forecast score export all clean

# Configuration
PYTHON := python3
DATA_DIR := data
RAW_DIR := $(DATA_DIR)/raw
PROCESSED_DIR := $(DATA_DIR)/processed
CURATED_DIR := $(DATA_DIR)/curated

setup: $(DATA_DIR)
	$(PYTHON) -m pip install -r requirements.txt
	mkdir -p $(RAW_DIR) $(PROCESSED_DIR) $(CURATED_DIR)
	@echo "Setup completed"

$(DATA_DIR):
	mkdir -p $(DATA_DIR)

ingest: setup
	@echo "Ingesting Montreal data..."
	$(PYTHON) ingest_mtl.py
	@echo "Ingesting StatCan data..."
	$(PYTHON) ingest_statcan.py
	@echo "Ingesting CMHC data..."
	$(PYTHON) ingest_cmhc.py
	@echo "Data ingestion completed"

features: ingest
	@echo "Generating features..."
	$(PYTHON) features.py
	@echo "Features generation completed"

forecast: features
	@echo "Generating forecasts..."
	$(PYTHON) forecast.py
	@echo "Forecasts generation completed"

score: forecast
	@echo "Computing scores..."
	$(PYTHON) score.py
	@echo "Scores computation completed"

export: score
	@echo "Exporting artifacts..."
	$(PYTHON) export_artifacts.py
	@echo "Artifacts export completed"

all: ingest features forecast score export
	@echo "Full ETL pipeline completed"

clean:
	rm -rf $(DATA_DIR)
	@echo "Data directory cleaned"

test:
	$(PYTHON) -m pytest tests/ -v

lint:
	$(PYTHON) -m flake8 *.py --max-line-length=100
	$(PYTHON) -m black *.py --check
