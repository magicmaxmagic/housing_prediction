import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  X, 
  TrendingUp, 
  Home, 
  AlertTriangle, 
  MapPin, 
  DollarSign,
  BarChart3,
  Calendar
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface AreaData {
  id: string;
  name: string;
  s_growth: number;
  s_supply: number;
  s_tension: number;
  s_access: number;
  s_return: number;
  s_total: number;
  as_of: string;
}

interface ForecastData {
  month: number;
  rent: number;
  vacancy: number;
}

interface CompareDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  areas: AreaData[];
  onRemoveArea: (areaId: string) => void;
  forecasts?: { [areaId: string]: ForecastData[] };
}

const scoreCategories = [
  {
    key: 's_growth',
    title: 'Croissance',
    icon: TrendingUp,
    color: 'text-green-600'
  },
  {
    key: 's_supply',
    title: 'Offre',
    icon: Home,
    color: 'text-blue-600'
  },
  {
    key: 's_tension',
    title: 'Tension',
    icon: AlertTriangle,
    color: 'text-orange-600'
  },
  {
    key: 's_access',
    title: 'Accessibilité',
    icon: MapPin,
    color: 'text-purple-600'
  },
  {
    key: 's_return',
    title: 'Rendement',
    icon: DollarSign,
    color: 'text-yellow-600'
  }
];

