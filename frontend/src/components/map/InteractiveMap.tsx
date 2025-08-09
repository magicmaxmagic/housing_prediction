import { useRef, useEffect, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

interface Zone {
  zone_id: string;
  street_name: string;
  investment_score: number;
  property_count: number;
  total_units: number;
  geometry?: {
    type: 'Polygon';
    coordinates: number[][][];
  };
}

interface InteractiveMapProps {
  zones: Zone[];
  selectedZone?: Zone | null;
  onZoneSelect: (zone: Zone) => void;
  filters?: {
    minScore?: number;
    maxScore?: number;
    minUnits?: number;
  };
}

const InteractiveMap: React.FC<InteractiveMapProps> = ({
  zones,
  selectedZone,
  onZoneSelect,
  filters
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Montreal center coordinates
  const MONTREAL_CENTER: [number, number] = [-73.5673, 45.5017];

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    // Initialize map
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'osm': {
            type: 'raster',
            tiles: [
              'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
              'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
              'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'
            ],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors'
          }
        },
        layers: [
          {
            id: 'osm',
            type: 'raster',
            source: 'osm'
          }
        ]
      },
      center: MONTREAL_CENTER,
      zoom: 11,
      maxZoom: 16,
      minZoom: 8
    });

    map.current.on('load', () => {
      setMapLoaded(true);
    });

    // Add navigation controls
    map.current.addControl(new maplibregl.NavigationControl(), 'top-right');

    // Cleanup
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Update zones on map
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const filteredZones = zones.filter(zone => {
      if (filters?.minScore && zone.investment_score < filters.minScore) return false;
      if (filters?.maxScore && zone.investment_score > filters.maxScore) return false;
      if (filters?.minUnits && zone.total_units < filters.minUnits) return false;
      return true;
    });

    // Create GeoJSON for zones
    const geojsonData = {
      type: 'FeatureCollection' as const,
      features: filteredZones
        .filter(zone => zone.geometry)
        .map(zone => ({
          type: 'Feature' as const,
          properties: {
            zone_id: zone.zone_id,
            street_name: zone.street_name,
            investment_score: zone.investment_score,
            property_count: zone.property_count,
            total_units: zone.total_units,
          },
          geometry: zone.geometry!
        }))
    };

    // Remove existing layers and source
    if (map.current.getLayer('zones-fill')) {
      map.current.removeLayer('zones-fill');
    }
    if (map.current.getLayer('zones-stroke')) {
      map.current.removeLayer('zones-stroke');
    }
    if (map.current.getLayer('zones-selected')) {
      map.current.removeLayer('zones-selected');
    }
    if (map.current.getSource('zones')) {
      map.current.removeSource('zones');
    }

    // Add zones source
    map.current.addSource('zones', {
      type: 'geojson',
      data: geojsonData
    });

    // Add zones fill layer with color based on investment score
    map.current.addLayer({
      id: 'zones-fill',
      type: 'fill',
      source: 'zones',
      paint: {
        'fill-color': [
          'interpolate',
          ['linear'],
          ['get', 'investment_score'],
          0, '#fee5d9',
          1000, '#fcae91',
          2000, '#fb6a4a',
          3000, '#de2d26',
          4000, '#a50f15'
        ],
        'fill-opacity': 0.7
      }
    });

    // Add zones stroke layer
    map.current.addLayer({
      id: 'zones-stroke',
      type: 'line',
      source: 'zones',
      paint: {
        'line-color': '#ffffff',
        'line-width': 1,
        'line-opacity': 0.8
      }
    });

    // Add selected zone highlighting
    if (selectedZone) {
      const selectedGeoJSON = {
        type: 'FeatureCollection' as const,
        features: selectedZone.geometry ? [{
          type: 'Feature' as const,
          properties: {},
          geometry: selectedZone.geometry
        }] : []
      };

      if (map.current.getSource('selected-zone')) {
        (map.current.getSource('selected-zone') as maplibregl.GeoJSONSource)
          .setData(selectedGeoJSON);
      } else {
        map.current.addSource('selected-zone', {
          type: 'geojson',
          data: selectedGeoJSON
        });

        map.current.addLayer({
          id: 'zones-selected',
          type: 'line',
          source: 'selected-zone',
          paint: {
            'line-color': '#2563eb',
            'line-width': 3,
            'line-opacity': 1
          }
        });
      }
    }

    // Add click handlers
    const handleZoneClick = (e: maplibregl.MapLayerMouseEvent) => {
      if (e.features && e.features.length > 0) {
        const feature = e.features[0];
        const zone = filteredZones.find(z => z.zone_id === feature.properties?.zone_id);
        if (zone) {
          onZoneSelect(zone);
        }
      }
    };

    // Add cursor pointer on hover
    const handleMouseEnter = () => {
      if (map.current) {
        map.current.getCanvas().style.cursor = 'pointer';
      }
    };

    const handleMouseLeave = () => {
      if (map.current) {
        map.current.getCanvas().style.cursor = '';
      }
    };

    map.current.on('click', 'zones-fill', handleZoneClick);
    map.current.on('mouseenter', 'zones-fill', handleMouseEnter);
    map.current.on('mouseleave', 'zones-fill', handleMouseLeave);

    // Create popup for hover
    const popup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false
    });

    const handleMouseMove = (e: maplibregl.MapLayerMouseEvent) => {
      if (e.features && e.features.length > 0) {
        const feature = e.features[0];
        const props = feature.properties;
        
        popup.setLngLat(e.lngLat).setHTML(`
          <div class="p-2">
            <h3 class="font-semibold text-sm">${props?.street_name}</h3>
            <p class="text-xs text-gray-600">Score: ${props?.investment_score?.toFixed(1)}</p>
            <p class="text-xs text-gray-600">Propriétés: ${props?.property_count}</p>
            <p class="text-xs text-gray-600">Unités: ${props?.total_units}</p>
          </div>
        `).addTo(map.current!);
      }
    };

    const handleMouseLeavePopup = () => {
      popup.remove();
    };

    map.current.on('mousemove', 'zones-fill', handleMouseMove);
    map.current.on('mouseleave', 'zones-fill', handleMouseLeavePopup);

    // Cleanup event listeners
    return () => {
      if (map.current) {
        map.current.off('click', 'zones-fill', handleZoneClick);
        map.current.off('mouseenter', 'zones-fill', handleMouseEnter);
        map.current.off('mouseleave', 'zones-fill', handleMouseLeave);
        map.current.off('mousemove', 'zones-fill', handleMouseMove);
        map.current.off('mouseleave', 'zones-fill', handleMouseLeavePopup);
      }
    };
  }, [zones, filters, selectedZone, mapLoaded, onZoneSelect]);

  // Fit map to selected zone
  useEffect(() => {
    if (!map.current || !selectedZone?.geometry) return;

    // Calculate bounds from geometry
    const coordinates = selectedZone.geometry.coordinates[0];
    const bounds = new maplibregl.LngLatBounds();
    
    coordinates.forEach(coord => {
      bounds.extend([coord[0], coord[1]]);
    });

    map.current.fitBounds(bounds, { padding: 50 });
  }, [selectedZone]);

  return (
    <div className="relative h-full w-full">
      <div ref={mapContainer} className="h-full w-full" />
      
      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-white p-3 rounded-lg shadow-lg">
        <h4 className="text-sm font-semibold mb-2">Score d'investissement</h4>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-4 h-3 bg-[#a50f15] rounded"></div>
            <span className="text-xs">4000+ (Excellent)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-3 bg-[#de2d26] rounded"></div>
            <span className="text-xs">3000-4000 (Très bon)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-3 bg-[#fb6a4a] rounded"></div>
            <span className="text-xs">2000-3000 (Bon)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-3 bg-[#fcae91] rounded"></div>
            <span className="text-xs">1000-2000 (Moyen)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-3 bg-[#fee5d9] rounded"></div>
            <span className="text-xs">0-1000 (Faible)</span>
          </div>
        </div>
      </div>

      {/* Zone info panel */}
      {selectedZone && (
        <div className="absolute top-4 right-4 bg-white p-4 rounded-lg shadow-lg min-w-64">
          <h3 className="font-semibold text-lg mb-2">{selectedZone.street_name}</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Score d'investissement:</span>
              <span className="text-sm font-semibold">{selectedZone.investment_score.toFixed(1)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Propriétés:</span>
              <span className="text-sm">{selectedZone.property_count}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Unités totales:</span>
              <span className="text-sm">{selectedZone.total_units}</span>
            </div>
          </div>
          <button
            onClick={() => onZoneSelect(null as any)}
            className="mt-3 text-xs text-gray-500 hover:text-gray-700"
          >
            Fermer
          </button>
        </div>
      )}
    </div>
  );
};

export default InteractiveMap;
