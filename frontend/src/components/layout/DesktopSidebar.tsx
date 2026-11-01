import React, { useState } from 'react';
import { Compass, Home, Library, Search, User, Users, Sliders, Settings } from 'lucide-react';
import { YouTubeMusicLogo } from '../common/YouTubeMusicLogo';
import { useAuthStore } from '../../stores/authStore';

export type NavTab = 'home' | 'explore' | 'library' | 'search';

interface DesktopSidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenAccount?: () => void;
  onOpenSettings?: () => void;
  onOpenEqualizer?: () => void;
  onOpenListenTogether?: () => void;
  isSettingsOpen?: boolean;
  isEqualizerOpen?: boolean;
  isListenTogetherOpen?: boolean;
}

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({
  currentTab,
  onSelectTab,
  onOpenAccount,
  onOpenSettings,
  onOpenEqualizer,
  onOpenListenTogether,
  isSettingsOpen = false,
  isEqualizerOpen = false,
  isListenTogetherOpen = false,
}) => {
  const { isSignedIn, account } = useAuthStore();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      return localStorage.getItem('sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('sidebar_collapsed', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const navItems = [
    { id: 'home' as const, label: 'Listen Now', icon: Home, onClick: () => onSelectTab('home') },
    { id: 'explore' as const, label: 'Explore', icon: Compass, onClick: () => onSelectTab('explore') },
    { id: 'library' as const, label: 'Library', icon: Library, onClick: () => onSelectTab('library') },
    { id: 'search' as const, label: 'Search', icon: Search, onClick: () => onSelectTab('search') },
    ...(onOpenEqualizer
      ? [{ id: 'equalizer' as const, label: 'Equalizer', icon: Sliders, onClick: onOpenEqualizer }]
      : []),
    ...(onOpenListenTogether
      ? [{ id: 'listen-together' as const, label: 'Listen Together', icon: Users, onClick: onOpenListenTogether }]
      : []),
    ...(onOpenSettings
      ? [{ id: 'settings' as const, label: 'Settings', icon: Settings, onClick: onOpenSettings }]
      : []),
  ];

  // Determine active item id: accounts for modals if opened, otherwise currentTab
  const activeId = isSettingsOpen
    ? 'settings'
    : isEqualizerOpen
    ? 'equalizer'
    : isListenTogetherOpen
    ? 'listen-together'
    : currentTab;

  const activeIndex = navItems.findIndex((it) => it.id === activeId);

  return (
    <aside
      className={`hidden md:flex flex-col h-full liquid-glass-sidebar shrink-0 select-none relative z-20 transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
        isCollapsed ? 'w-[74px] p-3' : 'w-64 p-5'
      }`}
    >
      {/* Brand Header: Logo click expands & shrinks the sidebar smoothly (no unmount) */}
      <div className="mb-6 flex justify-center">
        <button
          onClick={toggleCollapse}
          className={`flex items-center cursor-pointer min-w-0 group rounded-2xl transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-white/[0.06] active:scale-[0.97] ${
            isCollapsed
              ? 'w-12 h-12 justify-center p-0 mx-auto'
              : 'w-full p-2 gap-3 justify-start -ml-1'
          }`}
          title={isCollapsed ? 'Click to expand sidebar' : 'Click to shrink sidebar'}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <div className="transition-transform duration-300 group-hover:scale-110 shrink-0 shadow-lg rounded-full">
            <YouTubeMusicLogo size={34} />
          </div>
          <div
            className={`min-w-0 flex-1 overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] text-left ${
              isCollapsed
                ? 'max-w-0 opacity-0 -translate-x-3 pointer-events-none'
                : 'max-w-[200px] opacity-100 translate-x-0'
            }`}
          >
            <span className="font-bold text-base tracking-tight text-white block leading-tight truncate group-hover:text-white">
              YZ Music
            </span>
            <span className="text-[10.5px] text-white/50 font-medium tracking-wide truncate block group-hover:text-white/70">
              YouTube Music Web
            </span>
          </div>
        </button>
      </div>

      {/* Navigation Links with Optimized Gliding Selection Animation */}
      <nav className="flex flex-col gap-1.5 flex-1 relative overflow-y-auto overflow-x-hidden scrollbar-none">
        {/* Animated Floating Active Indicator Pill */}
        <div
          className={`absolute rounded-2xl pointer-events-none z-0 transition-all duration-320 ease-[cubic-bezier(0.34,1.35,0.64,1)] ${
            isCollapsed
              ? 'w-12 h-12 left-0 right-0 mx-auto'
              : 'left-0 right-0 h-12'
          }`}
          style={{
            transform: `translateY(${activeIndex * 54}px)`,
            opacity: activeIndex >= 0 ? 1 : 0,
            background: 'linear-gradient(135deg, #FF2A4B 0%, #D90429 100%)',
            boxShadow: '0 4px 20px -2px rgba(250, 45, 72, 0.5), inset 0 1px 1px 0 rgba(255, 255, 255, 0.35)',
            border: '1px solid rgba(255, 255, 255, 0.22)',
          }}
        />

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === activeId;

          return (
            <button
              key={item.id}
              onClick={item.onClick}
              className={`relative z-10 flex items-center rounded-2xl font-medium text-sm transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] cursor-pointer group active:scale-[0.97] ${
                isCollapsed
                  ? 'w-12 h-12 justify-center px-0 mx-auto'
                  : 'w-full h-12 px-3.5 gap-3.5 justify-start'
              } ${
                isActive
                  ? 'text-white font-semibold'
                  : 'text-white/70 hover:text-white hover:bg-white/[0.06]'
              }`}
              title={isCollapsed ? item.label : undefined}
              aria-label={item.label}
            >
              <div
                className={`w-5 h-5 flex items-center justify-center shrink-0 transition-transform duration-200 ${
                  isActive ? 'scale-105' : 'group-hover:scale-105'
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>

              <span
                className={`whitespace-nowrap transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] overflow-hidden text-left ${
                  isCollapsed
                    ? 'max-w-0 opacity-0 -translate-x-2'
                    : 'max-w-[160px] opacity-100 translate-x-0'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Account Profile Widget: Smoothly morphs without unmounting */}
      <div className="mt-auto pt-3">
        {onOpenAccount && (
          <button
            onClick={onOpenAccount}
            className={`relative flex items-center rounded-2xl liquid-glass border border-white/10 hover:border-white/25 transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] cursor-pointer active:scale-[0.97] group ${
              isCollapsed
                ? 'w-12 h-12 justify-center p-0 mx-auto'
                : 'w-full p-2.5 gap-3 justify-start'
            }`}
            title={isSignedIn ? `${account?.name || 'Account'} (Signed In)` : 'Sign in to YouTube Music'}
          >
            {isSignedIn && account?.thumbnailUrl ? (
              <img
                src={account.thumbnailUrl}
                alt={account.name}
                className="w-8 h-8 rounded-full object-cover border border-white/20 shrink-0"
              />
            ) : isSignedIn ? (
              <div className="w-8 h-8 rounded-full bg-accent-red/20 border border-accent-red/40 flex items-center justify-center shrink-0 text-accent-red font-bold text-xs">
                {account?.name ? account.name.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full bg-white/10 border border-white/15 flex items-center justify-center shrink-0 text-white/70">
                <User className="w-4 h-4" />
              </div>
            )}

            <div
              className={`flex-1 min-w-0 overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] text-left ${
                isCollapsed
                  ? 'max-w-0 opacity-0 -translate-x-2 pointer-events-none'
                  : 'max-w-[150px] opacity-100 translate-x-0'
              }`}
            >
              <div className="text-xs font-bold text-white truncate">
                {isSignedIn && account ? account.name : 'Sign In'}
              </div>
              <div className="text-[10px] text-white/50 truncate">
                {isSignedIn && account ? account.email || 'YouTube Music' : 'Sync your playlists'}
              </div>
            </div>
          </button>
        )}
      </div>
    </aside>
  );
};
