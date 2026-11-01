import React, { useState, useEffect, useRef } from 'react';
import {
  Heart,
  ListMusic,
  Volume1,
  Volume2,
  VolumeX,
  MessageSquareText,
  Infinity,
  Download,
  Check,
  Music2,
  ChevronRight,
  MoreHorizontal,
  Sliders,
  Disc3,
  X,
  Share2,
  Users,
  Settings,
  Sparkles,
  Repeat,
  Repeat1,
  Loader2,
  Shuffle,
  Trash2,
  ChevronUp,
  ChevronDown,
  Play,
  Plus,
  Radio,
  RotateCw,
} from 'lucide-react';
import { usePlayerStore } from '../../stores/playerStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { MeshGradient } from './MeshGradient';
import { lyricsService } from '../../services/lyricsService';
import { jioSaavnService } from '../../services/jiosaavn';
import { innertubeService } from '../../services/innertube';
import { LyricLine, Song } from '../../types';
import { extractPalette, PaletteColors } from '../../utils/paletteExtractor';

interface NowPlayingScreenProps {
  isDocked?: boolean;
  onOpenDetail?: (
    browseId: string,
    params?: string,
    title?: string,
    subtitle?: string,
    thumbnailUrl?: string | null,
    type?: string
  ) => void;
  onOpenListenTogether?: () => void;
  onOpenEqualizer?: () => void;
  onOpenSettings?: () => void;
}

const DOWNLOADS_KEY = 'yz_music_downloads';

