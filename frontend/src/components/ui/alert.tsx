import * as React from 'react';

export const Alert: React.FC<{ className?: string; children: React.ReactNode }>= ({ className = '', children }) => (
  <div className={`rounded-md border p-3 ${className}`}>{children}</div>
);

export const AlertDescription: React.FC<{ className?: string; children: React.ReactNode }>= ({ className = '', children }) => (
  <div className={`text-sm ${className}`}>{children}</div>
);
