import React, { useState } from 'react';
import { useAuth, useAuthenticatedFetch } from '../hooks/useAuth';
import { useFavorites } from '../hooks/useFavorites';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { 
  Download, 
  FileText, 
  Table, 
  Loader2, 
  CheckCircle,
  AlertTriangle,
  Calendar,
  Star,
  Settings,
  ExternalLink
} from 'lucide-react';

interface ExportOptions {
  format: 'csv' | 'pdf';
  includeZones: 'all' | 'favorites' | 'selected';
  selectedZones: string[];
  includePredictions: boolean;
  includePersonalNotes: boolean;
}

interface ExportHistory {
  export_type: string;
  created_at: string;
  parameters: string;
  file_size?: number;
}

export const ExportDashboard: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const { favorites } = useFavorites();
  const authenticatedFetch = useAuthenticatedFetch();
  
  const [options, setOptions] = useState<ExportOptions>({
    format: 'csv',
    includeZones: 'all',
    selectedZones: [],
    includePredictions: true,
    includePersonalNotes: true
  });
  
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });
  
  const [exportHistory, setExportHistory] = useState<ExportHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Load export history
  const loadExportHistory = async () => {
    if (!isAuthenticated) return;
    
    setLoadingHistory(true);
    try {
      const response = await authenticatedFetch('/api/export/history');
      if (response.ok) {
        const data = await response.json();
        setExportHistory(data.exports || []);
      }
    } catch (error) {
      console.error('Failed to load export history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Export data function
  const handleExport = async () => {
    if (!isAuthenticated) {
      setExportStatus({
        type: 'error',
        message: 'Please sign in to export data'
      });
      return;
    }

    setIsExporting(true);
    setExportStatus({ type: null, message: '' });

    try {
      let url = '';
      const params = new URLSearchParams();

      if (options.format === 'csv') {
        if (options.includeZones === 'favorites') {
          url = '/api/export/favorites/csv';
        } else {
          url = '/api/export/zones/csv';
          if (options.includeZones === 'selected' && options.selectedZones.length > 0) {
            params.append('zones', options.selectedZones.join(','));
          }
        }
      } else if (options.format === 'pdf') {
        url = '/api/export/report/pdf';
        if (options.includeZones === 'selected' && options.selectedZones.length > 0) {
          params.append('zones', options.selectedZones.join(','));
        }
        params.append('type', 'detailed');
      }

      const fullUrl = params.toString() ? `${url}?${params.toString()}` : url;
      const response = await authenticatedFetch(fullUrl);

      if (response.ok) {
        // Handle file download
        const contentDisposition = response.headers.get('content-disposition');
        const filename = contentDisposition
          ? contentDisposition.split('filename=')[1]?.replace(/"/g, '')
          : `export-${Date.now()}.${options.format === 'csv' ? 'csv' : 'html'}`;

        const blob = await response.blob();
        
        // Create download link
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        
        // Clean up
        link.remove();
        window.URL.revokeObjectURL(downloadUrl);

        setExportStatus({
          type: 'success',
          message: `Export completed successfully! Downloaded as ${filename}`
        });

        // Reload export history
        loadExportHistory();
      } else {
        const errorData = await response.json();
        setExportStatus({
          type: 'error',
          message: errorData.message || 'Export failed'
        });
      }
    } catch (error) {
      setExportStatus({
        type: 'error',
        message: 'Network error. Please try again.'
      });
      console.error('Export error:', error);
    } finally {
      setIsExporting(false);
    }
  };

  // Preview export function (for PDF)
  const handlePreview = async () => {
    if (options.format !== 'pdf') return;
    
    try {
      let url = '/api/export/report/pdf';
      const params = new URLSearchParams();
      
      if (options.includeZones === 'selected' && options.selectedZones.length > 0) {
        params.append('zones', options.selectedZones.join(','));
      }
      params.append('type', 'summary');

      const fullUrl = params.toString() ? `${url}?${params.toString()}` : url;
      const response = await authenticatedFetch(fullUrl);

      if (response.ok) {
        const html = await response.text();
        const previewWindow = window.open('', '_blank');
        if (previewWindow) {
          previewWindow.document.write(html);
          previewWindow.document.close();
        }
      }
    } catch (error) {
      console.error('Preview error:', error);
    }
  };

  React.useEffect(() => {
    if (isAuthenticated) {
      loadExportHistory();
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div className="text-center py-12">
        <Download className="w-16 h-16 mx-auto text-gray-400 mb-4" />
        <h3 className="text-xl font-semibold mb-2">Sign In to Export Data</h3>
        <p className="text-gray-600">
          Create an account to export your data and generate detailed reports
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Export Data</h2>
          <p className="text-gray-600">
            Export your zones, favorites, and analysis in various formats
          </p>
        </div>
        <Button 
          onClick={loadExportHistory}
          disabled={loadingHistory}
          variant="outline"
        >
          {loadingHistory ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Calendar className="w-4 h-4 mr-2" />
          )}
          History
        </Button>
      </div>

      <Tabs defaultValue="export" className="space-y-6">
        <TabsList>
          <TabsTrigger value="export">Export Settings</TabsTrigger>
          <TabsTrigger value="history">Export History</TabsTrigger>
        </TabsList>

        <TabsContent value="export">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Export Options */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Settings className="w-5 h-5 mr-2" />
                  Export Options
                </CardTitle>
                <CardDescription>
                  Configure your export settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Format Selection */}
                <div>
                  <Label className="text-base font-semibold">Export Format</Label>
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="csv-format"
                        checked={options.format === 'csv'}
                        onCheckedChange={() => setOptions(prev => ({ ...prev, format: 'csv' }))}
                      />
                      <Label htmlFor="csv-format" className="flex items-center cursor-pointer">
                        <Table className="w-4 h-4 mr-2" />
                        CSV Spreadsheet
                        <Badge variant="secondary" className="ml-2">Best for Excel</Badge>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="pdf-format"
                        checked={options.format === 'pdf'}
                        onCheckedChange={() => setOptions(prev => ({ ...prev, format: 'pdf' }))}
                      />
                      <Label htmlFor="pdf-format" className="flex items-center cursor-pointer">
                        <FileText className="w-4 h-4 mr-2" />
                        PDF Report
                        <Badge variant="secondary" className="ml-2">Formatted Report</Badge>
                      </Label>
                    </div>
                  </div>
                </div>

                {/* Zone Selection */}
                <div>
                  <Label className="text-base font-semibold">Zones to Include</Label>
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="all-zones"
                        checked={options.includeZones === 'all'}
                        onCheckedChange={() => setOptions(prev => ({ ...prev, includeZones: 'all' }))}
                      />
                      <Label htmlFor="all-zones">All zones (~100+ zones)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="favorites-zones"
                        checked={options.includeZones === 'favorites'}
                        onCheckedChange={() => setOptions(prev => ({ ...prev, includeZones: 'favorites' }))}
                      />
                      <Label htmlFor="favorites-zones" className="flex items-center">
                        <Star className="w-4 h-4 mr-1" />
                        My favorites ({favorites.length} zones)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="selected-zones"
                        checked={options.includeZones === 'selected'}
                        onCheckedChange={() => setOptions(prev => ({ ...prev, includeZones: 'selected' }))}
                      />
                      <Label htmlFor="selected-zones">Custom selection</Label>
                    </div>
                  </div>
                </div>

                {/* Custom Zone Selection */}
                {options.includeZones === 'selected' && (
                  <div>
                    <Label htmlFor="zone-ids">Zone IDs (comma-separated)</Label>
                    <input
                      id="zone-ids"
                      className="w-full mt-1 p-2 border rounded"
                      placeholder="e.g., MTL001, MTL002, MTL003"
                      value={options.selectedZones.join(', ')}
                      onChange={(e) => {
                        const zones = e.target.value.split(',').map(z => z.trim()).filter(Boolean);
                        setOptions(prev => ({ ...prev, selectedZones: zones }));
                      }}
                    />
                  </div>
                )}

                {/* Additional Options */}
                <div>
                  <Label className="text-base font-semibold">Additional Data</Label>
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="predictions"
                        checked={options.includePredictions}
                        onCheckedChange={(checked) => setOptions(prev => ({ ...prev, includePredictions: !!checked }))}
                      />
                      <Label htmlFor="predictions">Include AI predictions</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="notes"
                        checked={options.includePersonalNotes}
                        onCheckedChange={(checked) => setOptions(prev => ({ ...prev, includePersonalNotes: !!checked }))}
                      />
                      <Label htmlFor="notes">Include personal notes</Label>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Export Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Export Actions</CardTitle>
                <CardDescription>
                  Generate and download your data
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Status Messages */}
                {exportStatus.type && (
                  <Alert className={exportStatus.type === 'success' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                    {exportStatus.type === 'success' ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                    )}
                    <AlertDescription className={exportStatus.type === 'success' ? 'text-green-600' : 'text-red-600'}>
                      {exportStatus.message}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Export Summary */}
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  <h4 className="font-semibold">Export Summary</h4>
                  <div className="text-sm space-y-1">
                    <div>Format: <Badge variant="outline">{options.format.toUpperCase()}</Badge></div>
                    <div>Zones: <Badge variant="outline">
                      {options.includeZones === 'all' ? 'All zones' :
                       options.includeZones === 'favorites' ? `${favorites.length} favorites` :
                       `${options.selectedZones.length} selected`}
                    </Badge></div>
                    <div>Predictions: <Badge variant="outline">{options.includePredictions ? 'Yes' : 'No'}</Badge></div>
                    <div>Notes: <Badge variant="outline">{options.includePersonalNotes ? 'Yes' : 'No'}</Badge></div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2">
                  <Button
                    onClick={handleExport}
                    disabled={isExporting}
                    className="w-full"
                    size="lg"
                  >
                    {isExporting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Exporting...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-2" />
                        Export {options.format.toUpperCase()}
                      </>
                    )}
                  </Button>

                  {options.format === 'pdf' && (
                    <Button
                      onClick={handlePreview}
                      variant="outline"
                      className="w-full"
                      disabled={isExporting}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Preview Report
                    </Button>
                  )}
                </div>

                {/* Format Info */}
                <div className="text-sm text-gray-600 border-t pt-4">
                  {options.format === 'csv' ? (
                    <p>
                      <strong>CSV Format:</strong> Opens in Excel, Google Sheets, or any spreadsheet application.
                      Perfect for data analysis and filtering.
                    </p>
                  ) : (
                    <p>
                      <strong>PDF Format:</strong> Professional formatted report with charts and analysis.
                      Great for presentations and sharing.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Export History</CardTitle>
              <CardDescription>
                Your recent data exports and downloads
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingHistory ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin" />
                </div>
              ) : exportHistory.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Exports Yet</h3>
                  <p className="text-gray-600">
                    Your export history will appear here after you generate your first export
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {exportHistory.map((export_item, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                      <div className="flex items-center space-x-3">
                        {export_item.export_type.includes('csv') ? (
                          <Table className="w-5 h-5 text-green-600" />
                        ) : (
                          <FileText className="w-5 h-5 text-red-600" />
                        )}
                        <div>
                          <p className="font-medium capitalize">
                            {export_item.export_type.replace('_', ' ')}
                          </p>
                          <p className="text-sm text-gray-600">
                            {new Date(export_item.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        {export_item.file_size && (
                          <p className="text-sm text-gray-600">
                            {(export_item.file_size / 1024).toFixed(1)} KB
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ExportDashboard;
