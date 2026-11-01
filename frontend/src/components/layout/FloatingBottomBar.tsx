import React from 'react';
import { Compass, Home, Library, Search } from 'lucide-react';
import { NavTab } from './DesktopSidebar';

interface FloatingBottomBarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
}

export const FloatingBottomBar: React.FC<FloatingBottomBarProps> = ({ currentTab, onSelectTab }) => {
  const tabs = [
    { id: 'home' as NavTab, label: 'Listen Now', icon: Home },
    { id: 'explore' as NavTab, label: 'Explore', icon: Compass },
    { id: 'library' as NavTab, label: 'Library', icon: Library },
    { id: 'search' as NavTab, label: 'Search', icon: Search },
  ];

  return (
    <nav className="md:hidden fixed bottom-3 left-4 right-4 z-40 max-w-md mx-auto liquid-glass rounded-full px-3 py-2 shadow-2xl flex items-center justify-around select-none">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = currentTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onSelectTab(tab.id)}
            className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-full transition-all duration-200 ${
              isActive
                ? 'text-accent-red font-semibold scale-105 drop-shadow-[0_0_12px_rgba(250,45,72,0.5)]'
                : 'text-white/60 hover:text-white active:scale-95'
            }`}
          >
            <Icon className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] tracking-tight">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

