import React, { useState } from 'react';
import { useFavorites, type UserFavorite } from '../hooks/useFavorites';
import { useAuth } from '../hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Alert, AlertDescription } from './ui/alert';
import { 
  Heart, 
  HeartOff, 
  Loader2, 
  MapPin, 
  Calendar, 
  Edit3, 
  Save, 
  X, 
  Star, 
  TrendingUp,
  DollarSign
} from 'lucide-react';

interface FavoriteButtonProps {
  zoneId: string;
  className?: string;
  showText?: boolean;
}

export const FavoriteButton: React.FC<FavoriteButtonProps> = ({ 
  zoneId, 
  className = '', 
  showText = false 
}) => {
  const { isAuthenticated } = useAuth();
  const { 
    isFavorite, 
    getFavoriteId, 
    addFavorite, 
    removeFavorite, 
    isLoading 
  } = useFavorites();
  
  const [isProcessing, setIsProcessing] = useState(false);
  
  if (!isAuthenticated) {
    return null;
  }

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsProcessing(true);

    try {
      if (isFavorite(zoneId)) {
        const favoriteId = getFavoriteId(zoneId);
        if (favoriteId) {
          await removeFavorite(favoriteId);
        }
      } else {
        await addFavorite(zoneId);
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const isActive = isFavorite(zoneId);
  const isDisabled = isLoading || isProcessing;

  return (
    <Button
      variant={isActive ? "default" : "outline"}
      size="sm"
      onClick={handleToggleFavorite}
      disabled={isDisabled}
      className={className}
    >
      {isDisabled ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : isActive ? (
        <Heart className="w-4 h-4 fill-current" />
      ) : (
        <Heart className="w-4 h-4" />
      )}
      {showText && (
        <span className="ml-2">
          {isActive ? 'Favorited' : 'Add to Favorites'}
        </span>
      )}
    </Button>
  );
};

interface FavoriteCardProps {
  favorite: UserFavorite;
  onRemove?: (favoriteId: number) => void;
  onZoneClick?: (zoneId: string) => void;
}

const FavoriteCard: React.FC<FavoriteCardProps> = ({ 
  favorite, 
  onRemove,
  onZoneClick 
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [notes, setNotes] = useState(favorite.notes || '');
  const { updateFavoriteNotes } = useFavorites();

  const handleSaveNotes = async () => {
    try {
      const result = await updateFavoriteNotes(favorite.id, notes);
      if (result.success) {
        setIsEditing(false);
      }
    } catch (error) {
      console.error('Error updating notes:', error);
    }
  };

  const handleCancel = () => {
    setNotes(favorite.notes || '');
    setIsEditing(false);
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div 
            className="cursor-pointer flex-1"
            onClick={() => onZoneClick?.(favorite.zone_id)}
          >
            <CardTitle className="text-lg">
              {favorite.zone?.zone_name || `Zone ${favorite.zone_id}`}
            </CardTitle>
            <CardDescription className="flex items-center">
              <MapPin className="w-4 h-4 mr-1" />
              {favorite.zone_id}
              <Calendar className="w-4 h-4 ml-3 mr-1" />
              Added {new Date(favorite.added_at).toLocaleDateString()}
            </CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(!isEditing)}
            >
              <Edit3 className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRemove?.(favorite.id)}
            >
              <HeartOff className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {favorite.zone && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="flex items-center space-x-2">
              <Star className="w-4 h-4 text-yellow-500" />
              <div>
                <p className="text-sm text-gray-600">Investment Score</p>
                <p className="font-semibold">{favorite.zone.investment_score}/100</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <DollarSign className="w-4 h-4 text-green-500" />
              <div>
                <p className="text-sm text-gray-600">Avg Price/sq ft</p>
                <p className="font-semibold">${favorite.zone.avg_price_per_sqft}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-4 h-4 text-blue-500" />
              <div>
                <p className="text-sm text-gray-600">Annual Return</p>
                <p className="font-semibold">{favorite.zone.avg_annual_return.toFixed(1)}%</p>
              </div>
            </div>
          </div>
        )}

        {/* Notes Section */}
        <div className="space-y-2">
          <Label>Personal Notes</Label>
          {isEditing ? (
            <div className="space-y-2">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add your thoughts about this zone..."
                rows={3}
              />
              <div className="flex space-x-2">
                <Button size="sm" onClick={handleSaveNotes}>
                  <Save className="w-4 h-4 mr-1" />
                  Save
                </Button>
                <Button size="sm" variant="outline" onClick={handleCancel}>
                  <X className="w-4 h-4 mr-1" />
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div 
              className="min-h-[60px] p-2 border rounded cursor-pointer hover:bg-gray-50"
              onClick={() => setIsEditing(true)}
            >
              {favorite.notes ? (
                <p className="text-sm">{favorite.notes}</p>
              ) : (
                <p className="text-sm text-gray-400 italic">Click to add notes...</p>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

interface FavoritesDashboardProps {
  onZoneSelect?: (zoneId: string) => void;
}

export const FavoritesDashboard: React.FC<FavoritesDashboardProps> = ({ onZoneSelect }) => {
  const { isAuthenticated } = useAuth();
  const { 
    favorites, 
    isLoading, 
    error, 
    removeFavorite, 
    refreshFavorites 
  } = useFavorites();

  const [sortBy, setSortBy] = useState<'added' | 'score' | 'name'>('added');
  const [filterText, setFilterText] = useState('');

  const handleRemoveFavorite = async (favoriteId: number) => {
    const result = await removeFavorite(favoriteId);
    if (!result.success) {
      console.error('Failed to remove favorite:', result.message);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="text-center py-12">
        <Heart className="w-16 h-16 mx-auto text-gray-400 mb-4" />
        <h3 className="text-xl font-semibold mb-2">Sign In to Save Favorites</h3>
        <p className="text-gray-600">
          Create an account to save your favorite zones and track investment opportunities
        </p>
      </div>
    );
  }

  // Filter and sort favorites
  const filteredAndSortedFavorites = favorites
    .filter(favorite => {
      if (!filterText) return true;
      const searchText = filterText.toLowerCase();
      const zoneName = favorite.zone?.zone_name?.toLowerCase() || '';
      const zoneId = favorite.zone_id.toLowerCase();
      const notes = favorite.notes?.toLowerCase() || '';
      return zoneName.includes(searchText) || zoneId.includes(searchText) || notes.includes(searchText);
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'score':
          return (b.zone?.investment_score || 0) - (a.zone?.investment_score || 0);
        case 'name':
          const nameA = a.zone?.zone_name || a.zone_id;
          const nameB = b.zone?.zone_name || b.zone_id;
          return nameA.localeCompare(nameB);
        case 'added':
        default:
          return new Date(b.added_at).getTime() - new Date(a.added_at).getTime();
      }
    });

  if (error) {
    return (
      <Alert className="border-red-200 bg-red-50">
        <AlertDescription className="text-red-600">
          {error}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">My Favorites</h2>
          <p className="text-gray-600">
            {favorites.length} saved {favorites.length === 1 ? 'zone' : 'zones'}
          </p>
        </div>
        <Button 
          onClick={refreshFavorites}
          disabled={isLoading}
          variant="outline"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Loading...
            </>
          ) : (
            'Refresh'
          )}
        </Button>
      </div>

      {/* Filters and Sorting */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Label htmlFor="filter">Search favorites</Label>
          <Input
            id="filter"
            placeholder="Search by zone name, ID, or notes..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="sort">Sort by</Label>
          <select
            id="sort"
            className="w-full p-2 border rounded"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
          >
            <option value="added">Date Added</option>
            <option value="score">Investment Score</option>
            <option value="name">Zone Name</option>
          </select>
        </div>
      </div>

      {/* Favorites Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      ) : filteredAndSortedFavorites.length === 0 ? (
        <div className="text-center py-12">
          {favorites.length === 0 ? (
            <>
              <Heart className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Favorites Yet</h3>
              <p className="text-gray-600">
                Browse zones and click the heart icon to add them to your favorites
              </p>
            </>
          ) : (
            <>
              <h3 className="text-xl font-semibold mb-2">No Results</h3>
              <p className="text-gray-600">
                No favorites match your search criteria
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredAndSortedFavorites.map(favorite => (
            <FavoriteCard
              key={favorite.id}
              favorite={favorite}
              onRemove={handleRemoveFavorite}
              onZoneClick={onZoneSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default FavoritesDashboard;
