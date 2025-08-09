import React, { useState } from 'react';
import { Download, FileText, Table, BarChart3, Calendar, Mail, CheckCircle } from 'lucide-react';

const Export: React.FC = () => {
  const [exportType, setExportType] = useState<'pdf' | 'excel' | 'csv'>('pdf');
  const [reportType, setReportType] = useState<'portfolio' | 'market' | 'predictions' | 'favorites'>('portfolio');
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'quarter' | 'year'>('month');
  const [includeCharts, setIncludeCharts] = useState(true);
  const [includePredictions, setIncludePredictions] = useState(true);
  const [includeComparisons, setIncludeComparisons] = useState(false);
  const [emailReport, setEmailReport] = useState(false);
  const [email, setEmail] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    setExportSuccess(false);
    
    // Simulate export process
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    setIsExporting(false);
    setExportSuccess(true);
    
    // Hide success message after 5 seconds
    setTimeout(() => setExportSuccess(false), 5000);
  };

  const getReportIcon = (type: string) => {
    switch (type) {
      case 'portfolio': return <BarChart3 className="h-5 w-5" />;
      case 'market': return <TrendingUp className="h-5 w-5" />;
      case 'predictions': return <Target className="h-5 w-5" />;
      case 'favorites': return <Heart className="h-5 w-5" />;
      default: return <FileText className="h-5 w-5" />;
    }
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'pdf': return <FileText className="h-5 w-5 text-red-600" />;
      case 'excel': return <Table className="h-5 w-5 text-green-600" />;
      case 'csv': return <FileText className="h-5 w-5 text-blue-600" />;
      default: return <FileText className="h-5 w-5" />;
    }
  };

  // Mock data for recent exports
  const recentExports = [
    {
      id: '1',
      name: 'Portfolio Analysis Report',
      type: 'pdf',
      date: '2024-01-15',
      size: '2.3 MB',
      status: 'completed'
    },
    {
      id: '2',
      name: 'Market Data Export',
      type: 'excel',
      date: '2024-01-12',
      size: '5.1 MB',
      status: 'completed'
    },
    {
      id: '3',
      name: 'Property Predictions',
      type: 'csv',
      date: '2024-01-10',
      size: '1.8 MB',
      status: 'completed'
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Export & Reports</h1>
          <p className="text-gray-600">Generate and download comprehensive reports</p>
        </div>
        <Download className="h-8 w-8 text-blue-600" />
      </div>

      {/* Success Message */}
      {exportSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center">
          <CheckCircle className="h-5 w-5 text-green-600 mr-3" />
          <div>
            <p className="text-green-800 font-medium">Export completed successfully!</p>
            <p className="text-green-700 text-sm">Your report has been downloaded to your device.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Export Configuration */}
        <div className="lg:col-span-2 space-y-6">
          {/* Report Type Selection */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Report Configuration</h2>
            
            <div className="space-y-6">
              {/* Report Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Report Type</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'portfolio', label: 'Portfolio Analysis', desc: 'Complete portfolio overview' },
                    { key: 'market', label: 'Market Report', desc: 'Market trends and analysis' },
                    { key: 'predictions', label: 'Price Predictions', desc: 'ML-powered predictions' },
                    { key: 'favorites', label: 'Favorites Report', desc: 'Saved properties analysis' }
                  ].map((option) => (
                    <button
                      key={option.key}
                      onClick={() => setReportType(option.key as any)}
                      className={`p-4 rounded-lg border-2 text-left transition-colors ${
                        reportType === option.key
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center mb-2">
                        {getReportIcon(option.key)}
                        <span className="ml-2 font-medium">{option.label}</span>
                      </div>
                      <p className="text-sm text-gray-600">{option.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* File Format */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">File Format</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { key: 'pdf', label: 'PDF Report', desc: 'Professional document' },
                    { key: 'excel', label: 'Excel File', desc: 'Detailed spreadsheet' },
                    { key: 'csv', label: 'CSV Data', desc: 'Raw data export' }
                  ].map((format) => (
                    <button
                      key={format.key}
                      onClick={() => setExportType(format.key as any)}
                      className={`p-4 rounded-lg border-2 text-center transition-colors ${
                        exportType === format.key
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex justify-center mb-2">
                        {getFileIcon(format.key)}
                      </div>
                      <div className="font-medium text-sm">{format.label}</div>
                      <div className="text-xs text-gray-600">{format.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Date Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="week">Last Week</option>
                  <option value="month">Last Month</option>
                  <option value="quarter">Last Quarter</option>
                  <option value="year">Last Year</option>
                </select>
              </div>

              {/* Advanced Options */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Report Options</label>
                <div className="space-y-3">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={includeCharts}
                      onChange={(e) => setIncludeCharts(e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">Include charts and visualizations</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={includePredictions}
                      onChange={(e) => setIncludePredictions(e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">Include ML predictions</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={includeComparisons}
                      onChange={(e) => setIncludeComparisons(e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">Include market comparisons</span>
                  </label>
                </div>
              </div>

              {/* Email Options */}
              <div>
                <label className="flex items-center mb-3">
                  <input
                    type="checkbox"
                    checked={emailReport}
                    onChange={(e) => setEmailReport(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm font-medium text-gray-700">Email report to me</span>
                </label>
                {emailReport && (
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email address"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
              </div>

              {/* Generate Button */}
              <button
                onClick={handleExport}
                disabled={isExporting}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isExporting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Generating Report...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Generate Report
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Recent Exports & Templates */}
        <div className="space-y-6">
          {/* Report Preview */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Report Preview</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Type:</span>
                <span className="font-medium capitalize">{reportType.replace('_', ' ')}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Format:</span>
                <span className="font-medium uppercase">{exportType}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Period:</span>
                <span className="font-medium capitalize">{dateRange}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Charts:</span>
                <span className="font-medium">{includeCharts ? 'Yes' : 'No'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Predictions:</span>
                <span className="font-medium">{includePredictions ? 'Yes' : 'No'}</span>
              </div>
            </div>
          </div>

          {/* Recent Exports */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Exports</h3>
            <div className="space-y-3">
              {recentExports.map((export_item) => (
                <div key={export_item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    {getFileIcon(export_item.type)}
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-900">{export_item.name}</p>
                      <p className="text-xs text-gray-600">{export_item.date} • {export_item.size}</p>
                    </div>
                  </div>
                  <button className="p-1 text-gray-600 hover:text-blue-600">
                    <Download className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <button className="w-full p-3 text-left bg-blue-50 hover:bg-blue-100 rounded-lg flex items-center">
                <BarChart3 className="h-5 w-5 text-blue-600 mr-3" />
                <span className="text-blue-900 font-medium">Weekly Summary</span>
              </button>
              <button className="w-full p-3 text-left bg-green-50 hover:bg-green-100 rounded-lg flex items-center">
                <Mail className="h-5 w-5 text-green-600 mr-3" />
                <span className="text-green-900 font-medium">Email Template</span>
              </button>
              <button className="w-full p-3 text-left bg-purple-50 hover:bg-purple-100 rounded-lg flex items-center">
                <Calendar className="h-5 w-5 text-purple-600 mr-3" />
                <span className="text-purple-900 font-medium">Schedule Report</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Missing imports - let's fix them
import { TrendingUp, Target, Heart } from 'lucide-react';

export default Export;
