import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Original components
import MapView from './components/MapView'
import RealEstateData from './components/RealEstateData'
import { SidePanel } from './components/SidePanel'
import { ScoreLegend } from './components/ScoreLegend'
import { CompareDrawer } from './components/CompareDrawer'
import { AreaData, ScoringWeights } from './lib/api'

// New components
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import ZoneDetail from './components/ZoneDetail';
import InteractiveMap from './components/InteractiveMap';
import PredictionDashboard from './components/PredictionDashboard';
import FavoritesDashboard from './components/FavoritesDashboard';
import ExportDashboard from './components/ExportDashboard';
import { AuthButton } from './components/AuthModal';

// Providers
import { AuthProvider } from './hooks/useAuth';

import { Map, Building2 } from 'lucide-react'

const queryClient = new QueryClient();

const DEFAULT_WEIGHTS: ScoringWeights = {
  growth: 0.25,
  supply: 0.20,
  tension: 0.20,
  access: 0.20,
  return: 0.15,
}

function InvestMTLApp() {
  const [selectedZone, setSelectedZone] = useState<string | null>(null);

  const handleZoneSelect = (zoneId: string) => {
    setSelectedZone(zoneId);
  };

  return (
    <div className="space-y-6">
      <Routes>
        <Route 
          path="/dashboard" 
          element={
            <Dashboard 
              selectedZone={selectedZone}
              onZoneSelect={handleZoneSelect}
            />
          } 
        />
        <Route path="/zone/:zoneId" element={<ZoneDetail />} />
        <Route 
          path="/map" 
          element={
            <div className="space-y-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Interactive Map</h1>
                <p className="text-gray-600">Explore Montreal investment zones on an interactive map</p>
              </div>
              <InteractiveMap 
                selectedZone={selectedZone}
                onZoneSelect={handleZoneSelect}
              />
            </div>
          } 
        />
        <Route 
          path="/predictions" 
          element={
            <PredictionDashboard 
              selectedZone={selectedZone}
              onZoneSelect={handleZoneSelect}
            />
          } 
        />
        <Route 
          path="/favorites" 
          element={
            <FavoritesDashboard 
              onZoneSelect={handleZoneSelect}
            />
          } 
        />
        <Route path="/export" element={<ExportDashboard />} />
      </Routes>
    </div>
  );
}

function OriginalApp() {
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null)
  const [scoringWeights, setScoringWeights] = useState<ScoringWeights>(DEFAULT_WEIGHTS)
  const [comparedAreas, setComparedAreas] = useState<AreaData[]>([])
  const [showCompareDrawer, setShowCompareDrawer] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [activeTab, setActiveTab] = useState<'map' | 'data' | 'investmtl'>('map')

  const handleAreaSelect = (areaId: string) => {
    setSelectedAreaId(areaId)
  }

  const handleWeightsChange = (newWeights: ScoringWeights) => {
    setScoringWeights(newWeights)
  }

  const handleCompareArea = (area: AreaData) => {
    if (comparedAreas.length < 3 && !comparedAreas.find(a => a.id === area.id)) {
      setComparedAreas([...comparedAreas, area])
    }
  }

  const handleRemoveFromComparison = (areaId: string) => {
    setComparedAreas(comparedAreas.filter(area => area.id !== areaId))
  }

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode)
    document.documentElement.classList.toggle('dark')
  }

  React.useEffect(() => {
    // Set initial dark mode based on system preference
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setIsDarkMode(true)
      document.documentElement.classList.add('dark')
    }
  }, [])

  return (
    <div className={`h-screen ${isDarkMode ? 'dark' : ''}`}>
      {/* Header avec navigation par onglets */}
      <div className="bg-white dark:bg-gray-800 shadow-md z-20 relative">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                InvestMTL
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Montreal Housing Investment Analysis
              </p>
            </div>
            
            {/* Navigation par onglets */}
            <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              <button
                onClick={() => setActiveTab('map')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'map'
                    ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Map className="h-4 w-4" />
                Carte & Analyse
              </button>
              <button
                onClick={() => setActiveTab('data')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'data'
                    ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Building2 className="h-4 w-4" />
                Données Immobilières
              </button>
            </div>
            
            {/* Dark mode toggle */}
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              {isDarkMode ? '☀️' : '🌙'}
            </button>
          </div>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="h-[calc(100vh-80px)] relative">
        {activeTab === 'map' && (
          <div className="flex h-full">
            {/* Side Panel */}
            <SidePanel
              selectedArea={selectedAreaId}
              weights={scoringWeights}
              onWeightsChange={handleWeightsChange}
            />

            {/* Map Container */}
            <div className="flex-1 relative">
              <MapView
                selectedAreaId={selectedAreaId}
                onAreaSelect={handleAreaSelect}
                scoringWeights={scoringWeights}
              />

              {/* Legend */}
              <div className="absolute bottom-4 left-4 z-10">
                <ScoreLegend />
              </div>

              {/* Compare Button */}
              {comparedAreas.length > 0 && (
                <button
                  onClick={() => setShowCompareDrawer(true)}
                  className="absolute top-4 right-4 bg-primary text-primary-foreground px-4 py-2 rounded-md shadow-lg hover:bg-primary/90 transition-colors z-10"
                >
                  Compare Areas ({comparedAreas.length})
                </button>
              )}
            </div>

            {/* Compare Drawer */}
            {showCompareDrawer && (
              <CompareDrawer
                onClose={() => setShowCompareDrawer(false)}
                onRemoveArea={handleRemoveFromComparison}
              />
            )}
          </div>
        )}
        
        {activeTab === 'data' && (
          <div className="h-full overflow-auto">
            <RealEstateData />
          </div>
        )}
      </div>
    </div>
  )
}

export default App
