import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import InteractiveMap from './components/InteractiveMap';
import PredictionForm from './components/PredictionForm';
import Favorites from './components/Favorites';
import Export from './components/Export';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/map" element={<InteractiveMap />} />
              <Route path="/predictions" element={<PredictionForm />} />
              <Route path="/favorites" element={<Favorites />} />
              <Route path="/export" element={<Export />} />
            </Routes>
          </div>
        </main>
      </div>
    </Router>
  );
}

export default App;