const getScoreColor = (score: number) => {
  if (score >= 80) return 'bg-green-500';
  if (score >= 60) return 'bg-lime-500';
  if (score >= 40) return 'bg-yellow-500';
  if (score >= 20) return 'bg-orange-500';
  return 'bg-red-500';
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('fr-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

export const CompareDrawer: React.FC<CompareDrawerProps> = ({
  isOpen,
  onClose,
  areas,
  onRemoveArea,
  forecasts = {}
}) => {
  const [activeTab, setActiveTab] = useState<'scores' | 'forecasts'>('scores');

  if (!isOpen) return null;

  const sortedAreas = areas.sort((a, b) => b.s_total - a.s_total);

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50">
      <div className="absolute right-0 top-0 h-full w-96 bg-white shadow-xl transform transition-transform">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Comparaison ({areas.length})
            </h2>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Tab Navigation */}
          <div className="flex border-b border-gray-200">
            <button
              className={`flex-1 px-4 py-2 text-sm font-medium border-b-2 ${
                activeTab === 'scores'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setActiveTab('scores')}
            >
              <BarChart3 className="w-4 h-4 inline mr-2" />
              Scores
            </button>
            <button
              className={`flex-1 px-4 py-2 text-sm font-medium border-b-2 ${
                activeTab === 'forecasts'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setActiveTab('forecasts')}
            >
              <Calendar className="w-4 h-4 inline mr-2" />
              Prévisions
            </button>
          </div>

          {/* Content */}
          <ScrollArea className="flex-1">
            {activeTab === 'scores' && (
              <div className="p-4 space-y-4">
                {areas.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-gray-500">Aucune zone sélectionnée</p>
                    <p className="text-sm text-gray-400 mt-2">
                      Cliquez sur une zone sur la carte pour l'ajouter à la comparaison
                    </p>
                  </div>
                )}

                {sortedAreas.map((area, index) => (
                  <Card key={area.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-sm">{area.name}</CardTitle>
                          <div className="flex items-center mt-1">
                            {index === 0 && (
                              <Badge className="mr-2 text-xs bg-gold-100 text-gold-800">
                                #1
                              </Badge>
                            )}
                            <div className="flex items-center space-x-2">
                              <div
                                className={`w-3 h-3 rounded-full ${getScoreColor(area.s_total)}`}
                              />
                              <Badge variant="outline" className="text-xs">
                                {Math.round(area.s_total)}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onRemoveArea(area.id)}
                          className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {scoreCategories.map((category) => {
                        const score = area[category.key as keyof AreaData] as number;
                        const IconComponent = category.icon;
                        return (
                          <div key={category.key} className="flex items-center justify-between text-xs">
                            <div className="flex items-center space-x-2">
                              <IconComponent className={`w-3 h-3 ${category.color}`} />
                              <span>{category.title}</span>
                            </div>
                            <Badge variant="secondary" className="text-xs">
                              {Math.round(score)}
                            </Badge>
                          </div>
                        );
                      })}
                      <div className="text-xs text-gray-400 mt-2">
                        Mis à jour: {new Date(area.as_of).toLocaleDateString('fr-CA')}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {activeTab === 'forecasts' && (
              <div className="p-4 space-y-6">
                {areas.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-gray-500">Aucune zone sélectionnée</p>
                  </div>
                )}

                {areas.length > 0 && (
                  <>
                    {/* Rent Forecast Chart */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">Prévision des loyers moyens</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-48">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis 
                                dataKey="month" 
                                tickFormatter={(value) => `Mois ${value}`}
                              />
                              <YAxis 
                                tickFormatter={(value) => formatCurrency(value)}
                              />
                              <Tooltip 
                                formatter={(value: number) => formatCurrency(value)}
                                labelFormatter={(month) => `Mois ${month}`}
                              />
                              {areas.map((area, index) => {
                                const areaForecasts = forecasts[area.id] || [];
                                const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
                                return (
                                  <Line
                                    key={area.id}
                                    data={areaForecasts}
                                    type="monotone"
                                    dataKey="rent"
                                    stroke={colors[index % colors.length]}
                                    strokeWidth={2}
                                    dot={false}
                                    name={area.name}
                                  />
                                );
                              })}
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="mt-2 space-y-1">
                          {areas.map((area, index) => {
                            const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
                            return (
                              <div key={area.id} className="flex items-center text-xs">
                                <div 
                                  className="w-3 h-0.5 mr-2"
                                  style={{ backgroundColor: colors[index % colors.length] }}
                                />
                                <span>{area.name}</span>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Vacancy Rate Chart */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">Taux d'inoccupation (%)</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-48">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis 
                                dataKey="month" 
                                tickFormatter={(value) => `Mois ${value}`}
                              />
                              <YAxis 
                                tickFormatter={(value) => `${value}%`}
                              />
                              <Tooltip 
                                formatter={(value: number) => `${value.toFixed(1)}%`}
                                labelFormatter={(month) => `Mois ${month}`}
                              />
                              {areas.map((area, index) => {
                                const areaForecasts = forecasts[area.id] || [];
                                const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
                                return (
                                  <Line
                                    key={area.id}
                                    data={areaForecasts}
                                    type="monotone"
                                    dataKey="vacancy"
                                    stroke={colors[index % colors.length]}
                                    strokeWidth={2}
                                    dot={false}
                                    name={area.name}
                                  />
                                );
                              })}
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Summary Stats */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">Résumé des prévisions (12 mois)</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {areas.map((area) => {
                          const areaForecasts = forecasts[area.id] || [];
                          const month12 = areaForecasts.find(f => f.month === 12);
                          const currentRent = areaForecasts.find(f => f.month === 1)?.rent || 0;
                          const projectedGrowth = month12 && currentRent ? 
                            ((month12.rent - currentRent) / currentRent) * 100 : 0;

                          return (
                            <div key={area.id} className="text-sm">
                              <div className="font-medium">{area.name}</div>
                              <div className="flex justify-between text-xs text-gray-600 mt-1">
                                <span>Croissance loyer:</span>
                                <span className={projectedGrowth >= 0 ? 'text-green-600' : 'text-red-600'}>
                                  {projectedGrowth >= 0 ? '+' : ''}{projectedGrowth.toFixed(1)}%
                                </span>
                              </div>
                              <div className="flex justify-between text-xs text-gray-600">
                                <span>Taux d'inoccupation:</span>
                                <span>{month12?.vacancy.toFixed(1) || 'N/A'}%</span>
                              </div>
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>
                  </>
                )}
              </div>
            )}
          </ScrollArea>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200">
            <Button
              variant="outline"
              size="sm"
              onClick={() => areas.forEach(area => onRemoveArea(area.id))}
              className="w-full"
              disabled={areas.length === 0}
            >
              Effacer tout
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
