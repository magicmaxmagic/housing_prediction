import React from 'react';

interface ScoreLegendProps {
  className?: string;
}

const legendItems = [
  { range: '80-100', label: 'Excellent', color: 'bg-green-500', textColor: 'text-green-700' },
  { range: '60-79', label: 'Très bon', color: 'bg-lime-500', textColor: 'text-lime-700' },
  { range: '40-59', label: 'Bon', color: 'bg-yellow-500', textColor: 'text-yellow-700' },
  { range: '20-39', label: 'Moyen', color: 'bg-orange-500', textColor: 'text-orange-700' },
  { range: '0-19', label: 'Faible', color: 'bg-red-500', textColor: 'text-red-700' }
];

export const ScoreLegend: React.FC<ScoreLegendProps> = ({ className = '' }) => {
  return (
    <div className={`bg-white rounded-lg shadow-lg border p-3 ${className}`}>
      <h3 className="text-sm font-semibold text-gray-900 mb-2">Score d'investissement</h3>
      <div className="space-y-1">
        {legendItems.map((item) => (
          <div key={item.range} className="flex items-center space-x-2 text-xs">
            <div className={`w-3 h-3 rounded-full ${item.color} flex-shrink-0`} />
            <span className={`font-medium ${item.textColor}`}>{item.label}</span>
            <span className="text-gray-500">({item.range})</span>
          </div>
        ))}
      </div>
      <div className="mt-2 pt-2 border-t border-gray-100">
        <p className="text-xs text-gray-500">
          Basé sur croissance, offre, tension, accessibilité et rendement
        </p>
      </div>
    </div>
  );
};
