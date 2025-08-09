import * as React from 'react';

interface TabsContextValue {
  value: string;
  setValue: (v: string) => void;
}

const TabsContext = React.createContext<TabsContextValue | null>(null);

type TabsProps = {
  value?: string;
  defaultValue?: string;
  onValueChange?: (v: string) => void;
  className?: string;
  children: React.ReactNode;
};

export const Tabs: React.FC<TabsProps> = ({ value, defaultValue, onValueChange, className = '', children }) => {
  const isControlled = value !== undefined && onValueChange !== undefined;
  const [internal, setInternal] = React.useState<string>(defaultValue || '');
  const current = isControlled ? (value as string) : internal;
  const setValue = (v: string) => {
    if (isControlled) {
      onValueChange && onValueChange(v);
    } else {
      setInternal(v);
    }
  };
  React.useEffect(() => {
    if (!isControlled && defaultValue && internal === '') {
      setInternal(defaultValue);
    }
  }, [defaultValue, isControlled, internal]);

  return (
    <TabsContext.Provider value={{ value: current, setValue }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
};

export const TabsList: React.FC<{ className?: string; children: React.ReactNode }> = ({ className = '', children }) => (
  <div className={`inline-grid gap-2 rounded-md bg-gray-100 p-1 ${className}`}>{children}</div>
);

export const TabsTrigger: React.FC<{ value: string; children: React.ReactNode }> = ({ value, children }) => {
  const ctx = React.useContext(TabsContext);
  if (!ctx) return <button className="px-3 py-2 text-sm rounded-md">{children}</button>;
  const active = ctx.value === value;
  return (
    <button
      onClick={() => ctx.setValue(value)}
      className={`px-3 py-2 text-sm rounded-md ${active ? 'bg-white text-blue-600 shadow' : 'text-gray-700 hover:bg-white/70'}`}
    >
      {children}
    </button>
  );
};

export const TabsContent: React.FC<{ value: string; className?: string; children: React.ReactNode }> = ({ value, className = '', children }) => {
  const ctx = React.useContext(TabsContext);
  if (!ctx) return <div className={className}>{children}</div>;
  return ctx.value === value ? <div className={`mt-4 ${className}`}>{children}</div> : null;
};
