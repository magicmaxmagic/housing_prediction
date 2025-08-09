import { useState, useEffect } from 'react';
import { useAuth, useAuthenticatedFetch } from './useAuth';

export interface UserFavorite {
  id: number;
  user_id: number;
  zone_id: string;
  added_at: string;
  notes?: string;
  zone?: {
    zone_id: string;
    zone_name: string;
    investment_score: number;
    avg_price_per_sqft: number;
    avg_rent_per_sqft: number;
    avg_annual_return: number;
  };
}

interface UseFavoritesReturn {
  favorites: UserFavorite[];
  isLoading: boolean;
  error: string | null;
  addFavorite: (zoneId: string, notes?: string) => Promise<{ success: boolean; message?: string }>;
  removeFavorite: (favoriteId: number) => Promise<{ success: boolean; message?: string }>;
  updateFavoriteNotes: (favoriteId: number, notes: string) => Promise<{ success: boolean; message?: string }>;
  isFavorite: (zoneId: string) => boolean;
  getFavoriteId: (zoneId: string) => number | null;
  refreshFavorites: () => Promise<void>;
}

export const useFavorites = (): UseFavoritesReturn => {
  const { isAuthenticated, token } = useAuth();
  const authenticatedFetch = useAuthenticatedFetch();
  
  const [favorites, setFavorites] = useState<UserFavorite[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const API_BASE = '/api';

  // Load favorites when user is authenticated
  useEffect(() => {
    if (isAuthenticated && token) {
      refreshFavorites();
    } else {
      setFavorites([]);
      setError(null);
    }
  }, [isAuthenticated, token]);

  // Refresh favorites from server
  const refreshFavorites = async (): Promise<void> => {
    if (!isAuthenticated) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await authenticatedFetch(`${API_BASE}/favorites`);
      
      if (response.ok) {
        const data = await response.json();
        setFavorites((data && (data.favorites || data.data)) || []);
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to load favorites');
      }
    } catch (err) {
      setError('Network error while loading favorites');
      console.error('Error loading favorites:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Add a zone to favorites
  const addFavorite = async (zoneId: string, notes?: string): Promise<{ success: boolean; message?: string }> => {
    if (!isAuthenticated) {
      return { success: false, message: 'Please log in to add favorites' };
    }

    try {
      const response = await authenticatedFetch(`${API_BASE}/favorites`, {
        method: 'POST',
        body: JSON.stringify({ zone_id: zoneId, notes })
      });

      const data = await response.json();

      if (response.ok) {
        // Add the new favorite to the local state
        setFavorites(prev => [...prev, data.favorite]);
        return { success: true };
      } else {
        return { success: false, message: data.message || 'Failed to add favorite' };
      }
    } catch (err) {
      console.error('Error adding favorite:', err);
      return { success: false, message: 'Network error. Please try again.' };
    }
  };

  // Remove a favorite
  const removeFavorite = async (favoriteId: number): Promise<{ success: boolean; message?: string }> => {
    if (!isAuthenticated) {
      return { success: false, message: 'Please log in to manage favorites' };
    }

    try {
      const response = await authenticatedFetch(`${API_BASE}/favorites/${favoriteId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        // Remove the favorite from local state
        setFavorites(prev => prev.filter(fav => fav.id !== favoriteId));
        return { success: true };
      } else {
        const data = await response.json();
        return { success: false, message: data.message || 'Failed to remove favorite' };
      }
    } catch (err) {
      console.error('Error removing favorite:', err);
      return { success: false, message: 'Network error. Please try again.' };
    }
  };

  // Update favorite notes
  const updateFavoriteNotes = async (favoriteId: number, notes: string): Promise<{ success: boolean; message?: string }> => {
    if (!isAuthenticated) {
      return { success: false, message: 'Please log in to update favorites' };
    }

    try {
      const response = await authenticatedFetch(`${API_BASE}/favorites/${favoriteId}`, {
        method: 'PUT',
        body: JSON.stringify({ notes })
      });

      const data = await response.json();

      if (response.ok) {
        // Update the favorite in local state
        setFavorites(prev => prev.map(fav => 
          fav.id === favoriteId ? { ...fav, notes } : fav
        ));
        return { success: true };
      } else {
        return { success: false, message: data.message || 'Failed to update notes' };
      }
    } catch (err) {
      console.error('Error updating favorite notes:', err);
      return { success: false, message: 'Network error. Please try again.' };
    }
  };

  // Check if a zone is in favorites
  const isFavorite = (zoneId: string): boolean => {
    return favorites.some(fav => fav.zone_id === zoneId);
  };

  // Get favorite ID for a zone
  const getFavoriteId = (zoneId: string): number | null => {
    const favorite = favorites.find(fav => fav.zone_id === zoneId);
    return favorite ? favorite.id : null;
  };

  return {
    favorites,
    isLoading,
    error,
    addFavorite,
    removeFavorite,
    updateFavoriteNotes,
    isFavorite,
    getFavoriteId,
    refreshFavorites
  };
};

export default useFavorites;
