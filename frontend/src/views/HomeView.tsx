import React, { useEffect, useState, useRef, useCallback } from 'react';
import { HomeShelf, ShelfItem, HomeChip, Song } from '../types';
import { innertubeService } from '../services/innertube';
import { trendingService, DEFAULT_HOME_CHIPS } from '../services/trendingService';
import { cleanThumbnailUrl } from '../utils/thumbnail';
import { usePlayerStore } from '../stores/playerStore';
import { useAuthStore } from '../stores/authStore';
import { Play, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';

interface HomeViewProps {
  onOpenDetail?: (
    browseId: string,
    params?: string,
    title?: string,
    subtitle?: string,
    thumbnailUrl?: string | null,
    type?: string
  ) => void;
}

/**
 * Strips "Song • Chelsea Wolfe" or "Video • 3:45" to just the pure artist name,
 * exactly replicating InnertubeParser.artistFromSubtitle(subtitle).
 */
function cleanArtistFromSubtitle(subtitle: string): string {
  if (!subtitle) return '';
  const parts = subtitle.split(' • ').map((s) => s.trim()).filter(Boolean);
  const typeWords = ['song', 'video', 'album', 'single', 'ep', 'playlist', 'artist'];
  const durationRegex = /^\d+:\d+(:\d+)?$/;
  const tallyRegex = /^\d+(\.\d+)?[kmb]?\s*(views|plays|subscribers|tracks|songs)?$/i;

  const artist = parts.find(
    (p) => !typeWords.includes(p.toLowerCase()) && !durationRegex.test(p) && !tallyRegex.test(p)
  );
  return artist || subtitle;
}

export const HomeView: React.FC<HomeViewProps> = ({ onOpenDetail }) => {
  const [shelves, setShelves] = useState<HomeShelf[]>([]);
  const [allShelves, setAllShelves] = useState<HomeShelf[]>([]);
  const [chips, setChips] = useState<HomeChip[]>(DEFAULT_HOME_CHIPS);
  const [activeChip, setActiveChip] = useState<string>('all');
  const [continuation, setContinuation] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const { playSong, setQueue } = usePlayerStore();
  const { isSignedIn, feedRefreshTrigger } = useAuthStore();
  const observerTarget = useRef<HTMLDivElement>(null);
  const quickPicksScrollRef = useRef<HTMLDivElement>(null);

  // Initial load
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    innertubeService
      .getHome()
      .then((data) => {
        if (!isMounted) return;
        setShelves(data.shelves);
        setAllShelves(data.shelves);
        if (data.chips && data.chips.length > 0) {
          setChips(data.chips);
        }
        setContinuation(data.continuation);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load Home feed', err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isSignedIn, feedRefreshTrigger]);

  // Handle dynamic mood & regional trending chip selection
  const handleChipSelect = async (chip: HomeChip) => {
    setActiveChip(chip.id);

    if (chip.id === 'all') {
      setShelves(allShelves);
      return;
    }

    if (chip.params) {
      setLoading(true);
      innertubeService
        .getHome(chip.params)
        .then((data) => {
          setShelves(data.shelves);
          setContinuation(data.continuation);
          setLoading(false);
        })
        .catch(async () => {
          const tailored = await trendingService.getShelvesForChipAsync(chip.id, allShelves);
          setShelves(tailored.length > 0 ? tailored : allShelves);
          setLoading(false);
        });
      return;
    }

    // Dynamic tailored regional and trend shelves (Mollywood, Tollywood, Kollywood, Bollywood, Punjabi, etc.)
    // 1. Instant 0ms display of verified non-repeating shelves
    const instantShelves = trendingService.getShelvesForChip(chip.id, allShelves);
    if (instantShelves.length > 0) {
      setShelves(instantShelves);
    }

    // 2. Refresh with live YouTube Music charts asynchronously in the background
    try {
      const liveShelves = await trendingService.getShelvesForChipAsync(chip.id, allShelves);
      if (liveShelves.length > 0) {
        setShelves(liveShelves);
      }
    } catch (e) {
      console.warn('Background live shelves fetch skipped:', e);
    }
  };

  // Play entire shelf of tracks sequentially
  const handlePlayAll = (shelf: HomeShelf) => {
    const playableSongs: Song[] = shelf.items
      .filter((it) => it.videoId)
      .map((it) => ({
        videoId: it.videoId!,
        title: it.title,
        artist: cleanArtistFromSubtitle(it.subtitle || '') || 'Trending Artist',
        thumbnailUrl: it.thumbnailUrl || null,
        isVideo: it.isVideo,
      }));

    if (playableSongs.length > 0) {
      setQueue(playableSongs, 0);
      playSong(playableSongs[0], playableSongs, true);
    }
  };

  // Horizontal pagination for Quick picks 4-row grid
  const scrollQuickPicks = (direction: 'left' | 'right') => {
    if (!quickPicksScrollRef.current) return;
    const container = quickPicksScrollRef.current;
    const scrollAmount = container.clientWidth * 0.78;
    container.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  // Robust image fallback handler that prevents broken image icons
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>, title: string) => {
    const target = e.currentTarget;
    const currentSrc = target.src || '';

    // If maxresdefault failed, fallback to mqdefault (which is guaranteed to exist with 0 black bars)
    if (currentSrc.includes('maxresdefault.jpg')) {
      target.src = currentSrc.replace('maxresdefault.jpg', 'mqdefault.jpg');
      return;
    }

    // If it's a YouTube hqdefault, try mqdefault first
    if (currentSrc.includes('hqdefault.jpg')) {
      target.src = currentSrc.replace('hqdefault.jpg', 'mqdefault.jpg');
      return;
    }

    // High quality stylish SVG fallback with song initial, dark theme, and red accent
    const cleanInitial = encodeURIComponent((title || 'Song').trim().slice(0, 2).toUpperCase());
    target.src = `https://ui-avatars.com/api/?name=${cleanInitial}&background=201524&color=FA2D48&size=500&font-size=0.36&bold=true`;
  };

  const loadMoreShelves = useCallback(() => {
    if (!continuation || loadingMore) return;
    setLoadingMore(true);
    innertubeService
      .getMoreHome(continuation)
      .then((data) => {
        setShelves((prev) => [...prev, ...data.shelves]);
        setAllShelves((prev) => [...prev, ...data.shelves]);
        setContinuation(data.continuation);
        setLoadingMore(false);
      })
      .catch((err) => {
        console.error('Failed to load more shelves', err);
        setLoadingMore(false);
      });
  }, [continuation, loadingMore]);

  // Infinite scroll trigger matching snapshotFlow nearEnd in HomeScreen.kt
  useEffect(() => {
    if (!continuation) return;
    const target = observerTarget.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMore) {
          loadMoreShelves();
        }
      },
      { rootMargin: '300px' }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [continuation, loadingMore, loadMoreShelves]);

  const handleItemClick = (item: ShelfItem) => {
    if (item.videoId) {
      playSong({
        videoId: item.videoId,
        title: item.title,
        artist: cleanArtistFromSubtitle(item.subtitle || '') || 'YouTube Music',
        thumbnailUrl: item.thumbnailUrl || null,
        isVideo: item.isVideo,
      });
    } else if (item.browseId && onOpenDetail) {
      onOpenDetail(
        item.browseId,
        item.params || undefined,
        item.title,
        item.subtitle,
        item.thumbnailUrl,
        item.badge || undefined
      );
    }
  };

  const getStripeColor = (num?: number | null): string => {
    if (num != null) {
      const hex = (num & 0x00ffffff).toString(16).padStart(6, '0');
      return `#${hex}`;
    }
    return '#FA2D48';
  };

  // Skeleton view matching feedSkeleton in HomeScreen.kt
  if (loading) {
    return (
      <div className="flex flex-col gap-6.5 p-2.5 sm:p-4 pb-28 md:pb-12 max-w-7xl mx-auto w-full animate-pulse">
        {/* Chips Skeleton */}
        <div className="flex gap-2.5 overflow-hidden px-2.5 pt-1">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="h-8 w-24 rounded-xl bg-white/10 shrink-0" />
          ))}
        </div>

        {/* Quick picks Header Skeleton */}
        <div className="px-2.5 pt-3 pb-1 flex items-center justify-between">
          <div className="h-7 w-36 rounded-lg bg-white/10" />
          <div className="h-7 w-20 rounded-full bg-white/10" />
        </div>

        {/* Quick picks 4-Row Grid Skeleton */}
        <div className="grid grid-rows-4 grid-flow-col gap-x-6 gap-y-2.5 overflow-hidden px-2.5">
          {Array.from({ length: 12 }).map((_, idx) => (
            <div key={idx} className="w-[300px] flex items-center gap-3 p-1.5">
              <div className="w-12 h-12 rounded-lg bg-white/10 shrink-0" />
              <div className="flex-1 flex flex-col gap-1.5">
                <div className="h-4 w-3/4 rounded bg-white/10" />
                <div className="h-3 w-1/2 rounded bg-white/5" />
              </div>
            </div>
          ))}
        </div>

        {/* Standard Shelves Skeleton */}
        {[1, 2].map((s) => (
          <div key={s} className="flex flex-col gap-2.5 pb-6.5 pt-4">
            <div className="px-2.5 py-2.5">
              <div className="h-6 w-40 rounded bg-white/10" />
            </div>
            <div className="flex gap-3.5 overflow-hidden px-2.5">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="w-[150px] shrink-0 flex flex-col gap-2.5">
                  <div className="w-full aspect-square rounded-[12px] bg-white/10" />
                  <div className="h-4 w-28 rounded bg-white/10" />
                  <div className="h-3 w-20 rounded bg-white/5" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6.5 p-2.5 sm:p-4 pb-28 md:pb-12 max-w-7xl mx-auto w-full">
      {/* 1. Dynamic Mood, Cinema & Trend Filter Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none px-2.5 pt-1 -mb-1 select-none">
        {chips.map((chip) => {
          const isActive = activeChip === chip.id;
          return (
            <button
              key={chip.id}
              onClick={() => handleChipSelect(chip)}
              className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-[13px] font-bold tracking-wide shrink-0 transition-all duration-200 active:scale-95 cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'bg-white text-black shadow-lg shadow-white/15'
                  : 'bg-white/[0.08] hover:bg-white/[0.14] text-white/80 hover:text-white border border-white/10'
              }`}
            >
              {chip.title}
            </button>
          );
        })}
      </div>

      {/* 2. Shelves List */}
      {shelves
        .filter(
          (s) =>
            s.items.length > 0 &&
            s.items.some((it) => it.thumbnailUrl != null || it.stripeColor != null || it.videoId != null)
        )
        .map((shelf, shelfIdx) => {
          const isQuickPicks =
            shelf.type === 'QUICK_PICKS' || /quick picks|quick plays/i.test(shelf.title);
          const isHero =
            !isQuickPicks &&
            (shelf.type === 'HERO' ||
              (shelfIdx === 0 && shelf.type !== 'DEFAULT' && shelf.items[0]?.thumbnailUrl != null));
          const isMoodGenre = shelf.type === 'MOOD_GENRE';
          const isVideo = shelf.type === 'VIDEO';
          const isRanked = shelf.type === 'RANKED' || shelf.type === 'CHART_SONGS';

          const showAllAction =
            shelf.moreBrowseId && onOpenDetail
              ? () =>
                  onOpenDetail(
                    shelf.moreBrowseId!,
                    shelf.moreParams || undefined,
                    shelf.title,
                    shelf.subtitle
                  )
              : null;

          return (
            <section key={`${shelf.title}-${shelfIdx}`} className="flex flex-col pb-6.5">
              {/* Section Header */}
              <div className="px-2.5 py-2.5 flex items-center justify-between">
                <div className="overflow-hidden pr-3">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight leading-tight truncate">
                      {shelf.title}
                    </h2>
                    {(/diwali|festive|mollywood|tollywood|kollywood/i.test(shelf.title) || shelf.strapline) && (
                      <span className="px-2 py-0.5 rounded-full bg-accent-red/20 text-accent-red border border-accent-red/30 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 shrink-0">
                        <Sparkles className="w-2.5 h-2.5" />
                        {shelf.strapline || 'Trending'}
                      </span>
                    )}
                  </div>
                  {shelf.subtitle && (
                    <p className="text-sm font-medium text-white/60 truncate mt-0.5 leading-snug">
                      {shelf.subtitle}
                    </p>
                  )}
                </div>

                {/* Right Header Action: "Play all" + "< >" pagination for Quick picks, or "Show all" */}
                <div className="flex items-center gap-2 shrink-0 pl-3">
                  {isQuickPicks && (
                    <>
                      <button
                        onClick={() => handlePlayAll(shelf)}
                        className="px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-xs font-semibold text-white border border-white/15 flex items-center gap-1.5 cursor-pointer shadow-sm"
                        title="Play all tracks in order"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Play all</span>
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => scrollQuickPicks('left')}
                          className="w-8 h-8 rounded-full border border-white/15 hover:border-white/30 bg-white/5 hover:bg-white/15 flex items-center justify-center text-white/80 hover:text-white transition-all active:scale-90 cursor-pointer"
                          title="Previous page"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => scrollQuickPicks('right')}
                          className="w-8 h-8 rounded-full border border-white/15 hover:border-white/30 bg-white/5 hover:bg-white/15 flex items-center justify-center text-white/80 hover:text-white transition-all active:scale-90 cursor-pointer"
                          title="Next page"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </>
                  )}

                  {showAllAction && !isQuickPicks && (
                    <button
                      onClick={showAllAction}
                      className="text-sm font-medium text-accent-red hover:underline shrink-0 transition-colors cursor-pointer"
                    >
                      Show all
                    </button>
                  )}
                </div>
              </div>

              {/* 1. Quick picks / Quick plays: Authentic 4-Row Multi-Column Grid */}
              {isQuickPicks && (
                <div className="relative w-full group/quick">
                  <div
                    ref={quickPicksScrollRef}
                    className="grid grid-rows-4 grid-flow-col gap-x-5 sm:gap-x-7 gap-y-2.5 overflow-x-auto scroll-smooth scrollbar-none snap-x px-2.5 pb-2"
                    style={{
                      gridAutoColumns: 'clamp(280px, 32vw, 360px)',
                    }}
                  >
                    {shelf.items.map((item, itemIdx) => (
                      <div
                        key={itemIdx}
                        onClick={() => handleItemClick(item)}
                        className="flex items-center gap-3 p-1.5 rounded-xl hover:bg-white/[0.08] transition-all group/item cursor-pointer snap-start select-none"
                      >
                        {/* 48x48 Thumbnail with hover Play overlay */}
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-white/5 border border-white/10 shrink-0 relative">
                          <img
                            src={cleanThumbnailUrl(item.thumbnailUrl, item.videoId)}
                            alt={item.title}
                            referrerPolicy="no-referrer"
                            loading="lazy"
                            onError={(e) => handleImageError(e, item.title)}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover/item:scale-105"
                          />
                          <div className="absolute inset-0 bg-black/45 opacity-0 group-hover/item:opacity-100 transition-opacity flex items-center justify-center">
                            <Play className="w-4 h-4 fill-white text-white ml-0.5" />
                          </div>
                        </div>

                        {/* Track Info */}
                        <div className="overflow-hidden flex-1 min-w-0">
                          <h4 className="text-sm font-semibold text-white truncate leading-tight group-hover/item:text-accent-red transition-colors">
                            {item.title}
                          </h4>
                          <p className="text-xs text-white/55 truncate leading-tight mt-1 flex items-center gap-1">
                            {item.subtitle || 'Trending Track'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 2. HeroShelf (Lead shelf: aspectRatio 0.92, width 70vw max 320dp, bottom scrim) */}
              {isHero && !isQuickPicks && (
                <div className="flex gap-3.5 overflow-x-auto pb-2 scrollbar-none snap-x px-2.5">
                  {shelf.items.map((item, itemIdx) => (
                    <div
                      key={itemIdx}
                      onClick={() => handleItemClick(item)}
                      className="w-[70vw] max-w-[320px] aspect-[0.92/1] shrink-0 rounded-[18px] overflow-hidden bg-white/[0.06] border border-white/15 relative group cursor-pointer snap-start shadow-xl select-none"
                    >
                      <img
                        src={cleanThumbnailUrl(item.thumbnailUrl, item.videoId)}
                        alt={item.title}
                        referrerPolicy="no-referrer"
                        loading="lazy"
                        onError={(e) => handleImageError(e, item.title)}
                        className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                      />

                      {/* Scrim: verticalGradient from transparent to black 0.78 */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/[0.85] via-black/[0.30] to-transparent flex flex-col justify-end p-4 pt-9 pointer-events-none">
                        <h3 className="text-white font-bold text-lg sm:text-xl line-clamp-1 leading-tight group-hover:text-accent-red transition-colors">
                          {item.title}
                        </h3>
                        {item.subtitle && (
                          <p className="text-white/72 text-sm line-clamp-2 mt-1 leading-snug">
                            {item.subtitle}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 3. MoodGenreShelf (Pairs of 2 rows, width 170dp, height 50dp, left accent stripe) */}
              {isMoodGenre && !isQuickPicks && (
                <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-none snap-x px-2.5">
                  {Array.from({ length: Math.ceil(shelf.items.length / 2) }).map((_, colIdx) => {
                    const pair = shelf.items.slice(colIdx * 2, colIdx * 2 + 2);
                    return (
                      <div key={colIdx} className="flex flex-col gap-2.5 shrink-0 snap-start">
                        {pair.map((item, pIdx) => {
                          const stripe = getStripeColor(item.stripeColor);
                          return (
                            <div
                              key={pIdx}
                              onClick={() => handleItemClick(item)}
                              className="w-[170px] h-[50px] rounded-[12px] bg-white/[0.06] border border-white/15 hover:border-white/25 relative overflow-hidden flex items-center px-3.5 cursor-pointer group transition-all select-none"
                              style={{
                                background: `linear-gradient(90deg, ${stripe}40 0%, rgba(255,255,255,0.05) 100%)`,
                              }}
                            >
                              {/* 4px accent stripe on left */}
                              <div
                                className="absolute left-0 top-0 bottom-0 w-1 rounded-l-[12px]"
                                style={{ backgroundColor: stripe }}
                              />
                              <span className="text-sm font-semibold text-white truncate group-hover:text-accent-red transition-colors">
                                {item.title}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 4. VideoShelf (16:9 aspect ratio, 220dp width, bottom play badge) */}
              {isVideo && !isHero && !isQuickPicks && (
                <div className="flex gap-3.5 overflow-x-auto pb-2 scrollbar-none snap-x px-2.5">
                  {shelf.items.map((item, itemIdx) => (
                    <div
                      key={itemIdx}
                      onClick={() => handleItemClick(item)}
                      className="w-[220px] shrink-0 flex flex-col cursor-pointer group snap-start select-none"
                    >
                      <div className="w-full aspect-[1.778/1] rounded-[12px] overflow-hidden bg-white/[0.06] border border-white/15 relative">
                        <img
                          src={cleanThumbnailUrl(item.thumbnailUrl, item.videoId)}
                          alt={item.title}
                          referrerPolicy="no-referrer"
                          loading="lazy"
                          onError={(e) => handleImageError(e, item.title)}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/[0.45] to-transparent pointer-events-none" />

                        {/* Video play icon circle badge at bottom right */}
                        <div className="absolute bottom-2 right-2 w-6 h-6 rounded-full bg-black/[0.65] flex items-center justify-center text-white">
                          <Play className="w-3 h-3 fill-white ml-0.5" />
                        </div>

                        {/* Optional rank badge in top-left */}
                        {item.customIndex && (
                          <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-[6px] bg-black/[0.72] text-[11px] font-bold text-white border border-white/10">
                            #{item.customIndex}
                          </div>
                        )}
                      </div>

                      <div className="mt-2.5">
                        <h3 className="text-[15px] font-semibold text-white truncate leading-tight group-hover:text-accent-red transition-colors">
                          {item.title}
                        </h3>
                        {item.subtitle && (
                          <p className="text-[13px] text-white/60 truncate mt-1 leading-tight">
                            {item.subtitle}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 5. RankedShelf (1:1 square, 150dp width, customIndex badge in top-left, e.g. Today's Hits & Top Charts) */}
              {isRanked && !isHero && !isMoodGenre && !isVideo && !isQuickPicks && (
                <div className="flex gap-3.5 overflow-x-auto pb-2 scrollbar-none snap-x px-2.5">
                  {shelf.items.map((item, itemIdx) => (
                    <div
                      key={itemIdx}
                      onClick={() => handleItemClick(item)}
                      className="w-[150px] shrink-0 flex flex-col cursor-pointer group snap-start select-none"
                    >
                      <div className="w-full aspect-square rounded-[12px] overflow-hidden bg-white/[0.06] border border-white/15 relative">
                        <img
                          src={cleanThumbnailUrl(item.thumbnailUrl, item.videoId)}
                          alt={item.title}
                          referrerPolicy="no-referrer"
                          loading="lazy"
                          onError={(e) => handleImageError(e, item.title)}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />

                        {/* Play overlay on hover */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <div className="w-10 h-10 rounded-full bg-accent-red flex items-center justify-center text-white shadow-lg">
                            <Play className="w-4 h-4 fill-white ml-0.5" />
                          </div>
                        </div>

                        {/* #{customIndex} rank badge in top-left */}
                        {(item.customIndex || shelf.type === 'CHART_SONGS') && (
                          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-[6px] bg-black/[0.72] text-[11px] font-bold text-white border border-white/10 shadow-sm">
                            #{item.customIndex || itemIdx + 1}
                          </div>
                        )}
                      </div>

                      <div className="mt-2.5">
                        <h3 className="text-[15px] font-semibold text-white truncate leading-tight group-hover:text-accent-red transition-colors">
                          {item.title}
                        </h3>
                        {item.subtitle && (
                          <p className="text-[13px] text-white/60 truncate mt-1 leading-tight">
                            {item.subtitle}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 6. Standard Compact Shelf (1:1 square, 150dp width, 12dp rounded) */}
              {!isHero && !isMoodGenre && !isVideo && !isRanked && !isQuickPicks && (
                <div className="flex gap-3.5 overflow-x-auto pb-2 scrollbar-none snap-x px-2.5">
                  {shelf.items.map((item, itemIdx) => (
                    <div
                      key={itemIdx}
                      onClick={() => handleItemClick(item)}
                      className="w-[150px] shrink-0 flex flex-col cursor-pointer group snap-start select-none"
                    >
                      <div className="w-full aspect-square rounded-[12px] overflow-hidden bg-white/[0.06] border border-white/15 relative">
                        <img
                          src={cleanThumbnailUrl(item.thumbnailUrl, item.videoId)}
                          alt={item.title}
                          referrerPolicy="no-referrer"
                          loading="lazy"
                          onError={(e) => handleImageError(e, item.title)}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />

                        {/* Play overlay on hover if item is a track */}
                        {item.videoId && (
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <div className="w-10 h-10 rounded-full bg-accent-red flex items-center justify-center text-white shadow-lg">
                              <Play className="w-4 h-4 fill-white ml-0.5" />
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="mt-2.5">
                        <h3 className="text-[15px] font-semibold text-white truncate leading-tight group-hover:text-accent-red transition-colors">
                          {item.title}
                        </h3>
                        {item.subtitle && (
                          <p className="text-[13px] text-white/60 truncate mt-1 leading-tight">
                            {item.subtitle}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}

      {/* Continuation Target & Infinite Scroll Loading */}
      <div ref={observerTarget} className="py-6 flex justify-center">
        {loadingMore && (
          <div className="flex items-center gap-2 text-xs text-white/50 animate-pulse">
            <div className="w-4 h-4 border-2 border-accent-red border-t-transparent rounded-full animate-spin" />
            <span>Loading more shelves...</span>
          </div>
        )}
      </div>
    </div>
  );
};
