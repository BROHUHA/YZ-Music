import React, { useState, useRef, useEffect } from 'react';
import {
  Settings,
  Sliders,
  Users,
  Menu,
  ArrowLeft,
  Search,
  X,
  Mic,
  ArrowUpLeft,
  Play,
  User,
} from 'lucide-react';
import { YouTubeMusicLogo } from '../common/YouTubeMusicLogo';
import { useSearchStore } from '../../stores/searchStore';
import { usePlayerStore } from '../../stores/playerStore';
import { SearchFilterType } from '../../types';

interface FrostedTopBarProps {
  title: string;
  isSearch?: boolean;
  scrolled?: boolean;
  onBack?: () => void;
  onOpenSettings: () => void;
  onOpenEqualizer: () => void;
  onOpenListenTogether: () => void;
  onOpenAccount?: () => void;
  onOpenDetail?: (
    browseId: string,
    params?: string,
    title?: string,
    subtitle?: string,
    thumbnailUrl?: string | null,
    type?: string
  ) => void;
  className?: string;
}

const FILTERS: { id: SearchFilterType; label: string }[] = [
  { id: 'ALL', label: 'All' },
  { id: 'SONGS', label: 'Songs' },
  { id: 'VIDEOS', label: 'Videos' },
  { id: 'ALBUMS', label: 'Albums' },
  { id: 'ARTISTS', label: 'Artists' },
  { id: 'PLAYLISTS', label: 'Playlists' },
];

