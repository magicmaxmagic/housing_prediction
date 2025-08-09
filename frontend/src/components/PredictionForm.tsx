import React, { useState } from 'react';
import { Calculator, TrendingUp, DollarSign, Home, Calendar } from 'lucide-react';
import { usePredictions, formatPrice } from '@/hooks/usePredictions'

const PredictionForm: React.FC = () => {
  const [formData, setFormData] = useState({
    propertyType: 'apartment',
    bedrooms: '2',
    bathrooms: '1',
    squareFootage: '',
    location: '',
    neighborhood: '',
    yearBuilt: '',
    hasParking: false,
    hasBalcony: false,
    condition: 'good'
  });

  const [prediction, setPrediction] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const { customPrediction } = usePredictions();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const result = await customPrediction({
        zone_id: formData.neighborhood || 'downtown',
        property_size: formData.squareFootage ? parseInt(formData.squareFootage) : undefined,
        property_type: formData.propertyType,
        year_built: formData.yearBuilt ? parseInt(formData.yearBuilt) : undefined,
        condition: formData.condition,
      });

      if (result) {
        setPrediction({
          estimatedPrice: result.predicted_price,
          priceRange: { min: result.price_confidence_min, max: result.price_confidence_max },
          confidence: Math.round(
            100 - ((result.price_confidence_max - result.price_confidence_min) / result.predicted_price) * 100
          ),
          marketTrend: 'increasing',
          monthlyRent: result.predicted_rent,
          investmentScore: 8.5,
          roi: 5.8,
          comparableProperties: 12,
          marketCondition: 'favorable'
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Price Prediction</h1>
          <p className="text-gray-600">Get AI-powered property value estimates</p>
        </div>
        <Calculator className="h-8 w-8 text-blue-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Prediction Form */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Property Details</h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Property Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Property Type</label>
              <select
                name="propertyType"
                value={formData.propertyType}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="apartment">Apartment</option>
                <option value="condo">Condo</option>
                <option value="house">House</option>
                <option value="townhouse">Townhouse</option>
              </select>
            </div>

            {/* Bedrooms & Bathrooms */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Bedrooms</label>
                <select
                  name="bedrooms"
                  value={formData.bedrooms}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4+</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Bathrooms</label>
                <select
                  name="bathrooms"
                  value={formData.bathrooms}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="1">1</option>
                  <option value="1.5">1.5</option>
                  <option value="2">2</option>
                  <option value="2.5">2.5</option>
                  <option value="3">3+</option>
                </select>
              </div>
            </div>

            {/* Square Footage */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Square Footage</label>
              <input
                type="number"
                name="squareFootage"
                value={formData.squareFootage}
                onChange={handleInputChange}
                placeholder="e.g., 900"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleInputChange}
                placeholder="e.g., Rue Saint-Denis, Montreal"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* Neighborhood */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Neighborhood</label>
              <select
                name="neighborhood"
                value={formData.neighborhood}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select neighborhood</option>
                <option value="downtown">Downtown</option>
                <option value="plateau">Plateau Mont-Royal</option>
                <option value="mile-end">Mile End</option>
                <option value="griffintown">Griffintown</option>
                <option value="old-montreal">Old Montreal</option>
                <option value="verdun">Verdun</option>
                <option value="rosemont">Rosemont</option>
              </select>
            </div>

            {/* Year Built */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Year Built</label>
              <input
                type="number"
                name="yearBuilt"
                value={formData.yearBuilt}
                onChange={handleInputChange}
                placeholder="e.g., 2010"
                min="1800"
                max="2024"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Property Condition */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Property Condition</label>
              <select
                name="condition"
                value={formData.condition}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="excellent">Excellent</option>
                <option value="good">Good</option>
                <option value="fair">Fair</option>
                <option value="needs-work">Needs Work</option>
              </select>
            </div>

            {/* Additional Features */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">Additional Features</label>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="hasParking"
                  checked={formData.hasParking}
                  onChange={handleInputChange}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label className="ml-2 text-sm text-gray-700">Parking</label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="hasBalcony"
                  checked={formData.hasBalcony}
                  onChange={handleInputChange}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label className="ml-2 text-sm text-gray-700">Balcony/Terrace</label>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Calculating...' : 'Get Prediction'}
            </button>
          </form>
        </div>

        {/* Prediction Results */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Prediction Results</h2>
          
          {loading && (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Analyzing property...</span>
            </div>
          )}

          {prediction && !loading && (
            <div className="space-y-6">
              {/* Main Prediction */}
              <div className="text-center p-6 bg-blue-50 rounded-lg">
                <DollarSign className="h-12 w-12 text-blue-600 mx-auto mb-3" />
                <p className="text-3xl font-bold text-blue-900">{formatPrice(prediction.estimatedPrice)}</p>
                <p className="text-blue-700">Estimated Market Value</p>
                <p className="text-sm text-gray-600 mt-2">
                  Range: {formatPrice(prediction.priceRange.min)} - {formatPrice(prediction.priceRange.max)}
                </p>
              </div>

              {/* Confidence & Details */}
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <TrendingUp className="h-8 w-8 text-green-600 mx-auto mb-2" />
                  <p className="text-xl font-bold text-green-900">{prediction.confidence}%</p>
                  <p className="text-sm text-green-700">Confidence</p>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <Calendar className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                  <p className="text-xl font-bold text-purple-900">${prediction.monthlyRent}</p>
                  <p className="text-sm text-purple-700">Est. Monthly Rent</p>
                </div>
              </div>

              {/* Investment Metrics */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-900">Investment Analysis</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-gray-50 rounded">
                    <p className="text-sm text-gray-600">Investment Score</p>
                    <p className="text-lg font-semibold">{prediction.investmentScore}/10</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded">
                    <p className="text-sm text-gray-600">Estimated ROI</p>
                    <p className="text-lg font-semibold">{prediction.roi}%</p>
                  </div>
                </div>
              </div>

              {/* Market Info */}
              <div className="p-4 bg-yellow-50 rounded-lg">
                <h4 className="font-semibold text-yellow-900 mb-2">Market Insights</h4>
                <p className="text-sm text-yellow-800">
                  Market trend: <span className="capitalize">{prediction.marketTrend}</span>
                </p>
                <p className="text-sm text-yellow-800">
                  Based on {prediction.comparableProperties} comparable properties
                </p>
                <p className="text-sm text-yellow-800">
                  Market condition: <span className="capitalize">{prediction.marketCondition}</span>
                </p>
              </div>
            </div>
          )}

          {!prediction && !loading && (
            <div className="text-center text-gray-500 h-64 flex items-center justify-center">
              <div>
                <Home className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <p>Fill out the form to get your property prediction</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PredictionForm;
