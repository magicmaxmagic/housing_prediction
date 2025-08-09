import React from 'react';
import { Building2, TrendingUp, MapPin, BarChart3 } from 'lucide-react';

const Dashboard: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Investment Dashboard</h1>
        <p className="text-gray-600">Montreal real estate investment analysis</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <Building2 className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Zones</p>
              <p className="text-2xl font-bold text-gray-900">156</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <TrendingUp className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Avg ROI</p>
              <p className="text-2xl font-bold text-gray-900">8.4%</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <MapPin className="h-8 w-8 text-purple-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Best Zone</p>
              <p className="text-2xl font-bold text-gray-900">MTL-001</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <BarChart3 className="h-8 w-8 text-orange-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Properties</p>
              <p className="text-2xl font-bold text-gray-900">25,847</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Investment Zones</h2>
          <div className="space-y-3">
            {[
              { id: 'MTL-001', name: 'Downtown Core', score: 95 },
              { id: 'MTL-002', name: 'Plateau Mont-Royal', score: 89 },
              { id: 'MTL-003', name: 'Mile End', score: 87 },
              { id: 'MTL-004', name: 'Griffintown', score: 85 },
              { id: 'MTL-005', name: 'Old Montreal', score: 83 }
            ].map((zone) => (
              <div key={zone.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                <div>
                  <p className="font-medium text-gray-900">{zone.name}</p>
                  <p className="text-sm text-gray-600">{zone.id}</p>
                </div>
                <div className="text-right">
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                    zone.score >= 90 ? 'bg-green-100 text-green-800' :
                    zone.score >= 80 ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {zone.score}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Market Activity</h2>
          <div className="space-y-3">
            <div className="border-l-4 border-blue-500 pl-4">
              <p className="font-medium text-gray-900">New Properties Added</p>
              <p className="text-sm text-gray-600">247 new listings in the last 30 days</p>
            </div>
            <div className="border-l-4 border-green-500 pl-4">
              <p className="font-medium text-gray-900">Price Trend</p>
              <p className="text-sm text-gray-600">Average prices up 2.3% this month</p>
            </div>
            <div className="border-l-4 border-orange-500 pl-4">
              <p className="font-medium text-gray-900">Market Analysis</p>
              <p className="text-sm text-gray-600">AI predictions updated for 156 zones</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-blue-50 p-6 rounded-lg">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-4">
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            View Interactive Map
          </button>
          <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
            Get AI Predictions
          </button>
          <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
            Export Data
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
