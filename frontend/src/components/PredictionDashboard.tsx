import React, { useState, useEffect } from 'react';
import { 
  usePredictions, 
  formatPrice, 
  formatPricePerSqft, 
  formatPercentage, 
  getConfidenceRange, 
  getInvestmentRecommendation,
  type ZonePrediction, 
} from '../hooks/usePredictions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Alert, AlertDescription } from './ui/alert';
import { 
  Loader2, 
  TrendingUp, 
  TrendingDown, 
  Target, 
  BarChart3, 
  MapPin, 
  Calendar,
  AlertTriangle,
  CheckCircle,
  Info
} from 'lucide-react';

interface PredictionDashboardProps {
  selectedZone?: string | null;
  onZoneSelect?: (zoneId: string) => void;
}

export const PredictionDashboard: React.FC<PredictionDashboardProps> = ({ 
  selectedZone, 
  onZoneSelect 
}) => {
  const { 
    predictions, 
    summary, 
    isLoading, 
    error, 
    loadPredictions, 
    loadSummary, 
    loadZonePrediction 
  } = usePredictions();

  const [activeTab, setActiveTab] = useState('overview');
  const [selectedZonePrediction, setSelectedZonePrediction] = useState<ZonePrediction | null>(null);

  useEffect(() => {
    loadSummary();
    loadPredictions();
  }, [loadSummary, loadPredictions]);

  useEffect(() => {
    if (selectedZone) {
      loadZonePrediction(selectedZone).then(prediction => {
        setSelectedZonePrediction(prediction);
        if (prediction) {
          setActiveTab('zone-detail');
        }
      });
    }
  }, [selectedZone, loadZonePrediction]);

  const renderSummaryCard = (title: string, value: string, trend?: number, icon?: React.ReactNode) => (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {trend !== undefined && (
              <div className={`flex items-center mt-1 ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {trend >= 0 ? (
                  <TrendingUp className="w-4 h-4 mr-1" />
                ) : (
                  <TrendingDown className="w-4 h-4 mr-1" />
                )}
                <span className="text-sm">{formatPercentage(trend)}</span>
              </div>
            )}
          </div>
          {icon && <div className="text-gray-400">{icon}</div>}
        </div>
      </CardContent>
    </Card>
  );

  const renderZoneCard = (zone: ZonePrediction, rank?: number) => {
    const recommendation = getInvestmentRecommendation(
      zone.price_change_percent,
      zone.rent_change_percent,
      zone.investment_score
    );


    return (
      <Card 
        key={zone.zone_id}
        className="hover:shadow-md transition-shadow cursor-pointer"
        onClick={() => onZoneSelect?.(zone.zone_id)}
      >
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{zone.zone_name}</CardTitle>
            {rank && (
              <Badge variant="outline">#{rank}</Badge>
            )}
          </div>
          <CardDescription className="flex items-center">
            <MapPin className="w-4 h-4 mr-1" />
            Zone {zone.zone_id}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Investment Score */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Investment Score</span>
              <Badge 
                variant={zone.investment_score >= 80 ? 'default' : 
                        zone.investment_score >= 60 ? 'secondary' : 'outline'}
              >
                {zone.investment_score}/100
              </Badge>
            </div>

            {/* Predicted Price */}
            <div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Predicted Price</span>
                <div className={`flex items-center ${zone.price_change_percent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {zone.price_change_percent >= 0 ? (
                    <TrendingUp className="w-4 h-4 mr-1" />
                  ) : (
                    <TrendingDown className="w-4 h-4 mr-1" />
                  )}
                  {formatPercentage(zone.price_change_percent)}
                </div>
              </div>
              <p className="text-lg font-semibold">{formatPrice(zone.predicted_price)}</p>
              <p className="text-xs text-gray-500">
                Confidence: {getConfidenceRange(zone.price_confidence_min, zone.price_confidence_max)}
              </p>
            </div>

            {/* Predicted Rent */}
            <div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Predicted Rent</span>
                <div className={`flex items-center ${zone.rent_change_percent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {zone.rent_change_percent >= 0 ? (
                    <TrendingUp className="w-4 h-4 mr-1" />
                  ) : (
                    <TrendingDown className="w-4 h-4 mr-1" />
                  )}
                  {formatPercentage(zone.rent_change_percent)}
                </div>
              </div>
              <p className="text-lg font-semibold">{formatPricePerSqft(zone.predicted_rent)}</p>
              <p className="text-xs text-gray-500">
                Confidence: {getConfidenceRange(zone.rent_confidence_min, zone.rent_confidence_max)}
              </p>
            </div>

            {/* Recommendation */}
            <div className="pt-2 border-t">
              <div className="flex items-center space-x-2">
                {recommendation.level === 'high' ? (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                ) : recommendation.level === 'medium' ? (
                  <Info className="w-4 h-4 text-blue-600" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-yellow-600" />
                )}
                <span className="text-sm">{recommendation.message}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (error) {
    return (
      <Alert className="border-red-200 bg-red-50">
        <AlertTriangle className="h-4 w-4" />
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
          <h2 className="text-2xl font-bold">AI Market Predictions</h2>
          <p className="text-gray-600">Machine learning insights for Montreal real estate</p>
        </div>
        <Button 
          onClick={() => {
            loadSummary();
            loadPredictions();
          }}
          disabled={isLoading}
          variant="outline"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Updating...
            </>
          ) : (
            <>
              <BarChart3 className="w-4 h-4 mr-2" />
              Refresh Data
            </>
          )}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="top-zones">Top Zones</TabsTrigger>
          {selectedZonePrediction && (
            <TabsTrigger value="zone-detail">Zone Detail</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Summary Statistics */}
          {summary && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {renderSummaryCard(
                "Average Predicted Price",
                formatPrice(summary.avg_predicted_price),
                undefined,
                <Target className="w-6 h-6" />
              )}
              {renderSummaryCard(
                "Average Predicted Rent",
                formatPricePerSqft(summary.avg_predicted_rent),
                undefined,
                <TrendingUp className="w-6 h-6" />
              )}
              {renderSummaryCard(
                "Average Investment Score",
                `${summary.avg_investment_score.toFixed(1)}/100`,
                undefined,
                <BarChart3 className="w-6 h-6" />
              )}
              {renderSummaryCard(
                "Total Zones Analyzed",
                summary.total_zones.toString(),
                undefined,
                <MapPin className="w-6 h-6" />
              )}
            </div>
          )}

          {/* Recent Predictions */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Predictions</CardTitle>
              <CardDescription>
                Latest AI-generated market insights updated daily
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin" />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {predictions.slice(0, 6).map(prediction => 
                    renderZoneCard(prediction)
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="top-zones" className="space-y-6">
          {summary && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Top by Price Growth */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <TrendingUp className="w-5 h-5 mr-2 text-green-600" />
                    Top Price Growth
                  </CardTitle>
                  <CardDescription>Zones with highest predicted price increases</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {summary.top_zones_by_price.slice(0, 5).map((zone, index) => (
                    <div
                      key={zone.zone_id}
                      className="flex items-center justify-between p-2 rounded border hover:bg-gray-50 cursor-pointer"
                      onClick={() => onZoneSelect?.(zone.zone_id)}
                    >
                      <div>
                        <p className="font-medium">{zone.zone_name}</p>
                        <p className="text-sm text-gray-600">{formatPrice(zone.predicted_price)}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline">#{index + 1}</Badge>
                        <p className="text-sm text-green-600 mt-1">
                          {formatPercentage(zone.price_change_percent)}
                        </p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Top by Rent Growth */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <TrendingUp className="w-5 h-5 mr-2 text-blue-600" />
                    Top Rent Growth
                  </CardTitle>
                  <CardDescription>Zones with highest predicted rent increases</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {summary.top_zones_by_rent.slice(0, 5).map((zone, index) => (
                    <div
                      key={zone.zone_id}
                      className="flex items-center justify-between p-2 rounded border hover:bg-gray-50 cursor-pointer"
                      onClick={() => onZoneSelect?.(zone.zone_id)}
                    >
                      <div>
                        <p className="font-medium">{zone.zone_name}</p>
                        <p className="text-sm text-gray-600">{formatPricePerSqft(zone.predicted_rent)}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline">#{index + 1}</Badge>
                        <p className="text-sm text-blue-600 mt-1">
                          {formatPercentage(zone.rent_change_percent)}
                        </p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Top Overall Growth */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <BarChart3 className="w-5 h-5 mr-2 text-purple-600" />
                    Best Overall
                  </CardTitle>
                  <CardDescription>Zones with highest combined growth potential</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {summary.top_zones_by_growth.slice(0, 5).map((zone, index) => (
                    <div
                      key={zone.zone_id}
                      className="flex items-center justify-between p-2 rounded border hover:bg-gray-50 cursor-pointer"
                      onClick={() => onZoneSelect?.(zone.zone_id)}
                    >
                      <div>
                        <p className="font-medium">{zone.zone_name}</p>
                        <p className="text-sm text-gray-600">Score: {zone.investment_score}/100</p>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline">#{index + 1}</Badge>
                        <div className="text-xs text-gray-600 mt-1">
                          <div>{formatPercentage(zone.price_change_percent)} price</div>
                          <div>{formatPercentage(zone.rent_change_percent)} rent</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {selectedZonePrediction && (
          <TabsContent value="zone-detail">
            <Card>
              <CardHeader>
                <CardTitle>{selectedZonePrediction.zone_name}</CardTitle>
                <CardDescription className="flex items-center">
                  <MapPin className="w-4 h-4 mr-1" />
                  Zone {selectedZonePrediction.zone_id} • 
                  <Calendar className="w-4 h-4 ml-2 mr-1" />
                  Updated {selectedZonePrediction.prediction_date ? new Date(selectedZonePrediction.prediction_date).toLocaleDateString() : 'N/A'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Detailed prediction view for selected zone */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Price Prediction */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Price Prediction</h3>
                    <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                      <div className="flex justify-between items-center">
                        <span>Current Average</span>
                        <span className="font-medium">{formatPrice(selectedZonePrediction.current_avg_price)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Predicted</span>
                        <span className="font-bold text-lg">{formatPrice(selectedZonePrediction.predicted_price)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Expected Change</span>
                        <span className={`font-medium ${selectedZonePrediction.price_change_percent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatPercentage(selectedZonePrediction.price_change_percent)}
                        </span>
                      </div>
                      <div className="pt-2 border-t">
                        <div className="text-sm text-gray-600">
                          Confidence Range: {getConfidenceRange(
                            selectedZonePrediction.price_confidence_min,
                            selectedZonePrediction.price_confidence_max
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Rent Prediction */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Rent Prediction</h3>
                    <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                      <div className="flex justify-between items-center">
                        <span>Current Average</span>
                        <span className="font-medium">{formatPricePerSqft(selectedZonePrediction.current_avg_rent)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Predicted</span>
                        <span className="font-bold text-lg">{formatPricePerSqft(selectedZonePrediction.predicted_rent)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Expected Change</span>
                        <span className={`font-medium ${selectedZonePrediction.rent_change_percent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatPercentage(selectedZonePrediction.rent_change_percent)}
                        </span>
                      </div>
                      <div className="pt-2 border-t">
                        <div className="text-sm text-gray-600">
                          Confidence Range: {getConfidenceRange(
                            selectedZonePrediction.rent_confidence_min,
                            selectedZonePrediction.rent_confidence_max
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Investment Analysis */}
                <div className="mt-6">
                  <h3 className="text-lg font-semibold mb-4">Investment Analysis</h3>
                  <div className="bg-blue-50 p-4 rounded-lg">
                    {(() => {
                      const recommendation = getInvestmentRecommendation(
                        selectedZonePrediction.price_change_percent,
                        selectedZonePrediction.rent_change_percent,
                        selectedZonePrediction.investment_score
                      );
                      return (
                        <div className="flex items-start space-x-3">
                          {recommendation.level === 'high' ? (
                            <CheckCircle className="w-6 h-6 text-green-600 mt-1" />
                          ) : recommendation.level === 'medium' ? (
                            <Info className="w-6 h-6 text-blue-600 mt-1" />
                          ) : (
                            <AlertTriangle className="w-6 h-6 text-yellow-600 mt-1" />
                          )}
                          <div>
                            <p className="font-medium">
                              Investment Score: {selectedZonePrediction.investment_score}/100
                            </p>
                            <p className="text-sm text-gray-600 mt-1">
                              {recommendation.message}
                            </p>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default PredictionDashboard;
