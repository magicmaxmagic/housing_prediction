import React, { useEffect, useState } from 'react';
import { MapPin, Layers, ZoomIn, ZoomOut, Home } from 'lucide-react';

const InteractiveMap: React.FC = () => {
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [mapLayer, setMapLayer] = useState<'investment' | 'prices' | 'rent'>('investment');
  const [zones, setZones] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // const { addFavorite, isFavorite, getFavoriteId, removeFavorite } = useFavorites();

  useEffect(() => {
    const loadZones = async () => {
      setLoading(true); setError(null);
      try {
        const res = await fetch('/api/investment-zones?limit=50');
        const data = await res.json();
        const mapped = (data?.data || data || []).map((z: any, idx: number) => ({
          id: z.street_name || z.zone_id || `Z-${idx}`,
          name: z.street_name || z.zone_id || 'Unknown',
          score: Math.round(parseFloat(z.investment_score || z.score || 0)),
          avgPrice: z.avg_price ? `$${Math.round(z.avg_price/1000)}K` : '-',
          avgRent: z.avg_monthly_rent ? `$${Math.round(z.avg_monthly_rent)}` : '-',
        }));
        setZones(mapped);
      } catch (e) {
        setError('Failed to load zones');
      } finally { setLoading(false); }
    };
    loadZones();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Interactive Map</h1>
          <p className="text-gray-600">Explore Montreal investment zones</p>
        </div>
        
        <div className="flex space-x-2">
          <select
            value={mapLayer}
            onChange={(e) => setMapLayer(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="investment">Investment Scores</option>
            <option value="prices">Property Prices</option>
            <option value="rent">Rental Prices</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Map Area */}
        <div className="lg:col-span-3 bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="aspect-w-16 aspect-h-10">
            <div className="h-96 lg:h-[600px] bg-gradient-to-br from-blue-100 to-green-100 relative flex items-center justify-center">
              {/* Mock Map Placeholder */}
              <div className="text-center">
                <MapPin className="h-16 w-16 text-blue-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-700 mb-2">Interactive Map Coming Soon</h3>
                <p className="text-gray-600">MapLibre GL integration will be implemented here</p>
              </div>

              {/* Map Controls */}
              <div className="absolute top-4 right-4 flex flex-col space-y-2">
                <button className="p-2 bg-white shadow-md rounded-md hover:bg-gray-50">
                  <ZoomIn className="h-4 w-4" />
                </button>
                <button className="p-2 bg-white shadow-md rounded-md hover:bg-gray-50">
                  <ZoomOut className="h-4 w-4" />
                </button>
                <button className="p-2 bg-white shadow-md rounded-md hover:bg-gray-50">
                  <Layers className="h-4 w-4" />
                </button>
              </div>

              {/* Legend */}
              <div className="absolute bottom-4 left-4 bg-white p-3 rounded-lg shadow-md">
                <h4 className="text-sm font-semibold mb-2">Investment Score</h4>
                <div className="space-y-1">
                  <div className="flex items-center">
                    <div className="w-4 h-4 bg-green-500 rounded mr-2"></div>
                    <span className="text-xs">90-100 (Excellent)</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-4 h-4 bg-blue-500 rounded mr-2"></div>
                    <span className="text-xs">80-89 (Good)</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-4 h-4 bg-yellow-500 rounded mr-2"></div>
                    <span className="text-xs">70-79 (Average)</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-4 h-4 bg-red-500 rounded mr-2"></div>
                    <span className="text-xs">60-69 (Poor)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Zone Details Panel */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Zone Details</h3>
          
          {loading && (
            <p className="text-gray-600">Loading zones...</p>
          )}

          {error && (
            <p className="text-red-600">{error}</p>
          )}

          {selectedZone ? (
            <div className="space-y-4">
              <div className="p-3 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-900">Selected Zone</h4>
                <p className="text-blue-700">{selectedZone}</p>
              </div>
            </div>
          ) : (
            <p className="text-gray-600">Click on a zone in the map to view details</p>
          )}

          <div className="mt-6">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Available Zones</h4>
            <div className="space-y-2">
      {zones.map((zone) => (
                <button
                  key={zone.id}
                  onClick={() => setSelectedZone(zone.name)}
                  className={`w-full text-left p-3 rounded-lg border hover:bg-gray-50 ${
                    selectedZone === zone.name ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-gray-900">{zone.name}</p>
                      <p className="text-xs text-gray-600">{zone.id}</p>
                    </div>
        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      zone.score >= 90 ? 'bg-green-100 text-green-800' :
                      zone.score >= 80 ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {zone.score}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-gray-600">
                    <div className="flex justify-between">
                      <span>Avg Price: {zone.avgPrice}</span>
                      <span>Avg Rent: {zone.avgRent}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Zone Statistics */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Zone Statistics</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <Home className="h-8 w-8 text-blue-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900">156</p>
            <p className="text-sm text-gray-600">Total Zones</p>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <MapPin className="h-8 w-8 text-green-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900">87.5</p>
            <p className="text-sm text-gray-600">Average Score</p>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <Layers className="h-8 w-8 text-purple-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900">25,847</p>
            <p className="text-sm text-gray-600">Properties</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InteractiveMap;
