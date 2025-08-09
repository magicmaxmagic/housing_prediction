import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Building2, Map, BarChart3, Heart, Download } from 'lucide-react';
import { AuthButton } from './AuthModal'

const Header: React.FC = () => {
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Dashboard', icon: BarChart3 },
    { path: '/map', label: 'Map', icon: Map },
    { path: '/predictions', label: 'Predictions', icon: BarChart3 },
    { path: '/favorites', label: 'Favorites', icon: Heart },
    { path: '/export', label: 'Export', icon: Download },
  ];

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Building2 className="h-8 w-8 text-blue-600" />
            <h1 className="ml-2 text-xl font-bold text-gray-900">InvestMTL</h1>
          </div>
          
          <nav className="hidden md:flex space-x-8">
            {navItems.map(({ path, label, icon: Icon }) => (
              <Link
                key={path}
                to={path}
                className={`flex items-center px-3 py-2 rounded-md text-sm font-medium ${
                  location.pathname === path
                    ? 'text-blue-600 bg-blue-50'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-4 h-4 mr-2" />
                {label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center">
            <AuthButton />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
