import React, { useState, useRef } from 'react';
import { DesktopSidebar, NavTab } from './DesktopSidebar';
import { GlassNavBar } from './GlassNavBar';
import { FrostedTopBar } from './FrostedTopBar';
import { MiniPlayer } from '../player/MiniPlayer';
import { NowPlayingScreen } from '../player/NowPlayingScreen';
import { HomeView } from '../../views/HomeView';
import { ExploreView } from '../../views/ExploreView';
import { SearchView } from '../../views/SearchView';
import { LibraryView } from '../../views/LibraryView';
import { DetailView } from '../../views/DetailView';
import { EqualizerModal } from '../common/EqualizerModal';
import { SettingsModal } from '../common/SettingsModal';
import { ListenTogetherModal } from '../common/ListenTogetherModal';
import { AccountModal } from '../common/AccountModal';
import { KeyboardShortcutsModal } from '../common/KeyboardShortcutsModal';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { BrowseTarget } from '../../types';
import { usePlayerStore } from '../../stores/playerStore';
import { useSearchStore } from '../../stores/searchStore';

export const AppShell: React.FC = () => {
  const { currentPalette, currentSong } = usePlayerStore();
  const { results: searchResults } = useSearchStore();
  const [currentTab, setCurrentTab] = useState<NavTab>('home');
  const [isScrolled, setIsScrolled] = useState(false);
  const [isBottomInline, setIsBottomInline] = useState(false);
  const accumulatedDelta = useRef(0);
  const lastScrollY = useRef(0);
  const [selectedBrowse, setSelectedBrowse] = useState<BrowseTarget | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showEqualizer, setShowEqualizer] = useState(false);
  const [showListenTogether, setShowListenTogether] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);

  // Desktop Keyboard Shortcuts handler (Space = play/pause, Left/Right = skip 10s)
  useKeyboardShortcuts({
    onToggleShortcutsModal: () => setShowShortcutsModal((prev) => !prev),
    onCloseModals: () => {
      setShowSettings(false);
      setShowEqualizer(false);
      setShowListenTogether(false);
      setShowAccountModal(false);
      setShowShortcutsModal(false);
    },
  });

  // Expand bottom chrome when a new track starts playing
  React.useEffect(() => {
    if (currentSong) {
      setIsBottomInline(false);
      accumulatedDelta.current = 0;
    }
  }, [currentSong?.videoId]);

  const handleOpenDetail = (
    browseId: string,
    params?: string,
    title?: string,
    subtitle?: string,
    thumbnailUrl?: string | null,
    type?: string
  ) => {
    setSelectedBrowse({ browseId, params, title, subtitle, thumbnailUrl, type });
  };

  const handleSelectTab = (tab: NavTab) => {
    setSelectedBrowse(null);
    setCurrentTab(tab);
    setIsBottomInline(false);
    accumulatedDelta.current = 0;
  };

  const handleScroll = (e: React.UIEvent<HTMLElement>) => {
    const currentScrollY = e.currentTarget.scrollTop;
    setIsScrolled(currentScrollY > 20);

    const deltaY = currentScrollY - lastScrollY.current;

    // If near the top, always keep fully expanded
    if (currentScrollY <= 25) {
      setIsBottomInline(false);
      accumulatedDelta.current = 0;
    } else {
      // Reset accumulated scroll on direction reversal
      if (
        (accumulatedDelta.current > 0 && deltaY < 0) ||
        (accumulatedDelta.current < 0 && deltaY > 0)
      ) {
        accumulatedDelta.current = 0;
      }
      accumulatedDelta.current += deltaY;

      // Scrolling down past threshold -> shrink to inline single row
      if (accumulatedDelta.current >= 28) {
        setIsBottomInline(true);
        accumulatedDelta.current = 0;
      }
      // Scrolling up past threshold -> expand back to two-tier full view
      else if (accumulatedDelta.current <= -24) {
        setIsBottomInline(false);
        accumulatedDelta.current = 0;
      }
    }

    lastScrollY.current = currentScrollY;
  };

  const getTitle = () => {
    if (selectedBrowse) return selectedBrowse.title || 'Collection';
    switch (currentTab) {
      case 'home':
        return 'Listen Now';
      case 'explore':
        return 'Explore';
      case 'library':
        return 'Library';
      case 'search':
        return 'Search';
    }
  };

  return (
    <div
      className="flex h-screen w-screen overflow-hidden text-white select-none relative transition-colors duration-1000"
      style={{
        backgroundColor: currentPalette ? currentPalette.darkBase : '#050508',
      }}
    >
      {/* Dynamic Ambient Liquid Glow Layers synchronized with song autotheming */}
      <div
        className="ambient-glow-1 transition-all duration-1000"
        style={{
          background: currentPalette
            ? `radial-gradient(circle, ${currentPalette.dominant}38 0%, transparent 70%)`
            : undefined,
        }}
      />
      <div
        className="ambient-glow-2 transition-all duration-1000"
        style={{
          background: currentPalette
            ? `radial-gradient(circle, ${currentPalette.secondary}30 0%, transparent 70%)`
            : undefined,
        }}
      />
      {currentPalette && (
        <div
          className="fixed inset-0 pointer-events-none transition-all duration-1000 z-0"
          style={{
            background: `
              radial-gradient(ellipse 110% 80% at 80% 90%, ${currentPalette.dominant}25 0%, transparent 65%),
              radial-gradient(circle at 20% 10%, ${currentPalette.secondary}20 0%, transparent 55%)
            `,
          }}
        />
      )}

      {/* 1. Desktop Sidebar (Left side, >= 768px) */}
      <DesktopSidebar
        currentTab={currentTab}
        onSelectTab={handleSelectTab}
        onOpenAccount={() => setShowAccountModal(true)}
        onOpenSettings={() => setShowSettings(true)}
        onOpenEqualizer={() => setShowEqualizer(true)}
        onOpenListenTogether={() => setShowListenTogether(true)}
        isSettingsOpen={showSettings}
        isEqualizerOpen={showEqualizer}
        isListenTogetherOpen={showListenTogether}
      />

      {/* 2. Main Content Feed (Center) */}
      <div className="flex-1 h-full overflow-hidden relative z-10">
        {/* Scrollable feed: full height, content starts under the top bar with padding */}
        <main
          onScroll={handleScroll}
          className={`h-full overflow-y-auto overflow-x-hidden relative scrollbar-none transition-[padding] duration-300 ${
            currentTab === 'search' && !selectedBrowse && searchResults !== null
              ? 'pt-24 sm:pt-28'
              : 'pt-14 sm:pt-16'
          } ${
            currentSong ? 'pb-44 md:pb-28 lg:pb-8' : 'pb-24 md:pb-12 lg:pb-8'
          }`}
          style={{
            transform: 'translate3d(0, 0, 0)',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {selectedBrowse ? (
            <DetailView
              browseId={selectedBrowse.browseId}
              params={selectedBrowse.params}
              initialTitle={selectedBrowse.title}
              initialSubtitle={selectedBrowse.subtitle}
              initialThumbnailUrl={selectedBrowse.thumbnailUrl}
              initialType={selectedBrowse.type}
              onBack={() => setSelectedBrowse(null)}
              onOpenDetail={handleOpenDetail}
              onTitleLoaded={(title) => {
                setSelectedBrowse((prev) => (prev ? { ...prev, title } : null));
              }}
            />
          ) : (
            <>
              {currentTab === 'home' && <HomeView onOpenDetail={handleOpenDetail} />}
              {currentTab === 'explore' && <ExploreView onOpenDetail={handleOpenDetail} />}
              {currentTab === 'search' && <SearchView onOpenDetail={handleOpenDetail} />}
              {currentTab === 'library' && (
                <LibraryView
                  onOpenDetail={handleOpenDetail}
                  onOpenAccount={() => setShowAccountModal(true)}
                />
              )}
            </>
          )}
        </main>

        {/* Top Fade Blur Layer (Progressive Glass Fade matching TopFadeBlur.kt) */}
        <div className="top-fade-blur" />

        {/* Top Fade Scrim Layer (Eased dark gradient wash) */}
        <div
          className="top-fade-scrim"
          style={{
            background: currentPalette
              ? `linear-gradient(to bottom, ${currentPalette.darkBase}ee 0%, ${currentPalette.darkBase}b8 40%, ${currentPalette.darkBase}40 75%, transparent 100%)`
              : undefined,
          }}
        />

        {/* Floating FrostedTopBar over TopFadeBlur */}
        <FrostedTopBar
          title={getTitle()}
          isSearch={currentTab === 'search' && !selectedBrowse}
          scrolled={isScrolled}
          onBack={selectedBrowse ? () => setSelectedBrowse(null) : undefined}
          className="absolute top-0 left-0 right-0 z-30"
          onOpenSettings={() => setShowSettings(true)}
          onOpenEqualizer={() => setShowEqualizer(true)}
          onOpenListenTogether={() => setShowListenTogether(true)}
          onOpenAccount={() => setShowAccountModal(true)}
          onOpenDetail={handleOpenDetail}
        />

        {/* Floating MiniPlayer Pill (Tablet viewports 768px-1023px) */}
        <div className="hidden md:block lg:hidden fixed bottom-5 inset-x-auto left-1/2 -translate-x-1/2 w-[calc(100%-18rem)] max-w-xl z-40">
          <MiniPlayer isInline={false} />
        </div>

        {/* Mobile Bottom Fade Scrim: Dissolves scrolling items smoothly above bottom navigation */}
        <div
          className="md:hidden bottom-fade-scrim"
          style={{
            background: currentPalette
              ? `linear-gradient(to top, ${currentPalette.darkBase}fa 0%, ${currentPalette.darkBase}b0 45%, ${currentPalette.darkBase}20 85%, transparent 100%)`
              : undefined,
          }}
        />

        {/* Mobile Liquid Glass Navigation Bar with Integrated Expand/Shrink Player */}
        <GlassNavBar
          currentTab={currentTab}
          onSelectTab={handleSelectTab}
          isInline={isBottomInline}
          onExpand={() => setIsBottomInline(false)}
        />
      </div>

      {/* 3. Persistent Docked Player Pane (Right side on Desktop >= 1024px) */}
      <NowPlayingScreen
        isDocked={true}
        onOpenDetail={handleOpenDetail}
        onOpenListenTogether={() => setShowListenTogether(true)}
        onOpenEqualizer={() => setShowEqualizer(true)}
        onOpenSettings={() => setShowSettings(true)}
      />

      {/* 4. Full-screen gesture-driven Now Playing overlay on Mobile */}
      <NowPlayingScreen
        isDocked={false}
        onOpenDetail={handleOpenDetail}
        onOpenListenTogether={() => setShowListenTogether(true)}
        onOpenEqualizer={() => setShowEqualizer(true)}
        onOpenSettings={() => setShowSettings(true)}
      />

      {/* Modals & Dialogs */}
      <EqualizerModal isOpen={showEqualizer} onClose={() => setShowEqualizer(false)} />
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onOpenAccount={() => setShowAccountModal(true)}
        onOpenShortcuts={() => setShowShortcutsModal(true)}
      />
      <ListenTogetherModal isOpen={showListenTogether} onClose={() => setShowListenTogether(false)} />
      <AccountModal isOpen={showAccountModal} onClose={() => setShowAccountModal(false)} />
      <KeyboardShortcutsModal
        isOpen={showShortcutsModal}
        onClose={() => setShowShortcutsModal(false)}
      />
    </div>
  );
};