export const FrostedTopBar: React.FC<FrostedTopBarProps> = ({
  title,
  isSearch = false,
  scrolled: _scrolled = false,
  onBack,
  onOpenSettings,
  onOpenEqualizer,
  onOpenListenTogether,
  onOpenAccount,
  onOpenDetail,
  className = '',
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Search store integration when in search mode
  const {
    query,
    setQuery,
    filter,
    setFilter,
    results,
    suggestions,
    typeaheadResults,
    showDropdown,
    setShowDropdown,
    selectedIndex,
    setSelectedIndex,
    performSearch,
    clearSearch,
  } = useSearchStore();

  const { playSong, currentPalette } = usePlayerStore();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchDropdownRef = useRef<HTMLDivElement>(null);

  // Close menu dropdown on outside click or Escape key
  useEffect(() => {
    if (!isMenuOpen) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };

    const handleScroll = () => {
      setIsMenuOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isMenuOpen]);

  // Close search suggestions on outside click
  useEffect(() => {
    if (!showDropdown) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchDropdownRef.current &&
        !searchDropdownRef.current.contains(event.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown, setShowDropdown]);

  // Search keyboard navigation
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || suggestions.length === 0) {
      if (e.key === 'Enter') {
        performSearch(query);
        searchInputRef.current?.blur();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const termToSearch = selectedIndex >= 0 ? suggestions[selectedIndex] : query;
      setQuery(termToSearch);
      performSearch(termToSearch);
      searchInputRef.current?.blur();
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  // Voice search using Web Speech API
  const startVoiceSearch = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Voice search is not supported in this browser.');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setQuery(transcript);
      performSearch(transcript);
    };
    recognition.start();
  };

  const isSuggesting = showDropdown && suggestions.length > 0 && query.trim().length > 0;

  return (
    <header
      className={`w-full px-4 sm:px-6 py-2.5 sm:py-3.5 flex flex-col gap-2 select-none pointer-events-none ${className}`}
    >
      {/* Row 1: Left [Back / Large Title] + Center [Search Bar if isSearch] + Right [Menu Button] */}
      <div className="w-full flex items-center justify-between gap-3 sm:gap-4">
        {/* Left Side: Detail Back Button OR Large Display Heading (Clean, no menu button here) */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          {onBack ? (
            <div className="flex items-center gap-2.5 pointer-events-auto">
              <button
                onClick={onBack}
                className="p-2 rounded-xl liquid-glass-pill transition-all cursor-pointer flex items-center justify-center text-white/90 hover:text-white active:scale-95 shrink-0"
                title="Go back"
                aria-label="Go back"
              >
                <ArrowLeft className="w-5 h-5 text-white" />
              </button>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white truncate">
                {title}
              </h1>
            </div>
          ) : isSearch ? (
            /* On search, left is kept clean */
            null
          ) : (
            /* Large Display Heading as Header */
            <div className="flex items-center pointer-events-auto min-w-0">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white truncate">
                {title}
              </h1>
            </div>
          )}
        </div>

        {/* Center: Search Field if isSearch */}
        {isSearch && (
          <div className="flex-1 min-w-0 max-w-2xl relative pointer-events-auto mx-1 sm:mx-3">
            {/* Search Input Box */}
            <div className="relative flex items-center w-full h-[42px] sm:h-[46px] bg-white/[0.08] hover:bg-white/[0.12] focus-within:bg-white/[0.12] focus-within:border-accent-red/70 focus-within:shadow-[0_0_24px_rgba(250,45,72,0.35)] focus-within:ring-1 focus-within:ring-accent-red/40 rounded-2xl px-3 transition-all duration-300 border border-white/10 backdrop-blur-2xl">
              {/* Search magnifier touch target button */}
              <button
                type="button"
                disabled={!query.trim()}
                onClick={() => {
                  if (query.trim()) {
                    performSearch(query);
                    searchInputRef.current?.blur();
                  }
                }}
                className={`p-1.5 rounded-full transition-all duration-200 shrink-0 mr-1.5 flex items-center justify-center ${
                  query.trim()
                    ? 'text-white hover:text-accent-red hover:bg-white/10 active:scale-90 cursor-pointer'
                    : 'text-white/40 cursor-default'
                }`}
                title="Search"
              >
                <Search
                  className={`w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-200 ${
                    query.trim() ? 'scale-105' : 'scale-100'
                  }`}
                />
              </button>

              {/* Input Element */}
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => {
                  if (query.trim().length > 0) setShowDropdown(true);
                }}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search songs, albums, artists..."
                className="bg-transparent border-none outline-none w-full text-white placeholder-white/40 text-sm sm:text-base font-medium caret-accent-red"
              />

              {/* Clear button */}
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    clearSearch();
                    searchInputRef.current?.focus();
                  }}
                  className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white flex items-center justify-center active:scale-90 transition-all mr-1 shrink-0"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Voice search button */}
              <button
                type="button"
                onClick={startVoiceSearch}
                className="w-7 h-7 rounded-full hover:bg-white/10 text-white/50 hover:text-accent-red flex items-center justify-center active:scale-90 transition-colors shrink-0"
                title="Voice search"
              >
                <Mic className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </div>

            {/* Suggestions & Typeahead Dropdown floating beneath Search Field */}
            {isSuggesting && (
              <div
                ref={searchDropdownRef}
                className="absolute top-full left-0 right-0 mt-2 rounded-2xl shadow-[0_24px_50px_rgba(0,0,0,0.8)] z-50 overflow-hidden backdrop-blur-3xl border border-white/15 max-h-[420px] overflow-y-auto animate-fadeIn"
                style={{
                  background: currentPalette
                    ? `linear-gradient(145deg, ${currentPalette.darkBase}fa 0%, ${currentPalette.darkBase}ee 100%)`
                    : 'rgba(18, 21, 29, 0.96)',
                }}
              >
                {/* Suggestions List */}
                <div className="flex flex-col py-1">
                  {suggestions.map((term, idx) => {
                    const isLeadRow = idx === 0;
                    const isSelected = selectedIndex === idx;
                    const lowerTerm = term.toLowerCase();
                    const lowerQuery = query.toLowerCase().trim();
                    const startsWithQuery = lowerTerm.startsWith(lowerQuery);

                    return (
                      <div
                        key={`topbar-suggest-${term}-${idx}`}
                        onClick={() => {
                          setQuery(term);
                          performSearch(term);
                        }}
                        className={`px-4 py-2.5 cursor-pointer flex items-center justify-between transition-colors group ${
                          isSelected
                            ? 'bg-white/15 text-white'
                            : 'hover:bg-white/[0.08] text-white/80 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-3.5 overflow-hidden flex-1 mr-2">
                          <Search
                            className={`w-4 h-4 shrink-0 transition-colors ${
                              isSelected
                                ? 'text-accent-red'
                                : 'text-white/40 group-hover:text-accent-red'
                            }`}
                          />
                          <span className="truncate text-sm">
                            {startsWithQuery ? (
                              <>
                                <span className="text-white/70 font-normal">
                                  {term.slice(0, lowerQuery.length)}
                                </span>
                                <span className="font-bold text-white">
                                  {term.slice(lowerQuery.length)}
                                </span>
                              </>
                            ) : (
                              <span className="font-medium text-white">{term}</span>
                            )}
                          </span>
                        </div>

                        {!isLeadRow ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setQuery(term);
                              searchInputRef.current?.focus();
                            }}
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/15 active:scale-90 transition-all shrink-0"
                            title={`Refine search with "${term}"`}
                          >
                            <ArrowUpLeft className="w-4 h-4" />
                          </button>
                        ) : (
                          <div className="w-8 h-8 shrink-0" />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Hybrid Live Media Typeahead */}
                {typeaheadResults.length > 0 && (
                  <>
                    <div className="border-t border-white/10 my-1 mx-3" />
                    <div className="flex flex-col py-1">
                      <span className="px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white/40">
                        Quick Results
                      </span>
                      {typeaheadResults.map((result, idx) => {
                        if (result.type === 'Track' || result.type === 'TopTrack') {
                          const song = result.song;
                          return (
                            <div
                              key={`topbar-ta-song-${song.videoId}-${idx}`}
                              onClick={() => {
                                playSong(song);
                                setShowDropdown(false);
                              }}
                              className="px-4 py-2 hover:bg-white/[0.08] cursor-pointer flex items-center gap-3.5 transition-colors group"
                            >
                              <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-white/5 relative border border-white/10">
                                <img
                                  src={song.thumbnailUrl || (song.videoId ? `https://i.ytimg.com/vi/${song.videoId}/hqdefault.jpg` : '/logo.svg')}
                                  alt={song.title}
                                  referrerPolicy="no-referrer"
                                  onError={(e) => {
                                    e.currentTarget.src = '/logo.svg';
                                  }}
                                  className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <Play className="w-3.5 h-3.5 fill-white text-white ml-0.5" />
                                </div>
                              </div>
                              <div className="overflow-hidden flex-1">
                                <h5 className="text-sm font-semibold text-white truncate leading-tight group-hover:text-accent-red transition-colors">
                                  {song.title}
                                </h5>
                                <p className="text-xs text-white/50 truncate mt-0.5">
                                  {song.artist || 'Song'}
                                </p>
                              </div>
                            </div>
                          );
                        } else if (result.type === 'Browse') {
                          const item = result.item;
                          const isArtist = item.type === 'ARTIST';
                          return (
                            <div
                              key={`topbar-ta-browse-${item.browseId}-${idx}`}
                              onClick={() => {
                                if (onOpenDetail) {
                                  onOpenDetail(
                                    item.browseId,
                                    undefined,
                                    item.title,
                                    item.subtitle,
                                    item.thumbnailUrl,
                                    item.type
                                  );
                                }
                                setShowDropdown(false);
                              }}
                              className="px-4 py-2 hover:bg-white/[0.08] cursor-pointer flex items-center gap-3.5 transition-colors group"
                            >
                              <div
                                className={`w-10 h-10 overflow-hidden shrink-0 bg-white/5 relative border border-white/10 ${
                                  isArtist ? 'rounded-full' : 'rounded-lg'
                                }`}
                              >
                                <img
                                  src={item.thumbnailUrl || '/logo.svg'}
                                  alt={item.title}
                                  referrerPolicy="no-referrer"
                                  onError={(e) => {
                                    e.currentTarget.src = '/logo.svg';
                                  }}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="overflow-hidden flex-1">
                                <h5 className="text-sm font-semibold text-white truncate leading-tight group-hover:text-accent-red transition-colors">
                                  {item.title}
                                </h5>
                                <p className="text-xs text-white/50 truncate mt-0.5">
                                  {item.type} {item.subtitle ? `• ${item.subtitle}` : ''}
                                </p>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Right Side: YZ Music Logo on mobile / Menu Button on desktop */}
        <div className="relative pointer-events-auto flex items-center shrink-0 gap-2" ref={menuRef}>
          {/* Mobile View: Authentic Branded YZ Music Logo (Round Liquid Glass Pill) */}
          <button
            onClick={() => setIsMenuOpen((prev) => !prev)}
            className="md:hidden p-1 rounded-full liquid-glass-circle transition-all duration-200 cursor-pointer flex items-center justify-center active:scale-90 hover:scale-105 shadow-[0_4px_16px_rgba(250,45,72,0.35)] border border-white/25"
            title="YZ Music Menu"
            aria-label="YZ Music Menu"
            aria-expanded={isMenuOpen}
          >
            <YouTubeMusicLogo size={32} className="drop-shadow-[0_2px_8px_rgba(250,45,72,0.5)]" />
          </button>

          {/* Desktop/Tablet View: Clean Liquid Glass Menu Icon Button */}
          <button
            onClick={() => setIsMenuOpen((prev) => !prev)}
            className={`hidden md:flex p-2 sm:p-2.5 rounded-xl liquid-glass-pill transition-all cursor-pointer items-center justify-center ${
              isMenuOpen
                ? 'bg-white/20 text-white ring-1 ring-white/30'
                : 'text-white/80 hover:text-white hover:bg-white/10'
            }`}
            title="Menu"
            aria-label="Toggle menu"
            aria-expanded={isMenuOpen}
          >
            <Menu className="w-5 h-5 text-white" />
          </button>

          {/* Frosted Dropdown Menu (Right aligned) */}
          {isMenuOpen && (
            <div
              className="absolute right-0 top-full mt-2 w-56 p-1.5 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.85)] border border-white/15 backdrop-blur-3xl z-50 flex flex-col gap-0.5 animate-scale-in"
              style={{
                background: 'rgba(20, 20, 26, 0.95)',
              }}
            >
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  onOpenListenTogether();
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-white/90 hover:text-white hover:bg-white/10 transition-colors cursor-pointer group"
              >
                <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/70 group-hover:text-accent-red group-hover:bg-accent-red/10 transition-colors shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-white tracking-tight">Listen Together</div>
                  <div className="text-[10px] text-white/40 truncate">Sync party session</div>
                </div>
              </button>

              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  onOpenEqualizer();
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-white/90 hover:text-white hover:bg-white/10 transition-colors cursor-pointer group"
              >
                <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/70 group-hover:text-purple-400 group-hover:bg-purple-500/10 transition-colors shrink-0">
                  <Sliders className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-white tracking-tight">Equalizer</div>
                  <div className="text-[10px] text-white/40 truncate">2D Tone Pad & EQ</div>
                </div>
              </button>

              <div className="my-1 border-t border-white/10" />

              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  onOpenSettings();
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-white/90 hover:text-white hover:bg-white/10 transition-colors cursor-pointer group"
              >
                <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/70 group-hover:text-blue-400 group-hover:bg-blue-500/10 transition-colors shrink-0">
                  <Settings className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-white tracking-tight">Settings</div>
                  <div className="text-[10px] text-white/40 truncate">App & audio config</div>
                </div>
              </button>

              {onOpenAccount && (
                <>
                  <div className="my-1 border-t border-white/10" />
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      onOpenAccount();
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-white/90 hover:text-white hover:bg-white/10 transition-colors cursor-pointer group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/70 group-hover:text-accent-red group-hover:bg-accent-red/10 transition-colors shrink-0">
                      <User className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white tracking-tight">Account & Sign In</div>
                      <div className="text-[10px] text-white/40 truncate">YouTube Music sync</div>
                    </div>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Row 2: Filter Tabs (Integrated into unified header when results are present and not suggesting) */}
      {isSearch && results !== null && !isSuggesting && (
        <div
          className="w-full flex gap-2 overflow-x-auto pb-0.5 scrollbar-none snap-x items-center pointer-events-auto max-w-2xl mx-auto"
          style={{
            maskImage: 'linear-gradient(to right, black 0%, black calc(100% - 32px), transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to right, black 0%, black calc(100% - 32px), transparent 100%)',
          }}
        >
          {FILTERS.map((f) => {
            const selected = filter === f.id;
            return (
              <button
                key={`topbar-filter-${f.id}`}
                onClick={() => {
                  setFilter(f.id);
                  if (query.trim()) performSearch(query, f.id);
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all duration-200 snap-start active:scale-95 ${
                  selected
                    ? 'bg-white text-black shadow-md font-bold scale-[1.02]'
                    : 'bg-white/[0.08] hover:bg-white/[0.14] text-white/70 hover:text-white border border-white/10'
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
};