function getHighResArtwork(url?: string | null, videoId?: string | null): string {
  if (url && (url.includes('saavncdn.com') || url.includes('jiosaavn'))) {
    return url.replace('150x150', '500x500').replace(/^http:\/\//i, 'https://');
  }
  if (!url && videoId) {
    return `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
  }
  if (!url) return '/logo.svg';

  // Google User Content (YouTube Music album art upgrade to 800x800)
  if (url.includes('googleusercontent.com') || url.includes('ggpht.com')) {
    const cleanUrl = url.split('?')[0];
    if (/=w\d+-h\d+/.test(cleanUrl)) {
      return cleanUrl.replace(/=w\d+-h\d+[^&]*/, '=w800-h800-l90-rj');
    }
    if (/=s\d+/.test(cleanUrl)) {
      return cleanUrl.replace(/=s\d+[^&]*/, '=s800-l90-rj');
    }
    return `${cleanUrl}=w800-h800-l90-rj`;
  }

  // YouTube video CDN: prefer maxresdefault for 720p HD with zero black bars
  if (url.includes('ytimg.com')) {
    const fixed = url
      .replace('VAdGW7QDJUI', 'VAdGW7QDJiU')
      .replace('V9PVRfjEBTI', 'LK7-_dgAVQE');

    if (fixed.includes('hqdefault.jpg')) {
      return fixed.replace('hqdefault.jpg', 'maxresdefault.jpg');
    }
    return fixed;
  }

  return url;
}

export const NowPlayingScreen: React.FC<NowPlayingScreenProps> = ({
  isDocked = false,
  onOpenDetail,
  onOpenListenTogether,
  onOpenEqualizer,
  onOpenSettings,
}) => {
  const {
    currentSong,
    isPlaying,
    currentTime,
    duration,
    togglePlay,
    next,
    prev,
    seek,
    volume,
    setVolume,
    autoplay,
    repeatMode,
    cyclePlaybackMode,
    setPlaybackMode,
    moveQueueItem,
    removeFromQueue,
    clearQueue,
    shuffleQueue,
    addToQueue,
    addMultipleToQueue,
    likeStatuses,
    toggleLike,
    isNowPlayingOpen,
    setNowPlayingOpen,
    nowPlayingTab,
    setNowPlayingTab,
    queue,
    queueIndex,
    playSong,
    refreshRelatedQueue,
    setCurrentPalette,
  } = usePlayerStore();

  const { audioQuality, setAudioQuality } = useSettingsStore();

  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [isLyricsLoading, setIsLyricsLoading] = useState<boolean>(false);
  const [isSynced, setIsSynced] = useState<boolean>(true);
  const [lyricsSource, setLyricsSource] = useState<string>('LRCLIB');
  const [activeLyricIndex, setActiveLyricIndex] = useState<number>(-1);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [downloadedSongs, setDownloadedSongs] = useState<Set<string>>(new Set());
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<'IDLE' | 'DOWNLOADING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [playbackModeFeedback, setPlaybackModeFeedback] = useState<string | null>(null);
  const [queueSubTab, setQueueSubTab] = useState<'QUEUE' | 'RELATED'>('QUEUE');
  const [relatedSongs, setRelatedSongs] = useState<Song[]>([]);
  const [isLoadingRelated, setIsLoadingRelated] = useState(false);
  const [addedFeedback, setAddedFeedback] = useState<Record<string, boolean>>({});
  const [addedAllFeedback, setAddedAllFeedback] = useState(false);
  const [artworkUrl, setArtworkUrl] = useState<string>(() =>
    getHighResArtwork(currentSong?.thumbnailUrl, currentSong?.videoId)
  );
  const [palette, setPalette] = useState<PaletteColors>({
    dominant: '#FA2D48',
    secondary: '#8B5CF6',
    topColor: '#301828',
    bottomColor: '#4A1D34',
    darkBase: '#08070d',
  });
  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const [isUserScrolling, setIsUserScrolling] = useState<boolean>(false);
  const userScrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Synchronize high-res artwork URL
  useEffect(() => {
    setArtworkUrl(getHighResArtwork(currentSong?.thumbnailUrl, currentSong?.videoId));
  }, [currentSong?.thumbnailUrl, currentSong?.videoId]);

  // Clean up user scroll timeout
  useEffect(() => {
    return () => {
      if (userScrollTimeoutRef.current) {
        clearTimeout(userScrollTimeoutRef.current);
      }
    };
  }, []);

  // Center active lyric line in container viewport smoothly
  const scrollToLyricIndex = (index: number, behavior: ScrollBehavior = 'smooth') => {
    if (index < 0 || !lyricsContainerRef.current) return;
    const lineEl = document.getElementById(`lyric-line-${index}`);
    const container = lyricsContainerRef.current;
    if (lineEl && container) {
      const lineRect = lineEl.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const currentScrollTop = container.scrollTop;
      const lineRelativeTop = lineRect.top - containerRect.top;
      const targetScrollTop =
        currentScrollTop + lineRelativeTop - container.clientHeight / 2 + lineRect.height / 2;
      container.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior,
      });
    }
  };

  // Flag manual user scrolling and auto-resume synchronization after inactivity
  const handleUserLyricsInteraction = () => {
    setIsUserScrolling(true);
    if (userScrollTimeoutRef.current) {
      clearTimeout(userScrollTimeoutRef.current);
    }
    userScrollTimeoutRef.current = setTimeout(() => {
      setIsUserScrolling(false);
    }, 4000);
  };

  // Interactive tap-to-seek directly from lyric lines
  const handleLyricClick = (line: LyricLine, idx: number) => {
    if (line.startTimeMs >= 0) {
      seek(line.startTimeMs / 1000);
      setActiveLyricIndex(idx);
      setIsUserScrolling(false);
      scrollToLyricIndex(idx, 'smooth');
    }
  };

  // Extract dynamic colors whenever artworkUrl updates & propagate globally
  useEffect(() => {
    if (!artworkUrl) return;
    let isMounted = true;
    extractPalette(artworkUrl).then((p) => {
      if (isMounted) {
        setPalette(p);
        setCurrentPalette(p);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [artworkUrl, setCurrentPalette]);

  // Load downloaded songs list
  useEffect(() => {
    try {
      const stored = localStorage.getItem(DOWNLOADS_KEY);
      if (stored) {
        setDownloadedSongs(new Set(JSON.parse(stored)));
      }
    } catch { }
  }, []);

  const handleArtworkError = () => {
    if (artworkUrl.includes('maxresdefault.jpg')) {
      // Fallback to mqdefault (which has 0 black bars!)
      setArtworkUrl(artworkUrl.replace('maxresdefault.jpg', 'mqdefault.jpg'));
    } else if (artworkUrl.includes('mqdefault.jpg')) {
      setArtworkUrl(artworkUrl.replace('mqdefault.jpg', 'hqdefault.jpg'));
    } else if (currentSong?.videoId && !artworkUrl.includes(currentSong.videoId)) {
      setArtworkUrl(`https://i.ytimg.com/vi/${currentSong.videoId}/mqdefault.jpg`);
    } else if (currentSong?.thumbnailUrl && !artworkUrl.startsWith('/api/avatar')) {
      setArtworkUrl(`/api/avatar?url=${encodeURIComponent(currentSong.thumbnailUrl)}`);
    } else if (currentSong?.thumbnailUrl && artworkUrl !== currentSong.thumbnailUrl) {
      setArtworkUrl(currentSong.thumbnailUrl);
    }
  };

  // Load lyrics when currentSong changes
  useEffect(() => {
    if (!currentSong) {
      setLyrics([]);
      return;
    }
    setIsLyricsLoading(true);
    let isMounted = true;

    lyricsService
      .getLyrics(currentSong.title, currentSong.artist, duration, currentSong.videoId)
      .then((data) => {
        if (!isMounted) return;
        const lines = data.lines || [];
        setLyrics(lines);
        const hasTimestamps = lines.some((l, idx) => idx > 0 && l.startTimeMs > 0);
        setIsSynced(!!data.synced && hasTimestamps);
        setLyricsSource(data.source || 'LRCLIB');
        setIsLyricsLoading(false);
      })
      .catch((e) => {
        console.warn('Lyrics load failed', e);
        if (isMounted) {
          setLyrics([]);
          setIsLyricsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [currentSong?.videoId, currentSong?.title, currentSong?.artist, duration]);

  // Whenever user switches to lyrics tab, center the active lyric
  useEffect(() => {
    if (nowPlayingTab === 'LYRICS') {
      setIsUserScrolling(false);
      const timer = setTimeout(() => {
        if (activeLyricIndex >= 0) {
          scrollToLyricIndex(activeLyricIndex, 'auto');
        }
      }, 70);
      return () => clearTimeout(timer);
    }
  }, [nowPlayingTab]);

  // Synchronize lyric highlight with currentTime
  useEffect(() => {
    if (!lyrics.length || !isSynced) return;
    const currentMs = currentTime * 1000;
    const idx = lyrics.findIndex(
      (line, i) =>
        currentMs >= line.startTimeMs &&
        (i === lyrics.length - 1 || currentMs < lyrics[i + 1].startTimeMs)
    );

    if (idx !== activeLyricIndex) {
      setActiveLyricIndex(idx);
      if (idx !== -1 && !isUserScrolling && nowPlayingTab === 'LYRICS') {
        scrollToLyricIndex(idx, 'smooth');
      }
    }
  }, [currentTime, lyrics, activeLyricIndex, isSynced, isUserScrolling, nowPlayingTab]);

  // Prefetch & maintain rich related tracks for currentSong / active station.
  // Once a related queue is formed, do NOT refresh until reaching end of queue or user refresh!
  useEffect(() => {
    if (!currentSong?.videoId) {
      setRelatedSongs([]);
      return;
    }

    // If a related queue is already formed and currentSong is advancing inside the queue,
    // keep the formed related queue without clearing or refetching!
    if (relatedSongs.length > 0 && queue.some((s) => s.videoId === currentSong.videoId)) {
      return;
    }

    let isMounted = true;
    setIsLoadingRelated(true);

    const loadRelated = async () => {
      try {
        // 1. Primary: YouTube Music RDAMVM radio mix
        const songs = await innertubeService.getNext(currentSong.videoId);
        let list = (songs || []).filter((s) => s.videoId !== currentSong.videoId);

        // 2. Fallback: If RDAMVM gave fewer than 6 songs, query search for related songs
        if (list.length < 6) {
          try {
            const query = currentSong.artist ? `${currentSong.artist} mix` : currentSong.title;
            const searchResults = await innertubeService.search(query, 'SONGS');
            const searchSongs = searchResults
              .filter((r) => (r.type === 'Track' || r.type === 'TopTrack') && r.song.videoId !== currentSong.videoId)
              .map((r: any) => r.song);

            const seen = new Set(list.map((s) => s.videoId));
            for (const s of searchSongs) {
              if (!seen.has(s.videoId)) {
                seen.add(s.videoId);
                list.push(s);
              }
            }
          } catch (err) {
            console.warn('Fallback related search failed', err);
          }
        }

        // 3. Fallback: If still fewer than 5 songs, query JioSaavn
        if (list.length < 5) {
          try {
            const saavnResults = await jioSaavnService.search(currentSong.artist || currentSong.title);
            const seen = new Set(list.map((s) => s.videoId));
            for (const s of saavnResults) {
              const vId = s.id || `saavn_${s.id}`;
              if (!seen.has(vId)) {
                seen.add(vId);
                list.push({
                  videoId: vId,
                  title: s.title,
                  artist: s.artist,
                  thumbnailUrl: s.image,
                  fromAutoplay: true,
                });
              }
            }
          } catch (err) {
            console.warn('Saavn related fallback failed', err);
          }
        }

        if (isMounted) {
          setRelatedSongs(list);
          setIsLoadingRelated(false);
        }
      } catch (e) {
        console.warn('Failed to load related songs', e);
        if (isMounted) {
          setIsLoadingRelated(false);
        }
      }
    };

    loadRelated();

    return () => {
      isMounted = false;
    };
  }, [currentSong?.videoId, currentSong?.title, currentSong?.artist]);

  const handleCyclePlaybackMode = () => {
    const nextMode = cyclePlaybackMode();
    let text = 'Playback: Normal';
    if (nextMode === 'CONTINUE') text = 'Autoplay: Related Music (Default)';
    else if (nextMode === 'REPEAT_ALL') text = 'Queue Mode: Play Queue';
    else if (nextMode === 'REPEAT_ONE') text = 'Loop: Repeat Song';
    else if (nextMode === 'OFF') text = 'Loop: Off';

    setPlaybackModeFeedback(text);
    setTimeout(() => {
      setPlaybackModeFeedback(null);
    }, 1800);
  };

  const handleDirectDownload = async () => {
    if (!currentSong || isDownloading) return;
    setIsDownloading(true);
    setDownloadStatus('DOWNLOADING');

    try {
      let streamUrl: string | null = null;
      try {
        streamUrl = await jioSaavnService.findMatch(currentSong.title, currentSong.artist);
      } catch (e) {
        console.warn('Saavn resolve for download error', e);
      }

      const cleanTitle = currentSong.title.replace(/[/\\?%*:|"<>]/g, '');
      const cleanArtist = currentSong.artist.replace(/[/\\?%*:|"<>]/g, '');
      const filename = `${cleanArtist} - ${cleanTitle}.m4a`;

      if (streamUrl) {
        const link = document.createElement('a');
        link.href = `/api/download?url=${encodeURIComponent(streamUrl)}&filename=${encodeURIComponent(filename)}`;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        window.open(`https://www.youtube.com/watch?v=${currentSong.videoId}`, '_blank');
      }

      const nextSet = new Set(downloadedSongs);
      nextSet.add(currentSong.videoId);
      setDownloadedSongs(nextSet);
      localStorage.setItem(DOWNLOADS_KEY, JSON.stringify(Array.from(nextSet)));

      setDownloadStatus('SUCCESS');
      setTimeout(() => setDownloadStatus('IDLE'), 2500);
    } catch (err) {
      console.error('Download error', err);
      setDownloadStatus('ERROR');
      setTimeout(() => setDownloadStatus('IDLE'), 2500);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleAddRelatedToQueue = (song: Song) => {
    addToQueue(song);
    setAddedFeedback((prev) => ({ ...prev, [song.videoId]: true }));
    setTimeout(() => {
      setAddedFeedback((prev) => ({ ...prev, [song.videoId]: false }));
    }, 1500);
  };

  const handleAddAllRelated = () => {
    if (relatedSongs.length === 0) return;
    addMultipleToQueue(relatedSongs);
    setAddedAllFeedback(true);
    setTimeout(() => {
      setAddedAllFeedback(false);
    }, 2000);
  };

  const handleRefreshRelated = async () => {
    if (!currentSong || isLoadingRelated) return;
    setIsLoadingRelated(true);
    await refreshRelatedQueue();
    const fresh = usePlayerStore.getState().queue.filter((s) => s.videoId !== currentSong.videoId && s.fromAutoplay);
    if (fresh.length > 0) {
      setRelatedSongs(fresh);
    }
    setIsLoadingRelated(false);
  };

  if (!currentSong) {
    if (isDocked) {
      return (
        <aside className="hidden lg:flex flex-col w-[360px] xl:w-[410px] h-full liquid-glass-dock p-6 items-center justify-center text-white/40 text-center shrink-0 relative z-20 select-none">
          <div className="w-16 h-16 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center mb-4 shadow-xl">
            <ListMusic className="w-8 h-8 opacity-40 text-white" />
          </div>
          <p className="font-semibold text-sm text-white/80">No Track Playing</p>
          <p className="text-xs text-white/40 mt-1">Select a song from Listen Now or Search</p>
        </aside>
      );
    }
    return null;
  }

  const isLiked = likeStatuses[currentSong.videoId] === 'LIKE';
  const isDownloaded = downloadedSongs.has(currentSong.videoId);

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  const formatRemainingTime = (remainingSecs: number) => {
    const clamped = Math.max(0, remainingSecs);
    const mins = Math.floor(clamped / 60);
    const s = Math.floor(clamped % 60);
    return `-${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const containerClasses = isDocked
    ? 'hidden lg:flex flex-col w-[360px] xl:w-[410px] h-full liquid-glass-dock relative overflow-hidden shrink-0 z-20 select-none border-l border-white/10'
    : `fixed inset-0 z-50 flex flex-col text-white transition-all duration-300 select-none overflow-hidden ${isNowPlayingOpen ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'
    }`;

  return (
    <div
      className={containerClasses}
      style={{
        backgroundColor: isDocked ? 'transparent' : (palette.darkBase || '#08070d'),
      }}
    >
      {/* 1. Dynamic Mesh Gradient with Album Colors (Exact match of native MeshGradient.kt) */}
      <MeshGradient
        primaryColor={palette.dominant}
        secondaryColor={palette.secondary}
        bottomColor={palette.bottomColor}
        darkBase={palette.darkBase || '#08070d'}
      />

      {/* 2. Hero Full-Bleed Artwork: Edge-to-edge at top, dissolving smoothly into ambient backdrop (matching native NowPlayingScreen.kt HERO_FADE_FRACTION) */}
      {nowPlayingTab === 'PLAYER' && (
        <div className="absolute top-0 left-0 right-0 h-[62vh] sm:h-[64vh] overflow-hidden pointer-events-none z-0">
          <img
            src={artworkUrl}
            alt={currentSong.title}
            referrerPolicy="no-referrer"
            onError={handleArtworkError}
            className={`w-full h-full object-cover transition-transform duration-700 ease-out ${
              artworkUrl.includes('hqdefault.jpg')
                ? 'scale-[1.34] object-center'
                : 'scale-[1.04] sm:scale-100 object-center'
            }`}
            style={{
              maskImage:
                'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 48%, rgba(0,0,0,0.85) 62%, rgba(0,0,0,0.45) 78%, rgba(0,0,0,0.12) 90%, rgba(0,0,0,0) 100%)',
              WebkitMaskImage:
                'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 48%, rgba(0,0,0,0.85) 62%, rgba(0,0,0,0.45) 78%, rgba(0,0,0,0.12) 90%, rgba(0,0,0,0) 100%)',
            }}
          />
          {/* Subtle top scrim for close button legibility */}
          <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/40 via-black/15 to-transparent pointer-events-none" />
        </div>
      )}

      {/* 3. Smooth bottom blend scrim: Seamlessly blinds the screen down into darkBase (matching native Android player) */}
      <div
        className="absolute inset-0 pointer-events-none z-0 transition-colors duration-1000"
        style={{
          background: `linear-gradient(to bottom, transparent 25%, rgba(5,5,8,0.3) 55%, rgba(5,5,8,0.78) 80%, ${palette.darkBase || '#08070d'} 98%)`,
        }}
      />

      {/* 3. Foreground Content Container */}
      <div className="relative z-10 w-full max-w-md sm:max-w-lg mx-auto h-full flex flex-col justify-between px-6 sm:px-7 pt-2 pb-6">
        {/* Top Header Bar: Close Button (on Mobile) */}
        {!isDocked && (
          <div className="relative w-full flex items-center justify-between pt-1 pb-2 shrink-0">
            <button
              onClick={() => setNowPlayingOpen(false)}
              className="w-10 h-10 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white/80 hover:text-white cursor-pointer"
              title="Close player"
              aria-label="Close player"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
            <div className="w-10 h-10 shrink-0 pointer-events-none" />
          </div>
        )}

        {/* View Switcher: PLAYER vs LYRICS vs QUEUE */}
        {nowPlayingTab === 'PLAYER' && (
          <div className="flex-1 flex flex-col justify-end pb-3">
            {/* Track Info Row + Circular Action Buttons */}
            <div className="w-full flex items-center justify-between mb-2">
              <div className="overflow-hidden pr-3 flex-1 min-w-0">
                <h2 className="text-2xl sm:text-[28px] font-bold text-white truncate leading-tight tracking-tight drop-shadow-sm">
                  {currentSong.title}
                </h2>
                <p className="text-sm sm:text-base font-medium text-white/70 truncate mt-0.5">
                  {currentSong.artist}
                </p>
              </div>

              {/* Circular Action Pills: Like (♡) & More (•••) */}
              <div className="flex items-center gap-3 shrink-0">
                {/* Heart Button */}
                <button
                  onClick={() => toggleLike(currentSong.videoId)}
                  className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full backdrop-blur-xl border flex items-center justify-center transition-all duration-200 active:scale-90 shadow-lg cursor-pointer ${isLiked
                    ? 'bg-accent-red/25 border-accent-red/50 text-accent-red shadow-[0_0_20px_rgba(250,45,72,0.4)]'
                    : 'bg-white/10 hover:bg-white/20 border-white/15 text-white/90 hover:text-white'
                    }`}
                  title={isLiked ? 'Liked' : 'Like'}
                >
                  <Heart className={`w-6 h-6 ${isLiked ? 'fill-accent-red text-accent-red' : ''}`} />
                </button>

                {/* More Options (•••) Button */}
                <button
                  onClick={() => setShowOptionsMenu(!showOptionsMenu)}
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-xl border border-white/15 flex items-center justify-center text-white/90 hover:text-white transition-all duration-200 active:scale-90 shadow-lg cursor-pointer"
                  title="More Options"
                >
                  <MoreHorizontal className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Lyrics Link Chip */}
            <div className="w-full flex items-center justify-start mb-2">
              <button
                onClick={() => setNowPlayingTab('LYRICS')}
                className="inline-flex items-center gap-1.5 text-white/90 hover:text-white text-sm font-semibold transition-all active:scale-95 group cursor-pointer"
              >
                <Music2 className="w-4 h-4 text-white/80 group-hover:scale-110 transition-transform" />
                <span>Lyrics</span>
                <ChevronRight className="w-3.5 h-3.5 text-white/40 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>
        )}

        {/* VIEW B: Real-Time Synchronized Lyrics View */}
        {nowPlayingTab === 'LYRICS' && (
          <div className="flex-1 flex flex-col overflow-hidden my-auto py-2 relative">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-2 shrink-0">
              <div className="flex items-center gap-2">
                <Music2 className="w-4 h-4 text-accent-red" />
                <span className="text-xs font-bold uppercase tracking-wider text-white">Lyrics</span>
                {isSynced ? (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-accent-red/20 text-accent-red border border-accent-red/30 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent-red animate-pulse" />
                    Synchronized
                  </span>
                ) : lyrics.length > 0 ? (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/10 text-white/60 border border-white/10">
                    {lyricsSource === 'MUSIXMATCH' ? 'Official' : 'Plain'}
                  </span>
                ) : null}
              </div>
              <button
                onClick={() => setNowPlayingTab('PLAYER')}
                className="text-xs text-white/50 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
                title="Back to Artwork"
              >
                <span>Artwork</span>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {isLyricsLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center text-white/60 gap-3">
                <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-accent-red animate-spin" />
                <span className="text-xs font-semibold tracking-wider uppercase text-white/50">Fetching Lyrics...</span>
              </div>
            ) : lyrics.length > 0 ? (
              <div className="relative flex-1 min-h-0 flex flex-col overflow-hidden">
                <div
                  ref={lyricsContainerRef}
                  onScroll={handleUserLyricsInteraction}
                  onTouchStart={handleUserLyricsInteraction}
                  onWheel={handleUserLyricsInteraction}
                  style={{
                    maskImage:
                      'linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%)',
                    WebkitMaskImage:
                      'linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%)',
                  }}
                  className="flex-1 overflow-y-auto scrollbar-none flex flex-col gap-6 py-24 px-2 scroll-smooth"
                >
                  {/* Instrumental Intro indicator if song is before first lyric */}
                  {isSynced && lyrics[0]?.startTimeMs > 4000 && currentTime * 1000 < lyrics[0].startTimeMs && (
                    <div className="text-xs font-bold text-white/40 tracking-widest uppercase text-center py-6 animate-pulse flex items-center justify-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-accent-red animate-ping" />
                      ••• Instrumental Intro •••
                    </div>
                  )}

                  {lyrics.map((line, idx) => {
                    const isActive = isSynced && idx === activeLyricIndex;
                    const isPassed = isSynced && activeLyricIndex > -1 && idx < activeLyricIndex;

                    return (
                      <p
                        id={`lyric-line-${idx}`}
                        key={idx}
                        onClick={() => handleLyricClick(line, idx)}
                        className={`text-xl sm:text-2xl font-extrabold cursor-pointer transition-all duration-300 leading-snug tracking-tight select-none ${
                          isActive
                            ? 'text-white scale-[1.04] origin-left drop-shadow-[0_0_24px_rgba(255,255,255,0.7)] py-2'
                            : isPassed
                            ? 'text-white/35 hover:text-white/70 py-1'
                            : isSynced
                            ? 'text-white/20 hover:text-white/60 py-1'
                            : 'text-white/80 hover:text-white py-1'
                        }`}
                      >
                        {line.words}
                      </p>
                    );
                  })}
                </div>

                {/* Floating "Sync" pill when user has manually scrolled */}
                {isUserScrolling && activeLyricIndex >= 0 && (
                  <button
                    onClick={() => {
                      setIsUserScrolling(false);
                      scrollToLyricIndex(activeLyricIndex, 'smooth');
                    }}
                    className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 px-3.5 py-1.5 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-xl border border-white/25 text-white text-xs font-semibold shadow-2xl flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                    <span>Sync</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-white/40 text-sm gap-3">
                <Music2 className="w-10 h-10 opacity-30 text-white" />
                <span className="text-center font-medium max-w-xs">No lyrics found for this track.</span>
                <button
                  onClick={() => {
                    setIsLyricsLoading(true);
                    lyricsService
                      .getLyrics(currentSong.title, currentSong.artist, duration, currentSong.videoId)
                      .then((data) => {
                        setLyrics(data.lines || []);
                        const hasTimestamps = (data.lines || []).some((l, idx) => idx > 0 && l.startTimeMs > 0);
                        setIsSynced(!!data.synced && hasTimestamps);
                        setLyricsSource(data.source || 'LRCLIB');
                        setIsLyricsLoading(false);
                      });
                  }}
                  className="px-4 py-1.5 rounded-full bg-white/10 hover:bg-white/15 text-xs font-semibold text-white border border-white/15 active:scale-95 transition-all cursor-pointer"
                >
                  Retry Search
                </button>
              </div>
            )}
          </div>
        )}

        {/* VIEW C: Up Next Queue & Related Music Chart View */}
        {nowPlayingTab === 'QUEUE' && (
          <div className="flex-1 flex flex-col overflow-hidden my-auto py-2">
            {/* Header: Sub-tabs (Queue vs Related) + Return */}
            <div className="flex items-center justify-between pb-2 border-b border-white/10 mb-2">
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white/[0.07] border border-white/10">
                <button
                  onClick={() => setQueueSubTab('QUEUE')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    queueSubTab === 'QUEUE'
                      ? 'bg-accent-red text-white shadow-md'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  <ListMusic className="w-3.5 h-3.5" />
                  <span>Queue ({queue.length})</span>
                </button>

                <button
                  onClick={() => setQueueSubTab('RELATED')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    queueSubTab === 'RELATED'
                      ? 'bg-accent-red text-white shadow-md'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span>Related Music</span>
                </button>
              </div>

              <button
                onClick={() => setNowPlayingTab('PLAYER')}
                className="text-xs text-white/50 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
              >
                <span>Artwork</span>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* SUB-TAB 1: Queue with Arrange (Reorder, Remove, Shuffle, Clear) */}
            {queueSubTab === 'QUEUE' && (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Actions Bar */}
                <div className="flex items-center justify-between px-1 py-1.5 text-xs text-white/50">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium tracking-wide">
                      {queue.length > 1 ? `${queue.length} tracks` : '1 track'}
                    </span>
                    <button
                      onClick={() => {
                        if (repeatMode === 'ALL') {
                          setPlaybackMode('CONTINUE');
                          setPlaybackModeFeedback('Autoplay: Related Music (Default)');
                        } else {
                          setPlaybackMode('REPEAT_ALL');
                          setPlaybackModeFeedback('Queue Mode: Play Queue');
                        }
                        setTimeout(() => setPlaybackModeFeedback(null), 1800);
                      }}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all cursor-pointer active:scale-95 border ${
                        repeatMode === 'ALL'
                          ? 'bg-accent-red text-white border-accent-red shadow-sm'
                          : 'bg-white/10 hover:bg-white/15 text-white/70 hover:text-white border-white/10'
                      }`}
                      title={
                        repeatMode === 'ALL'
                          ? 'Queue Mode active: Playing queue tracks in order (Click for Autoplay)'
                          : 'Autoplay active: Playing related songs (Click to play queue in order)'
                      }
                    >
                      <Repeat className="w-2.5 h-2.5" />
                      <span>{repeatMode === 'ALL' ? 'Queue Mode' : 'Queue Mode Off'}</span>
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {queue.length > 1 && (
                      <button
                        onClick={shuffleQueue}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-white/80 hover:text-white text-[11px] font-semibold transition-all cursor-pointer active:scale-95"
                        title="Shuffle upcoming tracks"
                      >
                        <Shuffle className="w-3 h-3" />
                        <span>Shuffle</span>
                      </button>
                    )}
                    {queue.length > 1 && (
                      <button
                        onClick={clearQueue}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-white/60 hover:text-accent-red text-[11px] font-semibold transition-all cursor-pointer active:scale-95"
                        title="Clear all tracks except currently playing"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Clear</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Queue List */}
                <div className="flex-1 overflow-y-auto scrollbar-none flex flex-col gap-1.5 py-1">
                  {queue.map((item, idx) => {
                    const isCurrent = idx === queueIndex;
                    return (
                      <div
                        key={`${item.videoId}-${idx}`}
                        className={`flex items-center justify-between p-2 rounded-2xl transition-all duration-200 group ${
                          isCurrent
                            ? 'bg-white/[0.14] border border-white/25 text-white font-semibold shadow-lg'
                            : 'hover:bg-white/[0.06] border border-transparent hover:border-white/[0.08] text-white/70'
                        }`}
                      >
                        <div
                          onClick={() => playSong(item)}
                          className="flex items-center gap-3 overflow-hidden flex-1 cursor-pointer min-w-0"
                        >
                          <div className="relative w-10 h-10 rounded-xl overflow-hidden shrink-0 bg-white/5 border border-white/10">
                            <img
                              src={item.thumbnailUrl || (item.videoId ? `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg` : '/logo.svg')}
                              alt={item.title}
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                e.currentTarget.src = '/logo.svg';
                              }}
                              className="w-full h-full object-cover"
                            />
                            {isCurrent && (
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                <div className="w-2 h-2 rounded-full bg-accent-red animate-ping" />
                              </div>
                            )}
                          </div>
                          <div className="overflow-hidden flex-1 min-w-0">
                            <p className="text-sm truncate leading-tight font-medium">
                              {item.title}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5 overflow-hidden">
                              {item.isExplicit && (
                                <span className="px-1 py-0.2 rounded text-[9px] font-bold bg-white/20 text-white/90 uppercase tracking-wider shrink-0">
                                  E
                                </span>
                              )}
                              <p className="text-xs text-white/50 truncate">
                                {item.artist}
                              </p>
                              {item.durationText && (
                                <>
                                  <span className="text-white/30 text-[10px] shrink-0">•</span>
                                  <span className="text-xs text-white/40 shrink-0 font-mono">
                                    {item.durationText}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Queue Arrange Controls */}
                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          {isCurrent ? (
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-accent-red/25 text-accent-red border border-accent-red/40">
                              Now
                            </span>
                          ) : (
                            <>
                              <button
                                onClick={() => moveQueueItem(idx, Math.max(0, idx - 1))}
                                disabled={idx === 0}
                                className="p-1.5 rounded-lg hover:bg-white/15 text-white/40 hover:text-white disabled:opacity-20 transition-all cursor-pointer"
                                title="Move up in queue"
                              >
                                <ChevronUp className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => moveQueueItem(idx, Math.min(queue.length - 1, idx + 1))}
                                disabled={idx === queue.length - 1}
                                className="p-1.5 rounded-lg hover:bg-white/15 text-white/40 hover:text-white disabled:opacity-20 transition-all cursor-pointer"
                                title="Move down in queue"
                              >
                                <ChevronDown className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => removeFromQueue(idx)}
                                className="p-1.5 rounded-lg hover:bg-white/15 text-white/40 hover:text-accent-red transition-all cursor-pointer"
                                title="Remove from queue"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* SUB-TAB 2: Related Music Chart */}
            {queueSubTab === 'RELATED' && (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-1 py-1.5 text-xs text-white/60">
                  <div className="flex items-center gap-2 overflow-hidden mr-2">
                    <span className="text-[11px] font-medium truncate">
                      Based on <strong className="text-white">{currentSong.title}</strong>
                    </span>
                    <button
                      onClick={handleRefreshRelated}
                      disabled={isLoadingRelated}
                      className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/10 hover:bg-white/20 text-white/70 hover:text-white border border-white/10 transition-all cursor-pointer active:scale-95 disabled:opacity-50 shrink-0"
                      title="Refresh related songs"
                    >
                      <RotateCw className={`w-2.5 h-2.5 ${isLoadingRelated ? 'animate-spin' : ''}`} />
                      <span>Refresh</span>
                    </button>
                  </div>
                  {relatedSongs.length > 0 && (
                    <button
                      onClick={handleAddAllRelated}
                      className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer active:scale-95 shrink-0 ${
                        addedAllFeedback
                          ? 'bg-green-500/25 text-green-300 border border-green-500/40'
                          : 'bg-accent-red/20 text-accent-red hover:bg-accent-red hover:text-white border border-accent-red/30'
                      }`}
                    >
                      {addedAllFeedback ? 'Added to Queue' : 'Add All to Queue'}
                    </button>
                  )}
                </div>

                {isLoadingRelated ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-white/50 gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-accent-red" />
                    <span className="text-xs uppercase tracking-wider">Discovering related tracks...</span>
                  </div>
                ) : relatedSongs.length > 0 ? (
                  <div className="flex-1 overflow-y-auto scrollbar-none flex flex-col gap-1.5 py-1">
                    {relatedSongs.map((song) => {
                      const isAdded = addedFeedback[song.videoId];
                      return (
                        <div
                          key={song.videoId}
                          className="flex items-center justify-between p-2 rounded-2xl hover:bg-white/[0.06] border border-transparent hover:border-white/[0.08] transition-all group"
                        >
                          <div
                            onClick={() => playSong(song)}
                            className="flex items-center gap-3 overflow-hidden flex-1 cursor-pointer min-w-0"
                          >
                            <img
                              src={song.thumbnailUrl || (song.videoId ? `https://i.ytimg.com/vi/${song.videoId}/hqdefault.jpg` : '/logo.svg')}
                              alt={song.title}
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                e.currentTarget.src = '/logo.svg';
                              }}
                              className="w-11 h-11 rounded-xl object-cover bg-white/5 border border-white/10 shrink-0 shadow-sm"
                            />
                            <div className="overflow-hidden flex-1 min-w-0">
                              <p className="text-sm truncate leading-tight font-semibold text-white group-hover:text-accent-red transition-colors">
                                {song.title}
                              </p>
                              <div className="flex items-center gap-1.5 mt-0.5 overflow-hidden">
                                {song.isExplicit && (
                                  <span className="px-1 py-0.2 rounded text-[9px] font-bold bg-white/20 text-white/90 uppercase tracking-wider shrink-0">
                                    E
                                  </span>
                                )}
                                <p className="text-xs text-white/50 truncate">
                                  {song.artist}
                                </p>
                                {song.albumName && (
                                  <>
                                    <span className="text-white/30 text-[10px] shrink-0">•</span>
                                    <span className="text-xs text-white/40 truncate">
                                      {song.albumName}
                                    </span>
                                  </>
                                )}
                                {song.durationText && (
                                  <>
                                    <span className="text-white/30 text-[10px] shrink-0">•</span>
                                    <span className="text-xs text-white/40 shrink-0 font-mono">
                                      {song.durationText}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            <button
                              onClick={() => playSong(song)}
                              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/25 active:scale-90 flex items-center justify-center transition-all cursor-pointer text-white"
                              title="Play track"
                            >
                              <Play className="w-4 h-4 fill-white text-white ml-0.5" />
                            </button>
                            <button
                              onClick={() => handleAddRelatedToQueue(song)}
                              className={`w-9 h-9 rounded-full transition-all cursor-pointer active:scale-90 flex items-center justify-center ${
                                isAdded
                                  ? 'bg-green-500/25 text-green-400 border border-green-500/40'
                                  : 'bg-white/10 hover:bg-white/25 border border-white/10 text-white/80 hover:text-white'
                              }`}
                              title={isAdded ? 'Added to queue' : 'Add to queue'}
                            >
                              {isAdded ? (
                                <Check className="w-4 h-4 stroke-[3]" />
                              ) : (
                                <Plus className="w-4 h-4 stroke-[2.5]" />
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-white/40 text-xs gap-2">
                    <Radio className="w-8 h-8 opacity-30" />
                    <span>No related tracks available at this time.</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 4. Scrubber Bar with Played & Remaining Time */}
        <div className="w-full pt-1 pb-1">
          <div
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const clickX = e.clientX - rect.left;
              const ratio = Math.max(0, Math.min(1, clickX / rect.width));
              seek(ratio * duration);
            }}
            className="w-full h-1 hover:h-1.5 bg-white/20 rounded-full cursor-pointer relative group transition-all duration-150"
          >
            <div
              className="h-full bg-white rounded-full transition-all duration-100 ease-out relative"
              style={{ width: `${progressPercent}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>

          {/* Time row: 0:21 on left, -2:48 on right */}
          <div className="flex justify-between items-center text-[11px] sm:text-xs font-mono font-medium text-white/50 mt-2 px-0.5">
            <span>{formatTime(currentTime)}</span>
            <span>{formatRemainingTime(duration - currentTime)}</span>
          </div>
        </div>

        {/* 5. Main Playback Transport Controls (SkipBack, Play/Pause, SkipForward) */}
        <div className="flex items-center justify-around w-full py-3">
          {/* Previous Track */}
          <button
            onClick={prev}
            className="p-3.5 text-white hover:text-white/80 hover:scale-110 active:scale-90 transition-transform cursor-pointer flex items-center justify-center shrink-0"
            title="Previous track"
          >
            <svg
              viewBox="0 0 24 24"
              width="40"
              height="40"
              className="w-10 h-10 sm:w-12 sm:h-12 fill-white drop-shadow-md shrink-0"
              aria-hidden="true"
            >
              <rect x="3" y="4" width="2.5" height="16" rx="1.25" />
              <path d="M20 4.868a1.2 1.2 0 0 0-1.821-1.026L7.4 10.974a1.2 1.2 0 0 0 0 2.052l10.779 7.132A1.2 1.2 0 0 0 20 19.132V4.868z" />
            </svg>
          </button>

          {/* Play / Pause - Large Bold White Glyph */}
          <button
            onClick={togglePlay}
            className="p-3 sm:p-4 text-white hover:scale-105 active:scale-90 transition-transform cursor-pointer drop-shadow-[0_0_30px_rgba(255,255,255,0.45)] flex items-center justify-center shrink-0"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <svg
                viewBox="0 0 24 24"
                width="64"
                height="64"
                className="w-16 h-16 sm:w-20 sm:h-20 fill-white shrink-0"
                aria-hidden="true"
              >
                <rect x="5" y="3" width="4.5" height="18" rx="2" />
                <rect x="14.5" y="3" width="4.5" height="18" rx="2" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                width="64"
                height="64"
                className="w-16 h-16 sm:w-20 sm:h-20 fill-white ml-1 shrink-0"
                aria-hidden="true"
              >
                <path d="M6 3.868a1.5 1.5 0 0 1 2.277-1.282l12.44 7.632a1.5 1.5 0 0 1 0 2.564L8.277 20.414A1.5 1.5 0 0 1 6 19.132V3.868z" />
              </svg>
            )}
          </button>

          {/* Next Track */}
          <button
            onClick={next}
            className="p-3.5 text-white hover:text-white/80 hover:scale-110 active:scale-90 transition-transform cursor-pointer flex items-center justify-center shrink-0"
            title="Next track"
          >
            <svg
              viewBox="0 0 24 24"
              width="40"
              height="40"
              className="w-10 h-10 sm:w-12 sm:h-12 fill-white drop-shadow-md shrink-0"
              aria-hidden="true"
            >
              <rect x="18.5" y="4" width="2.5" height="16" rx="1.25" />
              <path d="M4 4.868a1.2 1.2 0 0 1 1.821-1.026L16.6 10.974a1.2 1.2 0 0 1 0 2.564L5.821 20.158A1.2 1.2 0 0 1 4 19.132V4.868z" />
            </svg>
          </button>
        </div>

        {/* 6. Volume Slider Row */}
        <div className="w-full flex items-center gap-3 px-2 py-1.5">
          <button
            onClick={() => setVolume(volume > 0 ? 0 : 0.8)}
            className="text-white/60 hover:text-white transition-colors cursor-pointer shrink-0"
            title="Mute / Unmute"
          >
            {volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume1 className="w-5 h-5" />}
          </button>

          <div className="flex-1 relative flex items-center">
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-white/20 accent-white transition-all [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
              style={{
                background: `linear-gradient(to right, #ffffff ${volume * 100}%, rgba(255,255,255,0.2) ${volume * 100}%)`,
              }}
              title="Volume"
            />
          </div>

          <button
            onClick={() => setVolume(1)}
            className="text-white/60 hover:text-white transition-colors cursor-pointer shrink-0"
            title="Max Volume"
          >
            <Volume2 className="w-5 h-5" />
          </button>
        </div>

        {/* 7. Bottom 4 Action Buttons (Speech Bubble, Infinity Pill, Download, Queue) */}
        <div className="flex items-center justify-between w-full px-2 pt-2 pb-1">
          {/* Button 1: Lyrics Toggle */}
          <button
            onClick={() => setNowPlayingTab(nowPlayingTab === 'LYRICS' ? 'PLAYER' : 'LYRICS')}
            className={`p-3 rounded-full transition-all duration-200 active:scale-90 cursor-pointer ${nowPlayingTab === 'LYRICS'
              ? 'text-white bg-white/20'
              : 'text-white/60 hover:text-white'
              }`}
            title="Synchronized Lyrics"
          >
            <MessageSquareText className="w-6 h-6 sm:w-7 sm:h-7 stroke-[2.2]" />
          </button>

          {/* Button 2: Highlighted Loop / Continue / Repeat Mode Pill */}
          <div className="relative flex items-center justify-center">
            <button
              onClick={handleCyclePlaybackMode}
              className={`w-16 sm:w-20 h-10 sm:h-12 rounded-full flex items-center justify-center transition-all duration-300 active:scale-95 shadow-lg cursor-pointer ${
                autoplay || repeatMode !== 'OFF'
                  ? 'bg-white/30 backdrop-blur-2xl border border-white/40 text-white shadow-[0_0_20px_rgba(255,255,255,0.3)]'
                  : 'bg-white/10 backdrop-blur-md border border-white/10 text-white/40 hover:text-white/70'
              }`}
              title={
                autoplay
                  ? 'Default: Playing Related Autoplay (Click for Queue Mode)'
                  : repeatMode === 'ALL'
                  ? 'Queue Mode: Playing Queue Songs (Click to repeat track)'
                  : repeatMode === 'ONE'
                  ? 'Loop: Repeat One Track (Click to turn off)'
                  : 'Playback: Normal (Click for Autoplay)'
              }
            >
              {autoplay ? (
                <Infinity className="w-6 h-6 stroke-[2.4]" />
              ) : repeatMode === 'ALL' ? (
                <Repeat className="w-5 h-5 stroke-[2.4]" />
              ) : repeatMode === 'ONE' ? (
                <Repeat1 className="w-5 h-5 stroke-[2.4]" />
              ) : (
                <Infinity className="w-6 h-6 stroke-[2.4] opacity-40" />
              )}
            </button>

            {/* Quick Feedback Toast for Playback Mode */}
            {playbackModeFeedback && (
              <div className="absolute -top-10 px-3 py-1 rounded-full bg-black/85 backdrop-blur-xl border border-white/20 text-white text-[11px] font-semibold whitespace-nowrap animate-in fade-in zoom-in-95 duration-150 shadow-xl pointer-events-none">
                {playbackModeFeedback}
              </div>
            )}
          </div>

          {/* Button 3: Direct File Download Button */}
          <button
            onClick={handleDirectDownload}
            disabled={isDownloading}
            className={`p-3 rounded-full transition-all duration-200 active:scale-90 cursor-pointer ${
              downloadStatus === 'SUCCESS' || isDownloaded
                ? 'text-accent-red hover:text-accent-red/90'
                : isDownloading
                ? 'text-white'
                : 'text-white/60 hover:text-white'
            }`}
            title={
              isDownloading
                ? 'Downloading high-quality audio file...'
                : downloadStatus === 'SUCCESS'
                ? 'Downloaded!'
                : isDownloaded
                ? 'Re-download direct file (320kbps)'
                : 'Direct file download (320kbps high quality)'
            }
          >
            {isDownloading ? (
              <Loader2 className="w-6 h-6 sm:w-7 sm:h-7 animate-spin stroke-[2.2]" />
            ) : downloadStatus === 'SUCCESS' || isDownloaded ? (
              <Check className="w-6 h-6 sm:w-7 sm:h-7 stroke-[2.8]" />
            ) : (
              <Download className="w-6 h-6 sm:w-7 sm:h-7 stroke-[2.2]" />
            )}
          </button>

          {/* Button 4: Queue / Up Next Button */}
          <button
            onClick={() => setNowPlayingTab(nowPlayingTab === 'QUEUE' ? 'PLAYER' : 'QUEUE')}
            className={`p-3 rounded-full transition-all duration-200 active:scale-90 cursor-pointer ${nowPlayingTab === 'QUEUE'
              ? 'text-white bg-white/20'
              : 'text-white/60 hover:text-white'
              }`}
            title="Up Next Queue"
          >
            <ListMusic className="w-6 h-6 sm:w-7 sm:h-7 stroke-[2.2]" />
          </button>
        </div>
      </div>

      {/* Floating More Options Sheet (triggered by •••) */}
      {showOptionsMenu && (
        <div
          onClick={() => setShowOptionsMenu(false)}
          className="absolute inset-0 z-50 bg-black/60 backdrop-blur-md flex flex-col justify-end p-4 animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm mx-auto liquid-glass rounded-3xl p-4 flex flex-col gap-2 border border-white/20 shadow-2xl"
          >
            <div className="flex items-center gap-3 p-2 pb-3 border-b border-white/10">
              <img
                src={artworkUrl}
                alt={currentSong.title}
                referrerPolicy="no-referrer"
                onError={handleArtworkError}
                className="w-12 h-12 rounded-xl object-cover border border-white/15"
              />
              <div className="overflow-hidden flex-1">
                <h4 className="text-sm font-bold text-white truncate">{currentSong.title}</h4>
                <p className="text-xs text-white/50 truncate mt-0.5">{currentSong.artist}</p>
              </div>
            </div>

            {/* Dynamic Audio Quality Selector */}
            <div className="p-3 my-1 rounded-2xl bg-white/[0.06] border border-white/10 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs font-semibold text-white/80 px-1">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-accent-red" />
                  <span>Audio Streaming Quality</span>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/10 text-white border border-white/10">
                  {audioQuality === 'LOSSLESS' ? 'Lossless 320k' : audioQuality === 'HIGH' ? 'High 256k' : 'Normal 128k'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 mt-0.5">
                {[
                  { id: 'LOSSLESS' as const, label: 'Lossless', sub: '320 kbps' },
                  { id: 'HIGH' as const, label: 'High', sub: '256 kbps' },
                  { id: 'LOW' as const, label: 'Normal', sub: '128 kbps' },
                ].map((q) => {
                  const isActive = audioQuality === q.id;
                  return (
                    <button
                      key={q.id}
                      onClick={() => setAudioQuality(q.id)}
                      className={`py-2 px-1.5 rounded-xl text-center transition-all cursor-pointer border ${
                        isActive
                          ? 'bg-accent-red text-white border-accent-red shadow-[0_0_12px_rgba(250,45,72,0.4)] font-bold'
                          : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10 border-white/10 text-xs font-medium'
                      }`}
                    >
                      <div className="text-xs leading-tight">{q.label}</div>
                      <div className={`text-[10px] mt-0.5 ${isActive ? 'text-white/80' : 'text-white/40'}`}>
                        {q.sub}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {currentSong.albumId && onOpenDetail && (
              <button
                onClick={() => {
                  setShowOptionsMenu(false);
                  onOpenDetail(currentSong.albumId!, undefined, currentSong.albumName || 'Album');
                }}
                className="flex items-center gap-3 p-3 rounded-2xl hover:bg-white/10 text-white/80 hover:text-white text-xs font-semibold transition-colors text-left cursor-pointer"
              >
                <Disc3 className="w-4 h-4 text-accent-red" />
                <span>View Album ({currentSong.albumName || 'Album'})</span>
              </button>
            )}

            {currentSong.artistId && onOpenDetail && (
              <button
                onClick={() => {
                  setShowOptionsMenu(false);
                  onOpenDetail(currentSong.artistId!, undefined, currentSong.artist, undefined, null, 'ARTIST');
                }}
                className="flex items-center gap-3 p-3 rounded-2xl hover:bg-white/10 text-white/80 hover:text-white text-xs font-semibold transition-colors text-left cursor-pointer"
              >
                <Music2 className="w-4 h-4 text-accent-red" />
                <span>View Artist ({currentSong.artist})</span>
              </button>
            )}

            {onOpenEqualizer && (
              <button
                onClick={() => {
                  setShowOptionsMenu(false);
                  onOpenEqualizer();
                }}
                className="flex items-center gap-3 p-3 rounded-2xl hover:bg-white/10 text-white/80 hover:text-white text-xs font-semibold transition-colors text-left cursor-pointer"
              >
                <Sliders className="w-4 h-4 text-accent-red" />
                <span>Equalizer & 2D Tone Pad</span>
              </button>
            )}

            {onOpenListenTogether && (
              <button
                onClick={() => {
                  setShowOptionsMenu(false);
                  onOpenListenTogether();
                }}
                className="flex items-center gap-3 p-3 rounded-2xl hover:bg-white/10 text-white/80 hover:text-white text-xs font-semibold transition-colors text-left cursor-pointer"
              >
                <Users className="w-4 h-4 text-accent-red" />
                <span>Listen Together (Jam Party)</span>
              </button>
            )}

            {onOpenSettings && (
              <button
                onClick={() => {
                  setShowOptionsMenu(false);
                  onOpenSettings();
                }}
                className="flex items-center gap-3 p-3 rounded-2xl hover:bg-white/10 text-white/80 hover:text-white text-xs font-semibold transition-colors text-left cursor-pointer"
              >
                <Settings className="w-4 h-4 text-accent-red" />
                <span>Settings & Preferences</span>
              </button>
            )}

            <button
              onClick={() => {
                setShowOptionsMenu(false);
                if (navigator.share) {
                  navigator.share({
                    title: currentSong.title,
                    text: `Listening to ${currentSong.title} by ${currentSong.artist} on YZ Music`,
                    url: window.location.href,
                  });
                }
              }}
              className="flex items-center gap-3 p-3 rounded-2xl hover:bg-white/10 text-white/80 hover:text-white text-xs font-semibold transition-colors text-left cursor-pointer"
            >
              <Share2 className="w-4 h-4 text-accent-red" />
              <span>Share Song</span>
            </button>

            <button
              onClick={() => setShowOptionsMenu(false)}
              className="w-full py-2.5 mt-2 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
