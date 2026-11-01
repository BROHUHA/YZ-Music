import React, { useEffect, useState, useMemo } from 'react';
import { Play, Shuffle, Music, ChevronRight, Heart, Plus } from 'lucide-react';
import { DetailPage, Song, ShelfItem, HomeShelf } from '../types';
import { innertubeService } from '../services/innertube';
import { usePlayerStore } from '../stores/playerStore';
import { useAuthStore } from '../stores/authStore';

interface DetailViewProps {
  browseId: string;
  params?: string;
  initialTitle?: string;
  initialSubtitle?: string;
  initialThumbnailUrl?: string | null;
  initialType?: string;
  onBack: () => void;
  onOpenDetail?: (
    browseId: string,
    params?: string,
    title?: string,
    subtitle?: string,
    thumbnailUrl?: string | null,
    type?: string
  ) => void;
  onTitleLoaded?: (title: string) => void;
}

export const DetailView: React.FC<DetailViewProps> = ({
  browseId,
  params,
  initialTitle,
  initialSubtitle,
  initialThumbnailUrl,
  initialType,
  onBack,
  onOpenDetail,
  onTitleLoaded,
}) => {
  const [detail, setDetail] = useState<DetailPage | null>(null);
  const [loading, setLoading] = useState(true);
  const { playSong, currentSong, isPlaying, likeStatuses, toggleLike, addToQueue, currentPalette } = usePlayerStore();

  // Active Artwork URL with smart multi-tier fallback (high-res -> standard -> track fallback -> null)
  const [artworkUrl, setArtworkUrl] = useState<string | null>(initialThumbnailUrl || null);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
    const candidate =
      detail?.thumbnailUrl ||
      initialThumbnailUrl ||
      detail?.songs?.[0]?.thumbnailUrl ||
      null;
    setArtworkUrl(candidate);
  }, [detail?.thumbnailUrl, initialThumbnailUrl, detail?.songs]);

  const handleArtworkError = () => {
    if (!artworkUrl) {
      setImageError(true);
      return;
    }

    // Attempt 1: If YouTube high-res resizing parameters failed (e.g. =w1200 or =s800)
    if (artworkUrl.includes('=w') || artworkUrl.includes('=s')) {
      const downgraded = artworkUrl
        .replace(/=w\d+(-h\d+)?/g, '=w540-h540')
        .replace(/=s\d+/g, '=s500');
      if (downgraded !== artworkUrl) {
        setArtworkUrl(downgraded);
        return;
      }
    }

    // Attempt 2: If maxresdefault failed, fallback to hqdefault
    if (artworkUrl.includes('maxresdefault.jpg')) {
      setArtworkUrl(artworkUrl.replace('maxresdefault.jpg', 'hqdefault.jpg'));
      return;
    }
    if (artworkUrl.includes('sddefault.jpg')) {
      setArtworkUrl(artworkUrl.replace('sddefault.jpg', 'hqdefault.jpg'));
      return;
    }

    // Attempt 3: If current is not the 1st song's thumbnail, fall back to 1st song
    const song0Thumb = detail?.songs?.[0]?.thumbnailUrl;
    if (song0Thumb && song0Thumb !== artworkUrl) {
      setArtworkUrl(song0Thumb);
      return;
    }

    // Attempt 4: Fall back to 2nd song's thumbnail if available
    const song1Thumb = detail?.songs?.[1]?.thumbnailUrl;
    if (song1Thumb && song1Thumb !== artworkUrl) {
      setArtworkUrl(song1Thumb);
      return;
    }

    // Final: No valid images found - disable image and show glass Music placeholder
    setImageError(true);
    setArtworkUrl(null);
  };

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    if (browseId.startsWith('UP_')) {
      const { userPlaylists } = useAuthStore.getState();
      const pl = userPlaylists.find((p) => p.id === browseId);
      if (pl) {
        const page: DetailPage = {
          browseId: pl.id,
          title: pl.title,
          subtitle: `Playlist • ${pl.author}`,
          thumbnailUrl: pl.thumbnailUrl || pl.songs?.[0]?.thumbnailUrl || null,
          type: 'PLAYLIST',
          songs: pl.songs || [],
          trackCount: pl.songCount,
          description: pl.description || 'Personal playlist',
        };
        setDetail(page);
        if (onTitleLoaded) onTitleLoaded(pl.title);
        setLoading(false);
        return;
      }
    }

    if (browseId === 'local:downloads' || browseId === 'local:all') {
      const isDownloads = browseId === 'local:downloads';
      setDetail({
        browseId,
        title: isDownloads ? 'Downloads' : 'Local Music',
        subtitle: isDownloads ? 'Downloaded songs on device' : 'Audio files on device',
        thumbnailUrl: null,
        type: 'PLAYLIST',
        songs: [],
        trackCount: 0,
        description: isDownloads
          ? 'Tracks saved for offline playback on this device.'
          : 'Local audio files stored on your device.',
      });
      if (onTitleLoaded) onTitleLoaded(isDownloads ? 'Downloads' : 'Local Music');
      setLoading(false);
      return;
    }

    if (browseId === 'FEmusic_history') {
      const { account } = useAuthStore.getState();
      let localHistory: Song[] = [];
      try {
        const raw = localStorage.getItem('yz_playback_history');
        if (raw) localHistory = JSON.parse(raw);
      } catch (e) {
        console.warn('Failed to parse history', e);
      }

      innertubeService
        .getHistory()
        .then((remoteSongs) => {
          if (!isMounted) return;
          const merged = remoteSongs.length > 0 ? remoteSongs : localHistory;
          setDetail({
            browseId: 'FEmusic_history',
            title: 'Your Replay',
            subtitle: `Listening History • ${account?.name || 'Local'}`,
            thumbnailUrl: merged[0]?.thumbnailUrl || null,
            type: 'PLAYLIST',
            songs: merged,
            trackCount: merged.length,
            description:
              merged.length > 0
                ? 'Your recently played songs and listening statistics.'
                : 'Songs you play will appear here in your personal replay history.',
          });
          if (onTitleLoaded) onTitleLoaded('Your Replay');
          setLoading(false);
        })
        .catch(() => {
          if (!isMounted) return;
          setDetail({
            browseId: 'FEmusic_history',
            title: 'Your Replay',
            subtitle: `Listening History • ${account?.name || 'Local'}`,
            thumbnailUrl: localHistory[0]?.thumbnailUrl || null,
            type: 'PLAYLIST',
            songs: localHistory,
            trackCount: localHistory.length,
            description:
              localHistory.length > 0
                ? 'Your recently played songs and listening statistics.'
                : 'Songs you play will appear here in your personal replay history.',
          });
          if (onTitleLoaded) onTitleLoaded('Your Replay');
          setLoading(false);
        });
      return;
    }

    if (browseId === 'VLLM') {
      const { likedSongs, account } = useAuthStore.getState();
      innertubeService
        .getBrowse('VLLM', params, {
          title: 'Liked Music',
          subtitle: `Auto Playlist • ${account?.name || 'Local'}`,
        })
        .then((remoteData) => {
          if (!isMounted) return;
          const songs = remoteData.songs && remoteData.songs.length > 0 ? remoteData.songs : likedSongs;
          setDetail({
            ...remoteData,
            browseId: 'VLLM',
            title: 'Liked Music',
            subtitle: `Auto Playlist • ${account?.name || 'Local'}`,
            thumbnailUrl: songs[0]?.thumbnailUrl || remoteData.thumbnailUrl || null,
            type: 'PLAYLIST',
            songs,
            trackCount: songs.length,
          });
          if (onTitleLoaded) onTitleLoaded('Liked Music');
          setLoading(false);
        })
        .catch(() => {
          if (!isMounted) return;
          setDetail({
            browseId: 'VLLM',
            title: 'Liked Music',
            subtitle: `Auto Playlist • ${account?.name || 'Local'}`,
            thumbnailUrl: likedSongs[0]?.thumbnailUrl || null,
            type: 'PLAYLIST',
            songs: likedSongs,
            trackCount: likedSongs.length,
            description: 'Songs you have liked in YZ Music',
          });
          if (onTitleLoaded) onTitleLoaded('Liked Music');
          setLoading(false);
        });
      return;
    }

    innertubeService
      .getBrowse(browseId, params, {
        title: initialTitle,
        subtitle: initialSubtitle,
        thumbnailUrl: initialThumbnailUrl,
        type: initialType,
      })
      .then((data) => {
        if (!isMounted) return;
        setDetail(data);
        if (onTitleLoaded && data.title) {
          onTitleLoaded(data.title);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load detail page', err);
        if (isMounted) {
          if (browseId === 'VLLM') {
            const { likedSongs, account } = useAuthStore.getState();
            setDetail({
              browseId: 'VLLM',
              title: 'Liked Music',
              subtitle: `Auto Playlist • ${account?.name || 'Local'}`,
              thumbnailUrl: likedSongs[0]?.thumbnailUrl || null,
              type: 'PLAYLIST',
              songs: likedSongs,
              trackCount: likedSongs.length,
              description: 'Songs you have liked in YZ Music',
            });
          } else if (browseId === 'FEmusic_history') {
            const { account } = useAuthStore.getState();
            setDetail({
              browseId: 'FEmusic_history',
              title: 'Your Replay',
              subtitle: `Listening History • ${account?.name || 'Local'}`,
              thumbnailUrl: null,
              type: 'PLAYLIST',
              songs: [],
              trackCount: 0,
              description:
                'Full listening history sync requires a YouTube Music Web session. You can connect your session cookie in the Account modal for complete real-time history.',
            });
          } else if (browseId === 'FEmusic_charts') {
            setDetail({
              browseId: 'FEmusic_charts',
              title: 'Charts',
              subtitle: 'Official Top 100 & Viral Charts',
              thumbnailUrl: 'https://i.ytimg.com/vi/Etkd-07gnxM/hqdefault.jpg',
              type: 'CHARTS',
              songs: [],
              trackCount: 4,
              description: 'Official global and regional music charts, trending videos and top songs',
              shelves: [
                {
                  title: 'Top 100 & Viral Charts',
                  subtitle: 'Official charts updated daily',
                  strapline: 'TOP 100',
                  type: 'DEFAULT' as any,
                  items: [
                    {
                      title: 'Top 100: Global',
                      subtitle: 'The most played songs globally',
                      thumbnailUrl: 'https://i.ytimg.com/vi/Etkd-07gnxM/hqdefault.jpg',
                      browseId: 'VLPL4fGSI46T250j298PrMtcms0bhcpTrU0S',
                    },
                    {
                      title: 'Viral 50: Global',
                      subtitle: 'Songs trending right now',
                      thumbnailUrl: 'https://i.ytimg.com/vi/VAdGW7QDJiU/hqdefault.jpg',
                      browseId: 'VLPL4fGSI46T251uWl8B_Wf3g7f0o4V4jH1T',
                    },
                    {
                      title: 'Top 100: Music Videos',
                      subtitle: 'Most viewed music videos',
                      thumbnailUrl: 'https://i.ytimg.com/vi/0pWsCiBvLOk/hqdefault.jpg',
                      browseId: 'VLPL4fGSI46T252jA06tkyvPj94Kk3m33u4e',
                    },
                    {
                      title: 'Top 100: United States',
                      subtitle: 'The biggest hits in the US',
                      thumbnailUrl: 'https://i.ytimg.com/vi/BtQp2U6hJII/hqdefault.jpg',
                      browseId: 'VLPL4fGSI46T251j4R_qV7jWv8K_8t_aHlY_',
                    },
                  ],
                },
              ],
            });
          }
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [browseId, params, initialTitle, initialSubtitle, initialThumbnailUrl, initialType]);

  const handlePlayAll = (shuffle: boolean = false) => {
    if (!detail || detail.songs.length === 0) return;
    const preparedSongs = detail.songs.map((s) => ({
      ...s,
      thumbnailUrl: s.thumbnailUrl || artworkUrl || (s.videoId ? `https://i.ytimg.com/vi/${s.videoId}/mqdefault.jpg` : null),
      albumName: s.albumName || detail.title,
    }));
    const songsToPlay = shuffle
      ? [...preparedSongs].sort(() => Math.random() - 0.5)
      : preparedSongs;
    playSong(songsToPlay[0], songsToPlay, true);
  };

  const totalDurationText = useMemo(() => {
    if (!detail?.songs?.length) return '';
    let totalSeconds = 0;
    for (const song of detail.songs) {
      if (song.durationText) {
        const parts = song.durationText.split(':').map((p) => parseInt(p, 10));
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          totalSeconds += parts[0] * 60 + parts[1];
        } else if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
          totalSeconds += parts[0] * 3600 + parts[1] * 60 + parts[2];
        }
      }
    }
    if (totalSeconds > 0) {
      const mins = Math.floor(totalSeconds / 60);
      const hrs = Math.floor(mins / 60);
      const remMins = mins % 60;
      if (hrs > 0) {
        return `${hrs} hr ${remMins} min`;
      }
      return `${mins} min`;
    }
    return '';
  }, [detail?.songs]);

  const handleItemClick = (item: ShelfItem, shelfSongs?: Song[]) => {
    if (item.videoId) {
      const queue = shelfSongs && shelfSongs.length > 0 ? shelfSongs : undefined;
      playSong(
        {
          videoId: item.videoId,
          title: item.title,
          artist: item.subtitle || detail?.title || 'YZ Music',
          thumbnailUrl: item.thumbnailUrl || artworkUrl || `https://i.ytimg.com/vi/${item.videoId}/mqdefault.jpg`,
          isVideo: item.isVideo,
        },
        queue
      );
    } else if (item.browseId) {
      if (onOpenDetail) {
        onOpenDetail(
          item.browseId,
          item.params || undefined,
          item.title,
          item.subtitle,
          item.thumbnailUrl,
          item.badge || undefined
        );
      }
    }
  };

  const getStripeColor = (num?: number | null, index?: number): string => {
    if (num != null) {
      const hex = (num & 0x00ffffff).toString(16).padStart(6, '0');
      return `#${hex}`;
    }
    const colors = ['#6C5CE7', '#E17055', '#00B894', '#0984E3', '#FD79A8'];
    return colors[(index || 0) % colors.length];
  };

  if (loading) {
    return (
      <div className="pb-28 md:pb-8 flex flex-col gap-6 animate-pulse max-w-5xl mx-auto w-full">
        <div className="w-full -mx-4 sm:-mx-6 -mt-14 sm:-mt-16 h-[340px] sm:h-[400px] bg-white/5 relative flex items-end p-6 sm:p-10 gap-6">
          <div className="w-48 h-48 sm:w-56 sm:h-56 rounded-3xl bg-white/10 shrink-0" />
          <div className="flex flex-col gap-3 flex-1 w-full pb-2">
            <div className="h-4 bg-white/10 rounded w-20" />
            <div className="h-8 bg-white/10 rounded w-3/4" />
            <div className="h-4 bg-white/5 rounded w-1/2" />
            <div className="h-10 bg-white/10 rounded-full w-36 mt-2" />
          </div>
        </div>
        <div className="px-4 sm:px-6 flex flex-col gap-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-14 rounded-2xl bg-white/[0.04] w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="p-6 text-center py-20 text-white/50 flex flex-col items-center gap-3 animate-fade-in">
        <h3 className="text-xl font-bold text-white">{initialTitle || 'Collection'}</h3>
        <p className="text-sm text-white/40 max-w-sm">
          Unable to retrieve items for this section. Please check your connection or connect your YouTube Music account.
        </p>
        <div className="flex items-center gap-3 mt-2">
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-full text-xs font-semibold transition-colors cursor-pointer"
          >
            Retry
          </button>
          <button
            onClick={onBack}
            className="px-5 py-2.5 bg-accent-red hover:bg-accent-red/90 text-white rounded-full text-xs font-semibold transition-colors cursor-pointer"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const isCategoryPage =
    detail.type === 'CATEGORY' ||
    detail.type === 'CHARTS' ||
    detail.type === 'NEW_RELEASES_GRID' ||
    browseId.startsWith('FEmusic_') ||
    (!artworkUrl && !detail.thumbnailUrl && (detail.shelves?.length || 0) > 0);

  return (
    <div className="pb-28 md:pb-8 flex flex-col gap-8 max-w-5xl mx-auto w-full">
      {/* Immersive Full-Bleed Cover Image Hero (For Albums, Playlists, Replay) */}
      {!isCategoryPage && (
        <div className="relative w-full -mx-4 sm:-mx-6 -mt-14 sm:-mt-16 overflow-hidden">
          {/* 1. Ambient Backdrop - only blend with currently playing song icon theme */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
            {currentPalette && (
              <div
                className="absolute inset-0 transition-all duration-1000"
                style={{
                  background: `
                    radial-gradient(ellipse 110% 80% at 50% 15%, ${currentPalette.dominant}30 0%, ${currentPalette.bottomColor}18 50%, transparent 80%),
                    linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(9,8,14,0.6) 45%, transparent 100%)
                  `,
                }}
              />
            )}
          </div>

          {/* Hero Content: Large Cover Artwork + Meta + Action Buttons */}
          <div className="relative z-10 px-6 sm:px-10 pt-16 sm:pt-20 pb-10 flex flex-col items-center text-center sm:text-left sm:flex-row sm:items-end gap-6 sm:gap-8">
            {/* Floating High-Res Cover Artwork with Subtle Depth Glow */}
            <div
              className="relative w-52 h-52 sm:w-60 sm:h-60 md:w-68 md:h-68 rounded-3xl overflow-hidden shrink-0 border border-white/20 group transition-transform duration-500 hover:scale-[1.02]"
              style={{
                boxShadow: currentPalette
                  ? `0 25px 60px -10px rgba(0,0,0,0.9), 0 0 35px ${currentPalette.dominant}22`
                  : '0 25px 60px -10px rgba(0,0,0,0.9)',
              }}
            >
              {artworkUrl && !imageError ? (
                <img
                  src={artworkUrl}
                  alt={detail.title}
                  referrerPolicy="no-referrer"
                  onError={handleArtworkError}
                  className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-white/15 to-white/5 text-white/30">
                  <Music className="w-16 h-16" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>

            {/* Album Metadata & Transport Controls */}
            <div className="flex flex-col gap-2.5 flex-1 min-w-0">
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <span
                  className="text-[10px] sm:text-xs font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full border border-white/20"
                  style={{
                    backgroundColor: currentPalette ? `${currentPalette.dominant}33` : 'rgba(255,255,255,0.1)',
                    color: '#ffffff',
                  }}
                >
                  {detail.type || 'ALBUM'}
                </span>
                {detail.year && (
                  <span className="text-xs text-white/50 font-medium">{detail.year}</span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight leading-tight drop-shadow-md">
                {detail.title}
              </h1>

              {detail.subtitle && (
                <p className="text-sm sm:text-base text-white/80 font-medium">
                  {detail.subtitle}
                </p>
              )}

              {/* Meta Chips: Track Count & Total Duration */}
              <div className="flex items-center justify-center sm:justify-start gap-2 text-xs text-white/50 font-medium">
                <span>{detail.songs.length} Tracks</span>
                {totalDurationText && (
                  <>
                    <span>•</span>
                    <span>{totalDurationText}</span>
                  </>
                )}
              </div>

              {/* Action Transport Buttons (Play All & Shuffle) */}
              {detail.songs.length > 0 && (
                <div className="flex items-center justify-center sm:justify-start gap-3 mt-4">
                  <button
                    onClick={() => handlePlayAll(false)}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-full text-white font-bold text-xs shadow-xl active:scale-95 hover:scale-105 transition-all cursor-pointer border border-white/25"
                    style={{
                      background: currentPalette
                        ? `linear-gradient(135deg, ${currentPalette.dominant}, #FF4B63)`
                        : 'linear-gradient(135deg, #FA2D48, #FF4B63)',
                      boxShadow: currentPalette
                        ? `0 0 25px ${currentPalette.dominant}55`
                        : '0 0 25px rgba(250,45,72,0.45)',
                    }}
                  >
                    <Play className="w-4 h-4 fill-white text-white" />
                    <span>Play All</span>
                  </button>

                  <button
                    onClick={() => handlePlayAll(true)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-full liquid-glass-pill text-white font-semibold text-xs active:scale-95 hover:scale-105 transition-all cursor-pointer hover:bg-white/15"
                  >
                    <Shuffle className="w-4 h-4" />
                    <span>Shuffle</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Category Header (for Charts, Moods & Genres, New Releases) */}
      {isCategoryPage && (
        <div className="px-4 sm:px-6 pt-6 flex flex-col gap-1 pb-4 border-b border-white/[0.08]">
          <span className="text-[10px] font-bold uppercase tracking-widest text-accent-red">
            {detail.type.replace(/_/g, ' ')}
          </span>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
            {detail.title}
          </h1>
          {detail.subtitle && (
            <p className="text-sm text-white/60 font-medium mt-1">{detail.subtitle}</p>
          )}
        </div>
      )}

      {/* 2. Tracklist Section - Seamless Full Section matching other lists */}
      {detail.songs.length > 0 && (
        <div className="px-4 sm:px-6 relative z-10 w-full flex flex-col gap-2">
          <div className="flex items-center justify-between px-1 pt-1 pb-2 border-b border-white/[0.06]">
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">Tracks</h3>
            <span className="text-xs text-white/40 font-mono">
              {detail.songs.length} songs {totalDurationText ? `• ${totalDurationText}` : ''}
            </span>
          </div>

          <div className="flex flex-col divide-y divide-white/[0.04]">
            {detail.songs.map((song: Song, idx: number) => {
              const isCurrent = currentSong?.videoId === song.videoId;
              const isLiked = likeStatuses[song.videoId] === 'LIKE';

              return (
                <div
                  key={`${song.videoId}-${idx}`}
                  onClick={() => {
                    const songToPlay: Song = {
                      ...song,
                      thumbnailUrl: song.thumbnailUrl || artworkUrl || (song.videoId ? `https://i.ytimg.com/vi/${song.videoId}/mqdefault.jpg` : null),
                      albumName: song.albumName || detail.title,
                    };
                    playSong(songToPlay, detail.songs);
                  }}
                  className={`flex items-center justify-between py-2.5 px-2.5 sm:px-3 rounded-xl cursor-pointer group transition-all duration-150 ${
                    isCurrent
                      ? 'bg-white/[0.12] text-white font-semibold'
                      : 'hover:bg-white/[0.06] text-white/85 hover:text-white'
                  }`}
                >
                  {/* Left: Index / Live Equalizer + Thumbnail + Title + Artist */}
                  <div className="flex items-center gap-3.5 overflow-hidden flex-1 min-w-0 pr-3">
                    {/* Index or Live Animated Equalizer */}
                    <div className="w-6 shrink-0 flex items-center justify-center">
                      {isCurrent && isPlaying ? (
                        <div className="flex items-end justify-center gap-0.5 h-4">
                          <div className="w-1 bg-accent-red rounded-full playing-eq-bar-1" />
                          <div className="w-1 bg-accent-red rounded-full playing-eq-bar-2" />
                          <div className="w-1 bg-accent-red rounded-full playing-eq-bar-3" />
                        </div>
                      ) : (
                        <>
                          <span
                            className={`text-xs font-mono group-hover:hidden ${
                              isCurrent ? 'text-accent-red font-bold' : 'text-white/40'
                            }`}
                          >
                            {idx + 1}
                          </span>
                          <Play className="w-3.5 h-3.5 fill-white text-white hidden group-hover:block" />
                        </>
                      )}
                    </div>

                    {/* Thumbnail */}
                    <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0 bg-white/5 relative border border-white/10 shadow-md">
                      <img
                        src={song.thumbnailUrl || artworkUrl || (song.videoId ? `https://i.ytimg.com/vi/${song.videoId}/mqdefault.jpg` : '/logo.svg')}
                        alt={song.title}
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          const el = e.currentTarget;
                          if (song.videoId && !el.src.includes(`vi/${song.videoId}/mqdefault.jpg`)) {
                            el.src = `https://i.ytimg.com/vi/${song.videoId}/mqdefault.jpg`;
                          } else if (artworkUrl && el.src !== artworkUrl) {
                            el.src = artworkUrl;
                          } else {
                            el.src = '/logo.svg';
                          }
                        }}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    </div>

                    {/* Title & Artist */}
                    <div className="overflow-hidden flex-1 min-w-0">
                      <h4
                        className={`text-sm sm:text-[14.5px] truncate transition-colors leading-tight ${
                          isCurrent ? 'text-accent-red font-bold' : 'font-medium text-white group-hover:text-accent-red'
                        }`}
                      >
                        {song.title}
                      </h4>
                      <p className="text-xs text-white/50 truncate mt-0.5">{song.artist}</p>
                    </div>
                  </div>

                  {/* Right Actions: Heart / Like, Add to Queue, Duration */}
                  <div
                    className="flex items-center gap-2 sm:gap-3 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => toggleLike(song.videoId)}
                      className={`p-1.5 rounded-full transition-all cursor-pointer opacity-0 group-hover:opacity-100 ${
                        isLiked ? '!opacity-100 text-accent-red' : 'text-white/40 hover:text-white'
                      }`}
                      title={isLiked ? 'Liked' : 'Like'}
                    >
                      <Heart className={`w-4 h-4 ${isLiked ? 'fill-accent-red text-accent-red' : ''}`} />
                    </button>

                    <button
                      onClick={() => addToQueue(song)}
                      className="p-1.5 rounded-full text-white/40 hover:text-white transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                      title="Add to Queue"
                    >
                      <Plus className="w-4 h-4" />
                    </button>

                    <span className="text-xs font-mono text-white/40 w-12 text-right">
                      {song.durationText || ''}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. Shelves Presentation (Albums, Singles, Playlists, Mood Grids, Charts) */}
      {detail.shelves && detail.shelves.length > 0 && (
        <div className="flex flex-col gap-8 mt-2">
          {detail.shelves.map((shelf: HomeShelf, sIdx: number) => {
            const isMoodGenre =
              shelf.type === 'MOOD_GENRE' ||
              shelf.items.some((it) => it.stripeColor != null || it.browseId?.includes('moods_and_genres'));
            const isVideo = shelf.type === 'VIDEO' || shelf.type === 'CHART_VIDEOS';
            const isArtists = shelf.type === 'CHART_ARTISTS';

            const shelfSongs: Song[] = shelf.items
              .filter((it) => it.videoId != null)
              .map((it) => ({
                videoId: it.videoId!,
                title: it.title,
                artist: it.subtitle || detail.title,
                thumbnailUrl: it.thumbnailUrl || null,
                isVideo: it.isVideo,
              }));

            return (
              <section key={`${shelf.title}-${sIdx}`} className="flex flex-col gap-3">
                <div className="flex items-center justify-between px-1">
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                      {shelf.title}
                    </h3>
                    {shelf.subtitle && (
                      <p className="text-xs text-white/50 truncate mt-0.5">{shelf.subtitle}</p>
                    )}
                  </div>
                  {shelf.moreBrowseId && onOpenDetail && (
                    <button
                      onClick={() => onOpenDetail(shelf.moreBrowseId!, shelf.moreParams || undefined)}
                      className="text-xs font-semibold text-accent-red hover:underline flex items-center gap-1"
                    >
                      <span>Show all</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* A. Mood & Genre Tiles (2 rows per column) */}
                {isMoodGenre && (
                  <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-none snap-x">
                    {Array.from({ length: Math.ceil(shelf.items.length / 2) }).map((_, cIdx) => {
                      const pair = shelf.items.slice(cIdx * 2, cIdx * 2 + 2);
                      return (
                        <div key={cIdx} className="flex flex-col gap-2.5 shrink-0 snap-start">
                          {pair.map((item, pIdx) => {
                            const stripe = getStripeColor(item.stripeColor, cIdx * 2 + pIdx);
                            return (
                              <div
                                key={pIdx}
                                onClick={() => handleItemClick(item)}
                                className="w-[170px] h-[52px] rounded-xl liquid-glass-card border border-white/10 hover:border-white/25 px-3.5 flex items-center gap-2.5 cursor-pointer group transition-all relative overflow-hidden select-none"
                                style={{
                                  background: `linear-gradient(90deg, ${stripe}40 0%, rgba(255,255,255,0.04) 100%)`,
                                }}
                              >
                                <div
                                  className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
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

                {/* B. Artist Circular Avatars */}
                {isArtists && !isMoodGenre && (
                  <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none snap-x">
                    {shelf.items.map((item, itIdx) => (
                      <div
                        key={itIdx}
                        onClick={() => handleItemClick(item)}
                        className="w-28 shrink-0 flex flex-col items-center text-center gap-2 cursor-pointer group snap-start select-none"
                      >
                        <div className="w-24 h-24 rounded-full overflow-hidden bg-white/5 border border-white/15 relative">
                          <img
                            src={item.thumbnailUrl || '/logo.svg'}
                            alt={item.title}
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              e.currentTarget.src = '/logo.svg';
                            }}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        </div>
                        <span className="text-xs font-semibold text-white truncate w-full group-hover:text-accent-red">
                          {item.title}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* C. Video Cards (16:9) */}
                {isVideo && !isMoodGenre && !isArtists && (
                  <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none snap-x">
                    {shelf.items.map((item, itIdx) => (
                      <div
                        key={itIdx}
                        onClick={() => handleItemClick(item, shelfSongs)}
                        className="w-[220px] shrink-0 flex flex-col cursor-pointer group snap-start select-none"
                      >
                        <div className="w-full aspect-[16/9] rounded-xl overflow-hidden bg-white/5 border border-white/15 relative">
                          <img
                            src={item.thumbnailUrl || '/logo.svg'}
                            alt={item.title}
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              e.currentTarget.src = '/logo.svg';
                            }}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                          <div className="absolute bottom-2 right-2 w-6 h-6 rounded-full bg-black/70 flex items-center justify-center text-white">
                            <Play className="w-3 h-3 fill-white ml-0.5" />
                          </div>
                        </div>
                        <span className="text-sm font-semibold text-white truncate mt-2 group-hover:text-accent-red">
                          {item.title}
                        </span>
                        {item.subtitle && (
                          <span className="text-xs text-white/50 truncate">{item.subtitle}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* D. Standard Releases & Ranked Cards (1:1 Square) */}
                {!isMoodGenre && !isArtists && !isVideo && (
                  <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none snap-x">
                    {shelf.items.filter((it) => it.thumbnailUrl != null).map((item, itIdx) => (
                      <div
                        key={itIdx}
                        onClick={() => handleItemClick(item, shelfSongs)}
                        className="w-36 sm:w-40 shrink-0 flex flex-col cursor-pointer group snap-start select-none"
                      >
                        <div className="w-full aspect-square rounded-xl overflow-hidden bg-white/5 border border-white/15 relative shadow-md">
                          <img
                            src={item.thumbnailUrl || '/logo.svg'}
                            alt={item.title}
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              e.currentTarget.src = '/logo.svg';
                            }}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          {item.customIndex && (
                            <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/75 text-[11px] font-bold text-white border border-white/10">
                              #{item.customIndex}
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <div className="w-10 h-10 rounded-full bg-accent-red text-white flex items-center justify-center shadow-lg">
                              <Play className="w-4 h-4 fill-white ml-0.5" />
                            </div>
                          </div>
                        </div>
                        <span className="text-sm font-semibold text-white truncate mt-2 group-hover:text-accent-red">
                          {item.title}
                        </span>
                        {item.subtitle && (
                          <span className="text-xs text-white/50 truncate mt-0.5">
                            {item.subtitle}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* Empty fallback only when neither songs nor shelves exist */}
      {detail.songs.length === 0 && (!detail.shelves || detail.shelves.length === 0) && (
        <div className="text-center py-16 text-white/40 text-sm flex flex-col items-center gap-2">
          <Music className="w-8 h-8 opacity-40" />
          <span>No items found in this section.</span>
        </div>
      )}
    </div>
  );
};
