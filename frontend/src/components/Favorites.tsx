import React, { useEffect, useState } from 'react';
import { Heart, Star, MapPin, DollarSign, TrendingUp, Trash2, Share2, Eye } from 'lucide-react';
import { useFavorites } from '@/hooks/useFavorites'

interface FavoriteProperty {
  id: string;
  address: string;
  neighborhood: string;
  price: number;
  estimatedRent: number;
  score: number;
  type: string;
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  dateAdded: string;
  notes?: string;
}

export const Favorites: React.FC = () => {
  const { favorites: serverFavorites, isLoading, error, removeFavorite } = useFavorites();
  const [favorites, setFavorites] = useState<FavoriteProperty[]>([]);

  useEffect(() => {
    // Map API favorites to UI model
    const mapped = (serverFavorites || []).map((f: any) => ({
      id: String(f.id),
      address: f.street_name || f.zone_id,
      neighborhood: f.zone_id,
      price: f.predicted_price_per_m2 ? f.predicted_price_per_m2 * 60 : 600000,
      estimatedRent: f.predicted_rent || 2000,
      score: f.investment_score || 7.5,
      type: 'Condo',
      bedrooms: 2,
      bathrooms: 1,
      sqft: 900,
      dateAdded: f.created_at || new Date().toISOString(),
      notes: ''
    }));
    setFavorites(mapped);
  }, [serverFavorites]);

  const [sortBy, setSortBy] = useState<'dateAdded' | 'price' | 'score'>('dateAdded');
  const [filterBy, setFilterBy] = useState<'all' | 'condo' | 'apartment' | 'house'>('all');

  const handleRemoveFavorite = async (id: string) => {
    const numericId = parseInt(id, 10);
    if (Number.isNaN(numericId)) {
      setFavorites(favorites.filter(fav => fav.id !== id));
      return;
    }
    const res = await removeFavorite(numericId);
    if (res.success) {
      setFavorites(favorites.filter(fav => fav.id !== id));
    }
  };

  const sortedFavorites = [...favorites].sort((a, b) => {
    switch (sortBy) {
      case 'price':
        return b.price - a.price;
      case 'score':
        return b.score - a.score;
      case 'dateAdded':
      default:
        return new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime();
    }
  });

  const filteredFavorites = sortedFavorites.filter(fav => {
    if (filterBy === 'all') return true;
    return fav.type.toLowerCase() === filterBy;
  });

  const getScoreColor = (score: number) => {
    if (score >= 8.5) return 'text-green-600 bg-green-100';
    if (score >= 7.5) return 'text-blue-600 bg-blue-100';
    if (score >= 6.5) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Favorites</h1>
          <p className="text-gray-600">Saved properties and investment opportunities</p>
        </div>
        <Heart className="h-8 w-8 text-red-500 fill-current" />
      </div>

      {isLoading && (
        <div className="p-3 rounded bg-blue-50 text-blue-700">Loading favorites…</div>
      )}
      {error && (
        <div className="p-3 rounded bg-red-50 text-red-700">{error}</div>
      )}

  {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <Heart className="h-8 w-8 text-red-500" />
            <div className="ml-3">
              <p className="text-2xl font-bold text-gray-900">{favorites.length}</p>
              <p className="text-sm text-gray-600">Total Favorites</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <DollarSign className="h-8 w-8 text-green-600" />
            <div className="ml-3">
              <p className="text-2xl font-bold text-gray-900">
                {favorites.length > 0 ? `$${Math.round(favorites.reduce((sum, fav) => sum + fav.price, 0) / favorites.length / 1000)}K` : '—'}
              </p>
              <p className="text-sm text-gray-600">Avg Price</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <TrendingUp className="h-8 w-8 text-blue-600" />
            <div className="ml-3">
              <p className="text-2xl font-bold text-gray-900">
                {favorites.length > 0 ? (favorites.reduce((sum, fav) => sum + fav.score, 0) / favorites.length).toFixed(1) : '—'}
              </p>
              <p className="text-sm text-gray-600">Avg Score</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <Star className="h-8 w-8 text-yellow-600" />
            <div className="ml-3">
              <p className="text-2xl font-bold text-gray-900">
                {favorites.filter(fav => fav.score >= 8.5).length}
              </p>
              <p className="text-sm text-gray-600">High Scores</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Sort */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
          <div className="flex items-center space-x-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Type</label>
              <select
                value={filterBy}
                onChange={(e) => setFilterBy(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Types</option>
                <option value="condo">Condos</option>
                <option value="apartment">Apartments</option>
                <option value="house">Houses</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sort by</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="dateAdded">Date Added</option>
                <option value="price">Price</option>
                <option value="score">Investment Score</option>
              </select>
            </div>
          </div>
          <div className="text-sm text-gray-600">
            Showing {filteredFavorites.length} of {favorites.length} properties
          </div>
        </div>
      </div>

      {/* Favorites Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredFavorites.map((property) => (
          <div key={property.id} className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
            {/* Property Image Placeholder */}
            <div className="h-48 bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
              <MapPin className="h-12 w-12 text-blue-600" />
            </div>

            <div className="p-6">
              {/* Header */}
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    {property.address}
                  </h3>
                  <p className="text-sm text-gray-600">{property.neighborhood}</p>
                </div>
                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getScoreColor(property.score)}`}>
                  {property.score}
                </span>
              </div>

              {/* Property Details */}
              <div className="grid grid-cols-3 gap-2 mb-4 text-sm text-gray-600">
                <div>{property.bedrooms} bed</div>
                <div>{property.bathrooms} bath</div>
                <div>{property.sqft} sqft</div>
              </div>

              {/* Price Information */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-lg font-bold text-gray-900">
                    ${property.price.toLocaleString()}
                  </span>
                  <span className="text-sm text-green-600">
                    ${property.estimatedRent}/mo rent
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  ROI: {((property.estimatedRent * 12 / property.price) * 100).toFixed(1)}%
                </div>
              </div>

              {/* Notes */}
              {property.notes && (
                <div className="mb-4 p-3 bg-gray-50 rounded">
                  <p className="text-sm text-gray-700">{property.notes}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-between items-center">
                <div className="flex space-x-2">
                  <button className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded">
                    <Eye className="h-4 w-4" />
                  </button>
                  <button className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded">
                    <Share2 className="h-4 w-4" />
                  </button>
                </div>
                <button
                  onClick={() => handleRemoveFavorite(property.id)}
                  className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {/* Date Added */}
              <div className="mt-3 text-xs text-gray-500 border-t pt-3">
                Added on {new Date(property.dateAdded).toLocaleDateString()}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {filteredFavorites.length === 0 && (
        <div className="text-center py-12">
          <Heart className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No favorites found</h3>
          <p className="text-gray-600">
            {favorites.length === 0 
              ? "Start exploring properties and add them to your favorites!"
              : "Try adjusting your filters to see more properties."
            }
          </p>
        </div>
      )}
    </div>
  );
};

export default Favorites;
