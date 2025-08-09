import { useState } from 'react'
import RealEstateData from './components/RealEstateData'
import { Map, Building2 } from 'lucide-react'

function App() {
  const [activeTab, setActiveTab] = useState<'map' | 'data'>('data')
  const [isDarkMode, setIsDarkMode] = useState(false)

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode)
    document.documentElement.classList.toggle('dark')
  }

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
          <div className="flex items-center justify-center h-full bg-gray-100 dark:bg-gray-900">
            <div className="text-center">
              <Map className="h-24 w-24 mx-auto mb-4 text-gray-400" />
              <h2 className="text-xl font-semibold text-gray-600 dark:text-gray-300 mb-2">
                Vue Carte
              </h2>
              <p className="text-gray-500 dark:text-gray-400">
                La vue carte sera disponible prochainement
              </p>
            </div>
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
