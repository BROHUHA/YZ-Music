import React, { useEffect, useState, useMemo } from 'react';
import { HomeShelf, ShelfItem, Song } from '../types';
import { innertubeService } from '../services/innertube';
import { usePlayerStore } from '../stores/playerStore';
import {
  Sparkles,
  BarChart3,
  ListMusic,
  Play,
  ChevronRight,
  TrendingUp,
  ExternalLink,
} from 'lucide-react';

interface ExploreViewProps {
  onOpenDetail?: (
    browseId: string,
    params?: string,
    title?: string,
    subtitle?: string,
    thumbnailUrl?: string | null,
    type?: string
  ) => void;
}

type FilterCategory = 'All' | 'Charts' | 'New Releases' | 'Moods & Genres' | 'Trending';

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

export const ExploreView: React.FC<ExploreViewProps> = ({ onOpenDetail }) => {
  const [shelves, setShelves] = useState<HomeShelf[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('All');
  const { playSong } = usePlayerStore();

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    innertubeService
      .getExplore()
      .then((data) => {
        if (!isMounted) return;
        setShelves(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load Explore feed', err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleItemClick = (item: ShelfItem) => {
    if (item.videoId) {
      playSong({
        videoId: item.videoId,
        title: item.title,
        artist: cleanArtistFromSubtitle(item.subtitle || '') || 'Explore',
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

  const handleSongPlay = (song: Song, queue?: Song[]) => {
    playSong(song, queue);
  };

  const getStripeColor = (num?: number | null, index?: number): string => {
    if (num != null) {
      const hex = (num & 0x00ffffff).toString(16).padStart(6, '0');
      return `#${hex}`;
    }
    const fallbackColors = ['#6C5CE7', '#E17055', '#00B894', '#0984E3', '#FD79A8'];
    return fallbackColors[(index || 0) % fallbackColors.length];
  };

  const navChips: {
    category: FilterCategory;
    title: string;
    browseId: string;
    params?: string;
    icon: any;
  }[] = [
    {
      category: 'Charts',
      title: 'Charts',
      browseId: 'FEmusic_charts',
      icon: BarChart3,
    },
    {
      category: 'New Releases',
      title: 'New Releases',
      browseId: 'FEmusic_new_releases',
      icon: Sparkles,
    },
    {
      category: 'Moods & Genres',
      title: 'Moods & Genres',
      browseId: 'FEmusic_moods_and_genres',
      icon: ListMusic,
    },
    {
      category: 'Trending',
      title: 'Trending',
      browseId: 'FEmusic_charts',
      params: 'ggMPOg15dG11c2ljX2NoYXJ0cw%3D%3D',
      icon: TrendingUp,
    },
  ];

  // Identify navigation shelf and separate it from content shelves (mirrors ExploreScreen.kt)
  const navShelf = useMemo(() => {
    return shelves.find(
      (s) =>
        s.type === 'NAV_CHIPS' ||
        s.items.every(
          (it) => it.thumbnailUrl == null && (it.browseId?.startsWith('FEmusic_') || it.videoId == null)
        ) ||
        (s.title.toLowerCase() === 'explore' && s.items.every((it) => it.thumbnailUrl == null)) ||
        s.title.toLowerCase() === 'navigation'
    );
  }, [shelves]);

  const contentShelves = useMemo(() => {
    return shelves.filter(
      (s) => s !== navShelf && s.items.some((it) => it.thumbnailUrl != null)
    );
  }, [shelves, navShelf]);

  // Filter content shelves according to active category
  const filteredShelves = useMemo(() => {
    if (activeFilter === 'All') return contentShelves;

    const filtered = contentShelves.filter((s) => {
      const titleLower = s.title.toLowerCase();
      const straplineLower = (s.strapline || '').toLowerCase();
      const isMood =
        s.type === 'MOOD_GENRE' ||
        s.items.some((it) => it.stripeColor != null || it.browseId?.includes('moods_and_genres'));
      const isChart =
        s.type === 'CHART_SONGS' ||
        s.type === 'CHART_ARTISTS' ||
        s.type === 'CHART_VIDEOS' ||
        s.type === 'RANKED' ||
        titleLower.includes('chart') ||
        titleLower.includes('top') ||
        titleLower.includes('viral') ||
        titleLower.includes('hit') ||
        straplineLower.includes('chart') ||
        straplineLower.includes('top');
      const isTrending =
        titleLower.includes('trending') ||
        straplineLower.includes('trending') ||
        s.type === 'CHART_VIDEOS' ||
        s.type === 'VIDEO';
      const isNewReleases =
        titleLower.includes('release') ||
        titleLower.includes('album') ||
        titleLower.includes('single') ||
        straplineLower.includes('release');

      switch (activeFilter) {
        case 'Charts':
          return isChart;
        case 'New Releases':
          return isNewReleases || (!isMood && !isChart);
        case 'Moods & Genres':
          return isMood;
        case 'Trending':
          return isTrending;
        default:
          return true;
      }
    });

    return filtered.length > 0 ? filtered : contentShelves;
  }, [contentShelves, activeFilter]);

  if (loading) {
    return (
      <div className="p-4 sm:p-6 pb-28 md:pb-8 flex flex-col gap-8 animate-pulse max-w-7xl mx-auto w-full">
        {/* Title skeleton */}
        <div className="h-10 w-36 bg-white/10 rounded-xl" />

        {/* Navigation chips skeleton */}
        <div className="flex gap-3 overflow-hidden">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-10 w-32 bg-white/10 rounded-full shrink-0" />
          ))}
        </div>

        {/* Hero banner skeleton */}
        <div className="aspect-[16/9] sm:aspect-[21/9] w-full bg-white/10 rounded-2xl" />

        {/* Shelves skeletons */}
        <div className="flex flex-col gap-4">
          <div className="h-6 w-48 bg-white/10 rounded-lg" />
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 bg-white/5 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 pb-28 md:pb-8 flex flex-col gap-8 max-w-7xl mx-auto w-full">
      {/* 1. Discovery Subtitle & Badge */}
      <div className="flex items-center gap-2.5 -mt-1 sm:-mt-2 mb-1">
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-accent-red/20 text-accent-red border border-accent-red/30 uppercase tracking-wider shrink-0">
          <Sparkles className="w-3 h-3" />
          Discovery
        </span>
        <p className="text-xs sm:text-sm text-white/50">
          Discover top charts, trending tracks, new albums, and global genres
        </p>
      </div>

      {/* 2. Top Interactive Quick Navigation Pills (Instant Filtering + Deep Browse) */}
      <div
        className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none snap-x -mx-4 px-4 sm:mx-0 sm:px-0"
        style={{
          maskImage: 'linear-gradient(to right, black 0%, black calc(100% - 36px), transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to right, black 0%, black calc(100% - 36px), transparent 100%)',
        }}
      >
        {/* All pill */}
        <button
          onClick={() => setActiveFilter('All')}
          className={`flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-xs sm:text-sm transition-all duration-200 shrink-0 snap-start active:scale-95 shadow-sm ${
            activeFilter === 'All'
              ? 'bg-white text-black shadow-lg font-bold scale-[1.02]'
              : 'liquid-glass-pill text-white/80 hover:text-white'
          }`}
        >
          <span>All</span>
        </button>

        {navChips.map((chip, idx) => {
          const Icon = chip.icon;
          const isActive = activeFilter === chip.category;
          return (
            <div key={idx} className="flex items-center shrink-0 snap-start">
              <button
                onClick={() => {
                  if (onOpenDetail) {
                    onOpenDetail(
                      chip.browseId,
                      chip.params,
                      chip.title,
                      undefined,
                      null,
                      chip.category === 'Charts' ? 'CHARTS' : 'CATEGORY'
                    );
                  }
                  setActiveFilter(chip.category);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-xs sm:text-sm transition-all duration-200 group active:scale-95 shadow-sm ${
                  isActive
                    ? 'bg-gradient-to-r from-accent-red to-[#FF4B63] text-white shadow-[0_0_20px_rgba(250,45,72,0.4)] border border-white/20'
                    : 'liquid-glass-pill text-white/80 hover:text-white'
                }`}
              >
                <Icon
                  className={`w-4 h-4 transition-transform group-hover:scale-110 ${
                    isActive ? 'text-white' : 'text-accent-red'
                  }`}
                />
                <span className="whitespace-nowrap">{chip.title}</span>

                {/* Direct open page action icon */}
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onOpenDetail) {
                      onOpenDetail(
                        chip.browseId,
                        chip.params,
                        chip.title,
                        undefined,
                        null,
                        chip.category === 'Charts' ? 'CHARTS' : 'CATEGORY'
                      );
                    }
                  }}
                  title={`Open full ${chip.title} page`}
                  className={`p-1 rounded-full hover:bg-white/20 ml-0.5 transition-colors ${
                    isActive ? 'text-white/90' : 'text-white/40 hover:text-white'
                  }`}
                >
                  <ExternalLink className="w-3 h-3" />
                </span>
              </button>
            </div>
          );
        })}
      </div>

      {/* 3. Categorized Discovery Shelves */}
      {filteredShelves.map((shelf, shelfIdx) => {
        const validArtworkItems = shelf.items.filter((it) => it.thumbnailUrl != null);
        const isHero =
          validArtworkItems.length > 0 &&
          (shelf.type === 'HERO' ||
            (shelfIdx === 0 &&
              activeFilter === 'All' &&
              (shelf.title.toLowerCase().includes('featured') ||
                shelf.title.toLowerCase().includes('spotlight'))));

        const isRankedSongs =
          shelf.type === 'CHART_SONGS' ||
          (shelf.title.toLowerCase().includes('song') && shelf.items.some((it) => it.customIndex != null));

        const isRankedArtists =
          shelf.type === 'CHART_ARTISTS' ||
          (shelf.title.toLowerCase().includes('artist') && shelf.items.some((it) => it.customIndex != null)) ||
          shelf.items.some((it) => it.browseId?.startsWith('UC'));

        const isVideos =
          shelf.type === 'CHART_VIDEOS' ||
          shelf.type === 'VIDEO' ||
          shelf.title.toLowerCase().includes('video') ||
          shelf.title.toLowerCase().includes('trending') ||
          shelf.items.every((it) => it.isVideo);

        const isMoodGenre =
          shelf.type === 'MOOD_GENRE' ||
          shelf.items.some((it) => it.stripeColor != null || it.browseId?.startsWith('FEmusic_moods_and_genres'));

        // Prepare playlist/queue for ranked song and video shelves
        const playableShelfSongs: Song[] = shelf.items
          .filter((it) => it.videoId != null)
          .map((it) => ({
            videoId: it.videoId!,
            title: it.title,
            artist: cleanArtistFromSubtitle(it.subtitle || '') || 'Top Charts',
            thumbnailUrl: it.thumbnailUrl || null,
            isVideo: it.isVideo,
          }));

        return (
          <section key={`${shelf.title}-${shelfIdx}`} className="flex flex-col gap-3.5">
            {/* Section Header with Strapline */}
            <div className="flex items-center justify-between px-0.5">
              <div className="overflow-hidden pr-3">
                {shelf.strapline && (
                  <span className="text-[11px] font-bold uppercase tracking-widest text-accent-red mb-0.5 block">
                    {shelf.strapline}
                  </span>
                )}
                <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white truncate">
                  {shelf.title}
                </h2>
                {shelf.subtitle && shelf.subtitle !== shelf.strapline && (
                  <p className="text-xs text-white/50 truncate mt-0.5">{shelf.subtitle}</p>
                )}
              </div>

              {shelf.moreBrowseId && onOpenDetail && (
                <button
                  onClick={() => onOpenDetail(shelf.moreBrowseId!, shelf.moreParams || undefined)}
                  className="shrink-0 flex items-center gap-1 text-xs font-semibold text-accent-red hover:text-white px-2.5 py-1 rounded-full hover:bg-white/10 transition-colors"
                >
                  <span>Show all</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* A. Editorial Hero Shelf (16:9 Widescreen Card with Gradient Overlay) */}
            {isHero && validArtworkItems.length > 0 && (
              <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none snap-x -mx-4 px-4 sm:mx-0 sm:px-0">
                {validArtworkItems.map((item, itemIdx) => (
                  <div
                    key={itemIdx}
                    onClick={() => handleItemClick(item)}
                    className="w-[280px] sm:w-[420px] md:w-[480px] shrink-0 aspect-[16/9] rounded-2xl overflow-hidden relative border border-white/10 shadow-2xl cursor-pointer group snap-start liquid-glass-card"
                  >
                    <img
                      src={item.thumbnailUrl || '/logo.svg'}
                      alt={item.title}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.currentTarget.src = '/logo.svg';
                      }}
                      className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col justify-end p-4 sm:p-5">
                      <h3 className="text-base sm:text-lg font-bold text-white line-clamp-1 group-hover:text-accent-red transition-colors">
                        {item.title}
                      </h3>
                      {item.subtitle && (
                        <p className="text-xs text-white/70 line-clamp-2 mt-0.5">{item.subtitle}</p>
                      )}
                    </div>

                    {/* Floating play button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleItemClick(item);
                      }}
                      className="absolute top-3 right-3 sm:top-4 sm:right-4 w-11 h-11 rounded-full bg-accent-red text-white flex items-center justify-center shadow-[0_4px_20px_rgba(250,45,72,0.6)] opacity-90 group-hover:opacity-100 group-hover:scale-110 active:scale-95 transition-all duration-300"
                    >
                      <Play className="w-5 h-5 fill-white ml-0.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* B. Ranked Songs Shelf (Apple Music Charts format: 4 rows stacked vertically per column) */}
            {isRankedSongs && !isHero && (
              <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none snap-x -mx-4 px-4 sm:mx-0 sm:px-0">
                {Array.from({ length: Math.ceil(shelf.items.length / 4) }).map((_, colIdx) => {
                  const columnItems = shelf.items.slice(colIdx * 4, colIdx * 4 + 4);
                  return (
                    <div
                      key={colIdx}
                      className="w-[300px] sm:w-[320px] shrink-0 flex flex-col gap-2 snap-start"
                    >
                      {columnItems.map((item, rowIdx) => {
                        const rankNumber = item.customIndex || colIdx * 4 + rowIdx + 1;
                        return (
                          <div
                            key={rowIdx}
                            onClick={() => {
                              if (item.videoId) {
                                const songToPlay: Song = {
                                  videoId: item.videoId,
                                  title: item.title,
                                  artist: cleanArtistFromSubtitle(item.subtitle || '') || 'Top Charts',
                                  thumbnailUrl: item.thumbnailUrl || null,
                                  isVideo: item.isVideo,
                                };
                                handleSongPlay(songToPlay, playableShelfSongs);
                              } else {
                                handleItemClick(item);
                              }
                            }}
                            className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/[0.08] transition-all cursor-pointer group border border-transparent hover:border-white/10 active:scale-[0.98]"
                          >
                            {/* Rank Number */}
                            <span className="w-6 text-center text-sm font-bold text-white/60 group-hover:text-accent-red transition-colors shrink-0">
                              {rankNumber}
                            </span>

                            {/* 48px square artwork */}
                            <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-white/5 relative border border-white/10 shadow-sm">
                              <img
                                src={item.thumbnailUrl || '/logo.svg'}
                                alt={item.title}
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                  e.currentTarget.src = '/logo.svg';
                                }}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Play className="w-4 h-4 fill-white text-white ml-0.5" />
                              </div>
                            </div>

                            {/* Title & Artist */}
                            <div className="overflow-hidden flex-1">
                              <h4 className="text-sm font-semibold text-white truncate leading-tight group-hover:text-accent-red transition-colors">
                                {item.title}
                              </h4>
                              {item.subtitle && (
                                <p className="text-xs text-white/50 truncate mt-0.5">{item.subtitle}</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}

            {/* C. Ranked Artists Shelf (Circular Avatars with Rank Badges) */}
            {isRankedArtists && !isHero && !isRankedSongs && (
              <div className="flex gap-4 sm:gap-5 overflow-x-auto pb-2 scrollbar-none snap-x -mx-4 px-4 sm:mx-0 sm:px-0">
                {shelf.items.map((item, itemIdx) => (
                  <div
                    key={itemIdx}
                    onClick={() => handleItemClick(item)}
                    className="w-28 sm:w-32 shrink-0 flex flex-col items-center text-center gap-2.5 group cursor-pointer snap-start active:scale-95 transition-transform"
                  >
                    <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden bg-white/5 relative border-2 border-white/10 shadow-xl liquid-glass-card group-hover:border-accent-red/60 transition-all">
                      <img
                        src={item.thumbnailUrl || '/logo.svg'}
                        alt={item.title}
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          e.currentTarget.src = '/logo.svg';
                        }}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      {item.customIndex && (
                        <div className="absolute bottom-1 right-1 px-2 py-0.5 rounded-full bg-accent-red text-[10px] font-bold text-white shadow-md border border-white/20">
                          #{item.customIndex}
                        </div>
                      )}
                    </div>
                    <div className="w-full px-1">
                      <h4 className="text-xs sm:text-sm font-semibold text-white truncate group-hover:text-accent-red transition-colors">
                        {item.title}
                      </h4>
                      {item.subtitle && (
                        <p className="text-[11px] text-white/50 truncate mt-0.5">{item.subtitle}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* D. Video Charts & Trending Videos (16:9 widescreen cards with rank + play badge) */}
            {isVideos && !isHero && !isRankedSongs && !isRankedArtists && (
              <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none snap-x -mx-4 px-4 sm:mx-0 sm:px-0">
                {shelf.items.map((item, itemIdx) => (
                  <div
                    key={itemIdx}
                    onClick={() => {
                      if (item.videoId) {
                        const songToPlay: Song = {
                          videoId: item.videoId,
                          title: item.title,
                          artist: cleanArtistFromSubtitle(item.subtitle || '') || 'Trending Videos',
                          thumbnailUrl: item.thumbnailUrl || null,
                          isVideo: true,
                        };
                        handleSongPlay(songToPlay, playableShelfSongs);
                      } else {
                        handleItemClick(item);
                      }
                    }}
                    className="w-[230px] sm:w-[270px] shrink-0 flex flex-col gap-2 group cursor-pointer snap-start active:scale-[0.98] transition-transform"
                  >
                    <div className="w-full aspect-[16/9] rounded-xl overflow-hidden bg-white/5 relative border border-white/10 shadow-lg liquid-glass-card">
                      <img
                        src={item.thumbnailUrl || '/logo.svg'}
                        alt={item.title}
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          e.currentTarget.src = '/logo.svg';
                        }}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />

                      {/* Rank badge top-left */}
                      {item.customIndex && (
                        <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-md text-xs font-bold text-white border border-white/10">
                          #{item.customIndex}
                        </div>
                      )}

                      {/* Video play badge bottom-right */}
                      <div className="absolute bottom-2.5 right-2.5 w-7 h-7 rounded-full bg-black/70 backdrop-blur-md flex items-center justify-center text-white border border-white/10 group-hover:bg-accent-red group-hover:scale-110 transition-all">
                        <Play className="w-3.5 h-3.5 fill-white ml-0.5" />
                      </div>
                    </div>

                    <div className="px-0.5">
                      <h3 className="text-sm font-semibold text-white truncate leading-tight group-hover:text-accent-red transition-colors">
                        {item.title}
                      </h3>
                      {item.subtitle && (
                        <p className="text-xs text-white/50 truncate mt-0.5">{item.subtitle}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* E. Moods & Genres Shelf (2-row vertical stack per column with vibrant gradient cards) */}
            {isMoodGenre && !isHero && !isRankedSongs && !isRankedArtists && !isVideos && (
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none snap-x -mx-4 px-4 sm:mx-0 sm:px-0">
                {Array.from({ length: Math.ceil(shelf.items.length / 2) }).map((_, colIdx) => {
                  const pair = shelf.items.slice(colIdx * 2, colIdx * 2 + 2);
                  return (
                    <div key={colIdx} className="flex flex-col gap-2.5 shrink-0 snap-start">
                      {pair.map((item, pIdx) => {
                        const stripe = getStripeColor(item.stripeColor, colIdx * 2 + pIdx);
                        return (
                          <div
                            key={pIdx}
                            onClick={() => handleItemClick(item)}
                            className="w-[170px] sm:w-[190px] h-[54px] rounded-xl liquid-glass-card border border-white/10 hover:border-white/30 px-3.5 flex items-center gap-2.5 cursor-pointer group transition-all relative overflow-hidden active:scale-95 select-none"
                            style={{
                              background: `linear-gradient(90deg, ${stripe}40 0%, rgba(255,255,255,0.03) 100%)`,
                            }}
                          >
                            <div
                              className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl"
                              style={{ backgroundColor: stripe }}
                            />
                            <span className="text-xs sm:text-sm font-semibold text-white truncate group-hover:text-accent-red transition-colors">
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

            {/* F. Standard Releases / Albums Shelf */}
            {!isHero && !isRankedSongs && !isRankedArtists && !isVideos && !isMoodGenre && (
              <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none snap-x -mx-4 px-4 sm:mx-0 sm:px-0">
                {shelf.items.filter(it => it.thumbnailUrl != null).map((item, itemIdx) => (
                  <div
                    key={itemIdx}
                    onClick={() => handleItemClick(item)}
                    className="w-36 sm:w-44 shrink-0 flex flex-col gap-2 group cursor-pointer snap-start active:scale-95 transition-transform"
                  >
                    <div className="w-full aspect-square rounded-2xl overflow-hidden bg-white/5 relative border border-white/10 shadow-xl liquid-glass-card">
                      <img
                        src={item.thumbnailUrl || '/logo.svg'}
                        alt={item.title}
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          e.currentTarget.src = '/logo.svg';
                        }}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleItemClick(item);
                          }}
                          className="w-12 h-12 rounded-full bg-gradient-to-tr from-accent-red to-[#FF4B63] text-white flex items-center justify-center shadow-[0_0_20px_rgba(250,45,72,0.6)] border border-white/20 transform scale-75 group-hover:scale-100 active:scale-90 transition-all duration-300"
                        >
                          <Play className="w-5 h-5 fill-white ml-0.5" />
                        </button>
                      </div>
                    </div>
                    <div className="px-0.5">
                      <h3 className="text-sm font-semibold text-white truncate leading-tight group-hover:text-accent-red transition-colors">
                        {item.title}
                      </h3>
                      {item.subtitle && (
                        <p className="text-xs text-white/50 truncate mt-0.5">{item.subtitle}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}

      {/* Empty fallback for filter */}
      {filteredShelves.length === 0 && (
        <div className="text-center py-20 text-white/40 text-sm">
          No shelves found in this category.
        </div>
      )}
    </div>
  );
};
