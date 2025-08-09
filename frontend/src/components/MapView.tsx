import React, { useEffect, useRef, useState } from 'react'
import Map, { Source, Layer, Popup } from 'react-map-gl/maplibre'
import type { MapRef } from 'react-map-gl/maplibre'
import { api, AreasResponse, AreaData, ScoringWeights } from '../lib/api'
import { getQuantileColor } from '../lib/api'

// Montreal bounds
const MONTREAL_BOUNDS: [number, number, number, number] = [-74.2, 45.3, -73.0, 45.8]

interface MapViewProps {
  onAreaSelect: (areaId: string) => void
  selectedAreaId: string | null
  scoringWeights: ScoringWeights
}

const MapView: React.FC<MapViewProps> = ({ 
  onAreaSelect, 
  selectedAreaId,
  scoringWeights 
}) => {
  const mapRef = useRef<MapRef>(null)
  const [areasData, setAreasData] = useState<AreasResponse | null>(null)
  const [hoveredArea, setHoveredArea] = useState<AreaData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Map state
  const [viewState, setViewState] = useState({
    longitude: -73.5673,
    latitude: 45.5017,
    zoom: 10,
  })

  // Load areas data
  useEffect(() => {
    const loadAreas = async () => {
      try {
        setIsLoading(true)
        setError(null)
        
        const data = await api.getAreas({ 
          geometry: true, 
          limit: 100 
        })
        
        setAreasData(data)
      } catch (err) {
        console.error('Failed to load areas:', err)
        setError('Failed to load areas data')
      } finally {
        setIsLoading(false)
      }
    }

    loadAreas()
  }, [])

  // Handle map click
  const handleMapClick = (event: any) => {
    const features = event.features
    if (features && features.length > 0) {
      const feature = features[0]
      if (feature.source === 'areas' && feature.properties?.id) {
        onAreaSelect(feature.properties.id)
      }
    }
  }

  // Handle map hover
  const handleMapHover = (event: any) => {
    const features = event.features
    if (features && features.length > 0) {
      const feature = features[0]
      if (feature.source === 'areas' && feature.properties) {
        setHoveredArea({
          id: feature.properties.id,
          name: feature.properties.name,
          score: feature.properties.score,
          quantile: feature.properties.quantile,
          last_updated: feature.properties.last_updated || ''
        })
      }
    } else {
      setHoveredArea(null)
    }
  }

  // Create GeoJSON source data with dynamic colors
  const geoJsonData = React.useMemo(() => {
    if (!areasData) return null

    return {
      type: 'FeatureCollection' as const,
      features: areasData.features.map(feature => ({
        ...feature,
        properties: {
          ...feature.properties,
          color: getQuantileColor(feature.properties.quantile || 1),
          isSelected: selectedAreaId === feature.properties.id
        }
      }))
    }
  }, [areasData, selectedAreaId])

  // Layer styling
  const areasFillLayer = {
    id: 'areas-fill',
    type: 'fill' as const,
    paint: {
      'fill-color': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        '#ffffff',
        ['get', 'color']
      ],
      'fill-opacity': [
        'case',
        ['get', 'isSelected'],
        0.9,
        ['boolean', ['feature-state', 'hover'], false],
        0.8,
        0.6
      ] as any // Type assertion to satisfy LayerProps typing
    }
  }

  const areasStrokeLayer = {
    id: 'areas-stroke',
    type: 'line' as const,
    paint: {
      'line-color': [
        'case',
        ['boolean', ['get', 'isSelected'], false],
        '#000000',
        ['boolean', ['feature-state', 'hover'], false],
        '#333333',
        '#666666'
      ],
      'line-width': [
        'case',
        ['boolean', ['get', 'isSelected'], false],
        3,
        ['boolean', ['feature-state', 'hover'], false],
        2,
        1
      ]
    }
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="text-center">
          <div className="text-red-600 text-lg font-semibold mb-2">
            Error Loading Map
          </div>
          <div className="text-gray-600 dark:text-gray-400">
            {error}
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 relative">
      {isLoading && (
        <div className="absolute top-4 right-4 z-10 bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg">
          <div className="flex items-center gap-2">
            <div className="spinner"></div>
            <span className="text-sm text-gray-600 dark:text-gray-300">
              Loading areas...
            </span>
          </div>
        </div>
      )}

      <Map
        ref={mapRef}
        {...viewState}
        onMove={evt => setViewState(evt.viewState)}
        style={{ width: '100%', height: '100%' }}
        mapStyle="https://demotiles.maplibre.org/style.json"
        onClick={handleMapClick}
        onMouseMove={handleMapHover}
        interactiveLayerIds={['areas-fill']}
        maxBounds={MONTREAL_BOUNDS}
        maxZoom={16}
        minZoom={9}
      >
        {geoJsonData && (
          <Source 
            id="areas" 
            type="geojson" 
            data={geoJsonData}
          >
            <Layer {...areasFillLayer} />
            <Layer {...areasStrokeLayer} />
          </Source>
        )}

        {/* Hover popup */}
        {hoveredArea && (
          <Popup
            longitude={0} // Will be set by MapLibre automatically
            latitude={0}
            closeButton={false}
            closeOnClick={false}
            className="map-popup"
          >
            <div className="p-2 min-w-[200px]">
              <div className="font-semibold text-gray-900 dark:text-white">
                {hoveredArea.name}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: getQuantileColor(hoveredArea.quantile) }}
                />
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  Score: {hoveredArea.score.toFixed(1)}
                </span>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Click to view details
              </div>
            </div>
          </Popup>
        )}
      </Map>
    </div>
  )
}

export default MapView
