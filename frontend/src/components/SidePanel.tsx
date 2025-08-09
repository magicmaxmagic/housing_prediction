import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  TrendingUp, 
  Home, 
  AlertTriangle, 
  MapPin, 
  DollarSign,
  RotateCcw,
  Info
} from 'lucide-react';

interface ScoreWeights {
  growth: number;
  supply: number;
  tension: number;
  access: number;
  return: number;
}

interface SidePanelProps {
  weights: ScoreWeights;
  onWeightsChange: (weights: ScoreWeights) => void;
  selectedArea: string | null;
  areaData: any;
}

const defaultWeights: ScoreWeights = {
  growth: 25,
  supply: 20,
  tension: 20,
  access: 20,
  return: 15
};

const scoreCategories = [
  {
    key: 'growth' as keyof ScoreWeights,
    title: 'Croissance',
    icon: TrendingUp,
    description: 'Potentiel d\'appréciation des prix',
    color: 'text-green-600'
  },
  {
    key: 'supply' as keyof ScoreWeights,
    title: 'Offre',
    icon: Home,
    description: 'Disponibilité du logement',
    color: 'text-blue-600'
  },
  {
    key: 'tension' as keyof ScoreWeights,
    title: 'Tension',
    icon: AlertTriangle,
    description: 'Pression sur le marché',
    color: 'text-orange-600'
  },
  {
    key: 'access' as keyof ScoreWeights,
    title: 'Accessibilité',
    icon: MapPin,
    description: 'Transport et services',
    color: 'text-purple-600'
  },
  {
    key: 'return' as keyof ScoreWeights,
    title: 'Rendement',
    icon: DollarSign,
    description: 'Ratio loyer/prix',
    color: 'text-yellow-600'
  }
];

export const SidePanel: React.FC<SidePanelProps> = ({
  weights,
  onWeightsChange,
  selectedArea,
  areaData
}) => {
  const [localWeights, setLocalWeights] = useState(weights);

  const handleWeightChange = (category: keyof ScoreWeights, value: number[]) => {
    const newWeights = { ...localWeights, [category]: value[0] };
    setLocalWeights(newWeights);
    onWeightsChange(newWeights);
  };

  const resetWeights = () => {
    setLocalWeights(defaultWeights);
    onWeightsChange(defaultWeights);
  };

  const totalWeight = Object.values(localWeights).reduce((sum, weight) => sum + weight, 0);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-lime-500';
    if (score >= 40) return 'bg-yellow-500';
    if (score >= 20) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Très bon';
    if (score >= 40) return 'Bon';
    if (score >= 20) return 'Moyen';
    return 'Faible';
  };

  return (
    <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <h1 className="text-xl font-bold text-gray-900">InvestMTL</h1>
        <p className="text-sm text-gray-500">Analyse d'investissement immobilier</p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Score Weights Section */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Pondération des scores</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetWeights}
                  className="h-7 text-xs"
                >
                  <RotateCcw className="w-3 h-3 mr-1" />
                  Reset
                </Button>
              </div>
              {totalWeight !== 100 && (
                <div className="flex items-center text-xs text-amber-600">
                  <Info className="w-3 h-3 mr-1" />
                  Total: {totalWeight}% (recommandé: 100%)
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {scoreCategories.map((category) => {
                const IconComponent = category.icon;
                return (
                  <div key={category.key} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <IconComponent className={`w-4 h-4 ${category.color}`} />
                        <span className="text-sm font-medium">{category.title}</span>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {localWeights[category.key]}%
                      </Badge>
                    </div>
                    <Slider
                      value={[localWeights[category.key]]}
                      onValueChange={(value) => handleWeightChange(category.key, value)}
                      max={50}
                      min={0}
                      step={5}
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500">{category.description}</p>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Selected Area Section */}
          {selectedArea && areaData && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Zone sélectionnée</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-medium text-gray-900">{areaData.name}</h3>
                  <p className="text-sm text-gray-500">ID: {selectedArea}</p>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Score total</span>
                    <div className="flex items-center space-x-2">
                      <div
                        className={`w-3 h-3 rounded-full ${getScoreColor(areaData.s_total)}`}
                      />
                      <Badge variant="outline">
                        {Math.round(areaData.s_total)} / 100
                      </Badge>
                    </div>
                  </div>
                  <div className="text-xs text-gray-600">
                    {getScoreLabel(areaData.s_total)}
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Détail des scores</h4>
                  {scoreCategories.map((category) => {
                    const score = areaData[`s_${category.key}`] || 0;
                    const IconComponent = category.icon;
                    return (
                      <div key={category.key} className="flex items-center justify-between text-sm">
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
                </div>

                {areaData.as_of && (
                  <>
                    <Separator />
                    <div className="text-xs text-gray-500">
                      Dernière mise à jour: {new Date(areaData.as_of).toLocaleDateString('fr-CA')}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Legend Section */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Légende des scores</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { range: '80-100', label: 'Excellent', color: 'bg-green-500' },
                { range: '60-79', label: 'Très bon', color: 'bg-lime-500' },
                { range: '40-59', label: 'Bon', color: 'bg-yellow-500' },
                { range: '20-39', label: 'Moyen', color: 'bg-orange-500' },
                { range: '0-19', label: 'Faible', color: 'bg-red-500' }
              ].map((item) => (
                <div key={item.range} className="flex items-center space-x-2 text-sm">
                  <div className={`w-3 h-3 rounded-full ${item.color}`} />
                  <span className="font-medium">{item.label}</span>
                  <span className="text-gray-500">({item.range})</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Info Section */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">À propos</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-gray-600 space-y-2">
              <p>
                InvestMTL analyse les opportunités d'investissement immobilier à Montréal
                en utilisant des données ouvertes et des modèles prédictifs.
              </p>
              <p>
                Ajustez les pondérations ci-dessus pour personnaliser l'analyse selon
                vos critères d'investissement.
              </p>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
};
