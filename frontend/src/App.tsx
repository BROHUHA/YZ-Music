import React, { useEffect } from 'react';
import { AppShell } from './components/layout/AppShell';
import { useSettingsStore } from './stores/settingsStore';

export const App: React.FC = () => {
  const { accentColor, themeMode } = useSettingsStore();

  useEffect(() => {
    document.documentElement.style.setProperty('--accent-color', accentColor);
    if (themeMode === 'DARK' || (themeMode === 'SYSTEM' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [accentColor, themeMode]);

  return <AppShell />;
};

export default App;

