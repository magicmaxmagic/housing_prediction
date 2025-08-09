import React, { useState } from 'react'
import MapView from './components/MapView'
import SidePanel from './components/SidePanel'
import ScoreLegend from './components/ScoreLegend'
import CompareDrawer from './components/CompareDrawer'
import { AreaData, ScoringWeights } from './lib/api'

const DEFAULT_WEIGHTS: ScoringWeights = {
  growth: 0.25,
  supply: 0.20,
  tension: 0.20,
  accessibility: 0.20,
  returns: 0.15,
}

function App() {
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null)
  const [scoringWeights, setScoringWeights] = useState<ScoringWeights>(DEFAULT_WEIGHTS)
  const [comparedAreas, setComparedAreas] = useState<AreaData[]>([])
  const [showCompareDrawer, setShowCompareDrawer] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)

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
    <div className={`h-screen flex ${isDarkMode ? 'dark' : ''}`}>
      {/* Side Panel */}
      <SidePanel
        selectedAreaId={selectedAreaId}
        scoringWeights={scoringWeights}
        onWeightsChange={handleWeightsChange}
        onCompareArea={handleCompareArea}
        isDarkMode={isDarkMode}
        onToggleDarkMode={toggleDarkMode}
      />

      {/* Main Map Area */}
      <div className="flex-1 relative">
        <MapView
          onAreaSelect={handleAreaSelect}
          selectedAreaId={selectedAreaId}
          scoringWeights={scoringWeights}
        />

        {/* Map Legend */}
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

        {/* Header */}
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10">
          <div className="bg-white dark:bg-gray-800 px-6 py-3 rounded-lg shadow-lg">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              InvestMTL
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Montreal Housing Investment Analysis
            </p>
          </div>
        </div>
      </div>

      {/* Compare Drawer */}
      {showCompareDrawer && (
        <CompareDrawer
          comparedAreas={comparedAreas}
          onClose={() => setShowCompareDrawer(false)}
          onRemoveArea={handleRemoveFromComparison}
        />
      )}
    </div>
  )
}

export default App
