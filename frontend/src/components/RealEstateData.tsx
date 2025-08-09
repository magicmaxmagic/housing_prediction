import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  Building2, 
  TrendingUp, 
  MapPin, 
  Calendar,
  Users,
  Square,
  Home
} from 'lucide-react';

interface InvestmentZone {
  street_name: string;
  property_count: number;
  total_units: number;
  avg_construction_year: number;
  avg_land_surface: number;
  avg_building_surface: number;
  investment_score: number;
  density_score: number;
  modernity_score: number;
  size_score: number;
}

interface EvaluationUnit {
  id: string;
  civique_debut: string;
  civique_fin: string;
  nom_rue: string;
  nb_logements: number;
  annee_construction: number;
  libelle_utilisation: string;
  superficie_terrain: number;
  superficie_batiment: number;
  etages: number;
}

interface PropertySearchResult {
  id: string;
  civique_debut: string;
  civique_fin: string;
  nom_rue: string;
  nb_logements: number;
  annee_construction: number;
  libelle_utilisation: string;
  superficie_terrain: number;
  superficie_batiment: number;
  etages: number;
  investment_score: number | null;
}

export default function RealEstateData() {
  const [investmentZones, setInvestmentZones] = useState<InvestmentZone[]>([]);
  const [evaluationUnits, setEvaluationUnits] = useState<EvaluationUnit[]>([]);
  const [searchResults, setSearchResults] = useState<PropertySearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('zones');
  const [searchParams, setSearchParams] = useState({
    street: '',
    minYear: '',
    maxYear: '',
    minUnits: ''
  });

  const API_BASE = '/api';

  useEffect(() => {
    loadInvestmentZones();
    loadEvaluationUnits();
  }, []);

  const loadInvestmentZones = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/investment-zones?limit=20`);
      const data = await response.json();
      setInvestmentZones(data.data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des zones d\'investissement:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadEvaluationUnits = async () => {
    try {
      const response = await fetch(`${API_BASE}/evaluation-units?limit=20`);
      const data = await response.json();
      setEvaluationUnits(data.data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des unités d\'évaluation:', error);
    }
  };

  const searchProperties = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      if (searchParams.street) params.append('street', searchParams.street);
      if (searchParams.minYear) params.append('min_year', searchParams.minYear);
      if (searchParams.maxYear) params.append('max_year', searchParams.maxYear);
      if (searchParams.minUnits) params.append('min_units', searchParams.minUnits);
      
      const response = await fetch(`${API_BASE}/property-search?${params}`);
      const data = await response.json();
      setSearchResults(data.data || []);
    } catch (error) {
      console.error('Erreur lors de la recherche:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatScore = (score: number) => {
    return Math.round(score * 100) / 100;
  };

  const getScoreColor = (score: number) => {
    if (score >= 100) return 'bg-green-500';
    if (score >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3 mb-8">
        <Building2 className="h-8 w-8 text-blue-600" />
        <h1 className="text-3xl font-bold">Données Immobilières InvestMTL</h1>
      </div>

      {/* Navigation par onglets simplifiée */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('zones')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'zones'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Zones d'Investissement
            </div>
          </button>
          <button
            onClick={() => setActiveTab('units')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'units'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Home className="h-4 w-4" />
              Unités d'Évaluation
            </div>
          </button>
          <button
            onClick={() => setActiveTab('search')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'search'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              Recherche Avancée
            </div>
          </button>
        </nav>
      </div>

      {activeTab === 'zones' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Top des Zones d'Investissement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {investmentZones.map((zone, index) => (
                <div 
                  key={zone.street_name} 
                  className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">#{index + 1}</Badge>
                      <div>
                        <h3 className="font-semibold text-lg">{zone.street_name}</h3>
                        <p className="text-sm text-gray-600 flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {zone.property_count} propriétés • {zone.total_units} logements
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`inline-flex items-center px-3 py-1 rounded-full text-white text-sm font-medium ${getScoreColor(zone.investment_score)}`}>
                        {formatScore(zone.investment_score)}/100
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-gray-500" />
                      <span>~{Math.round(zone.avg_construction_year > 2024 ? 1975 : zone.avg_construction_year)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Square className="h-3 w-3 text-gray-500" />
                      <span>{Math.round(zone.avg_land_surface)}m² terrain</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Building2 className="h-3 w-3 text-gray-500" />
                      <span>{Math.round(zone.avg_building_surface)}m² bâti</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3 text-gray-500" />
                      <span>Densité: {formatScore(zone.density_score)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'units' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Home className="h-5 w-5" />
              Unités d'Évaluation Foncière
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {evaluationUnits.map((unit) => (
                <div 
                  key={unit.id} 
                  className="border rounded-lg p-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-medium">
                        {unit.civique_debut}{unit.civique_fin !== unit.civique_debut ? `-${unit.civique_fin}` : ''} {unit.nom_rue}
                      </h3>
                      <p className="text-sm text-gray-600">{unit.libelle_utilisation}</p>
                    </div>
                    <Badge variant="outline">ID: {unit.id}</Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500">Logements:</span>
                      <div className="font-medium">{unit.nb_logements}</div>
                    </div>
                    <div>
                      <span className="text-gray-500">Année:</span>
                      <div className="font-medium">{unit.annee_construction}</div>
                    </div>
                    <div>
                      <span className="text-gray-500">Étages:</span>
                      <div className="font-medium">{unit.etages || 'N/A'}</div>
                    </div>
                    <div>
                      <span className="text-gray-500">Terrain:</span>
                      <div className="font-medium">{unit.superficie_terrain}m²</div>
                    </div>
                    <div>
                      <span className="text-gray-500">Bâtiment:</span>
                      <div className="font-medium">{unit.superficie_batiment || 'N/A'}m²</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'search' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Recherche Avancée de Propriétés
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Rue</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="ex: Saint-Laurent"
                  value={searchParams.street}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                    setSearchParams({...searchParams, street: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Année min</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="ex: 2000"
                  value={searchParams.minYear}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                    setSearchParams({...searchParams, minYear: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Année max</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="ex: 2024"
                  value={searchParams.maxYear}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                    setSearchParams({...searchParams, maxYear: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Logements min</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="ex: 5"
                  value={searchParams.minUnits}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                    setSearchParams({...searchParams, minUnits: e.target.value})}
                />
              </div>
            </div>
            
            <Button onClick={searchProperties} disabled={loading} className="w-full">
              <Search className="h-4 w-4 mr-2" />
              {loading ? 'Recherche...' : 'Rechercher'}
            </Button>

            {searchResults.length > 0 && (
              <div className="mt-6 space-y-3">
                <h3 className="font-semibold">Résultats ({searchResults.length})</h3>
                {searchResults.map((result) => (
                  <div 
                    key={result.id} 
                    className="border rounded-lg p-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-medium">
                          {result.civique_debut}-{result.civique_fin} {result.nom_rue}
                        </h4>
                        <p className="text-sm text-gray-600">{result.libelle_utilisation}</p>
                      </div>
                      <div className="text-right">
                        {result.investment_score && (
                          <Badge variant="secondary">
                            Score: {formatScore(result.investment_score)}
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-3 text-sm">
                      <div>
                        <span className="text-gray-500">Logements:</span>
                        <div className="font-medium">{result.nb_logements}</div>
                      </div>
                      <div>
                        <span className="text-gray-500">Année:</span>
                        <div className="font-medium">{result.annee_construction}</div>
                      </div>
                      <div>
                        <span className="text-gray-500">Étages:</span>
                        <div className="font-medium">{result.etages || 'N/A'}</div>
                      </div>
                      <div>
                        <span className="text-gray-500">Terrain:</span>
                        <div className="font-medium">{result.superficie_terrain}m²</div>
                      </div>
                      <div>
                        <span className="text-gray-500">Bâtiment:</span>
                        <div className="font-medium">{result.superficie_batiment || 'N/A'}m²</div>
                      </div>
                      <div>
                        <span className="text-gray-500">ID:</span>
                        <div className="font-medium text-xs">{result.id}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
