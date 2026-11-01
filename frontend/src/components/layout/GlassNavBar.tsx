import React from 'react';
import { NavTab } from './DesktopSidebar';
import { MiniPlayer } from '../player/MiniPlayer';
import { usePlayerStore } from '../../stores/playerStore';

interface GlassNavBarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  isInline: boolean;
  onExpand: () => void;
}

export const GlassNavBar: React.FC<GlassNavBarProps> = ({
  currentTab,
  onSelectTab,
  isInline,
  onExpand,
}) => {
  const { currentSong, isNowPlayingOpen } = usePlayerStore();

  const tabs: { id: NavTab; label: string }[] = [
    { id: 'home', label: 'Home' },
    { id: 'explore', label: 'Explore' },
    { id: 'library', label: 'Library' },
  ];

  const renderTabIcon = (tabId: NavTab, isActive: boolean) => {
    switch (tabId) {
      case 'home':
        return (
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill={isActive ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth={isActive ? '0' : '2'}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 10.5L12 3l9 7.5V20a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9.5z" />
          </svg>
        );
      case 'explore':
        return (
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill={isActive ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth={isActive ? '0' : '2'}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="7.5" height="7.5" rx="2.5" />
            <rect x="13.5" y="3" width="7.5" height="7.5" rx="2.5" />
            <rect x="3" y="13.5" width="7.5" height="7.5" rx="2.5" />
            <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2.5" />
          </svg>
        );
      case 'library':
        return (
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill={isActive ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M8 3.5h8" strokeWidth="2.5" />
            <rect x="4" y="6.5" width="16" height="14" rx="3.5" />
          </svg>
        );
      case 'search':
        return (
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.5" y2="16.5" />
          </svg>
        );
    }
  };

  const isSearchActive = currentTab === 'search';

  return (
    <nav
      aria-label="Mobile Navigation"
      style={{
        transition: 'opacity 220ms ease, transform 240ms cubic-bezier(0.2, 0, 0, 1)',
      }}
      className={`md:hidden fixed bottom-3 inset-x-3 z-40 max-w-md mx-auto select-none pointer-events-auto will-change-transform ${
        isNowPlayingOpen ? 'opacity-0 translate-y-12 pointer-events-none' : 'opacity-100 translate-y-0'
      }`}
    >
      {/* Container with relative positioning anchored at bottom */}
      <div className="relative w-full flex flex-col items-center justify-end">
        {/* 1. ExpandedBar: AnimatedContent targetState = false */}
        <div
          style={{
            transition: 'opacity 200ms ease, transform 220ms cubic-bezier(0.2, 0, 0, 1)',
          }}
          className={`flex flex-col items-center gap-2 w-full will-change-[opacity,transform] ${
            !isInline
              ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto relative z-10'
              : 'opacity-0 scale-95 translate-y-3 pointer-events-none absolute bottom-0 inset-x-0 z-0'
          }`}
        >
          {/* Expanded Accessory: Full-width player pill */}
          {currentSong && <MiniPlayer isInline={false} />}

          {/* Tab Row: [Home, Explore, Library pill] + [Search circle] */}
          <div className="flex items-center gap-2 w-full">
            <div className="h-14 rounded-full liquid-glass-surface flex-1 px-2 flex items-center justify-around shadow-2xl">
              {tabs.map((tab) => {
                const isActive = currentTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => onSelectTab(tab.id)}
                    className={`flex flex-col items-center justify-center py-1 px-3 rounded-full transition-all duration-150 cursor-pointer ${
                      isActive
                        ? 'text-white scale-105 drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)] font-bold'
                        : 'text-white/60 hover:text-white active:scale-95 font-medium'
                    }`}
                  >
                    <div className="w-6 h-6 flex items-center justify-center shrink-0">
                      {renderTabIcon(tab.id, isActive)}
                    </div>
                    <span className="text-[11px] tracking-tight leading-none mt-0.5">
                      {tab.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Standalone Search Circle */}
            <button
              onClick={() => onSelectTab('search')}
              className={`w-14 h-14 rounded-full liquid-glass-surface flex items-center justify-center shrink-0 active:scale-90 transition-transform duration-150 cursor-pointer shadow-2xl ${
                isSearchActive
                  ? 'text-white ring-2 ring-white/50 shadow-[0_0_20px_rgba(255,255,255,0.25)]'
                  : 'text-white/75 hover:text-white'
              }`}
              title="Search"
              aria-label="Search"
            >
              {renderTabIcon('search', isSearchActive)}
            </button>
          </div>
        </div>

        {/* 2. InlineBar: AnimatedContent targetState = true (Morphs into single 56px row on scroll down) */}
        <div
          style={{
            transition: 'opacity 200ms ease, transform 220ms cubic-bezier(0.2, 0, 0, 1)',
          }}
          className={`flex items-center gap-2 w-full will-change-[opacity,transform] ${
            isInline
              ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto relative z-10'
              : 'opacity-0 scale-95 translate-y-3 pointer-events-none absolute bottom-0 inset-x-0 z-0'
          } ${!currentSong ? 'justify-center max-w-[130px] mx-auto' : ''}`}
        >
          {/* InlineTab: Single Active Tab Circle (Tap to expand) */}
          <button
            onClick={onExpand}
            className="w-14 h-14 rounded-full liquid-glass-surface flex items-center justify-center shrink-0 cursor-pointer active:scale-90 hover:scale-105 shadow-2xl transition-transform duration-150"
            title="Tap to expand navigation tabs"
            aria-label="Expand tabs"
          >
            <div className="w-6 h-6 flex items-center justify-center text-white scale-105 drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]">
              {renderTabIcon(currentTab === 'search' ? 'home' : currentTab, true)}
            </div>
          </button>

          {/* InlineAccessory: Compact MiniPlayer (takes remaining center space) */}
          {currentSong && <MiniPlayer isInline={true} className="flex-1 min-w-0" />}

          {/* Standalone Search Circle */}
          <button
            onClick={() => {
              onExpand();
              onSelectTab('search');
            }}
            className={`w-14 h-14 rounded-full liquid-glass-surface flex items-center justify-center shrink-0 active:scale-90 transition-transform duration-150 cursor-pointer shadow-2xl ${
              isSearchActive
                ? 'text-white ring-2 ring-white/50 shadow-[0_0_20px_rgba(255,255,255,0.25)]'
                : 'text-white/75 hover:text-white'
            }`}
            title="Search"
            aria-label="Search"
          >
            {renderTabIcon('search', isSearchActive)}
          </button>
        </div>
      </div>
    </nav>
  );
};
