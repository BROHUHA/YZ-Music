/**
 * YZ Music Web - Authoritative Player Store (Zustand)
 * Faithful to MainViewModel.kt & PlaybackService.kt
 */

import { create } from 'zustand';
import { Song, RepeatMode, LikeStatus } from '../types';
import { PaletteColors } from '../utils/paletteExtractor';
import { audioEngine } from '../audio/audioEngine';
import { innertubeService } from '../services/innertube';
import { jioSaavnService } from '../services/jiosaavn';
import { listenTogetherService } from '../services/listenTogether';

// High-speed stream cache for instant 0ms playback and gapless skipping
const streamCache = new Map<string, string>();

/**
 * Resolves and pre-downloads the upcoming track in advance for 0ms instant switching
 */
async function prepareUpcomingSong(song: Song) {
  if (!song) return;

  let streamUrl = streamCache.get(song.videoId);
  if (!streamUrl) {
    try {
      // 1. Prioritize 320kbps Lossless CDN stream (JioSaavn)
      const saavnMatch = await jioSaavnService.findMatch(song.title, song.artist);
      if (saavnMatch) {
        streamUrl = saavnMatch;
        streamCache.set(song.videoId, saavnMatch);
      } else {
        // 2. Direct high-bitrate YouTube audio stream fallback
        const directYtStream = await innertubeService.resolveAudioStream(song.videoId);
        if (directYtStream && directYtStream.startsWith('http')) {
          streamUrl = directYtStream;
          streamCache.set(song.videoId, directYtStream);
        }
      }
    } catch (e) {
      console.warn('Background advance stream resolution error:', e);
    }
  }

  // Pre-download audio stream bytes into browser cache in advance
  audioEngine.preloadNextTrack(streamUrl || null, song.videoId);
}

function getNextTrack(state: PlayerState): Song | null {
  const { queue, queueIndex, repeatMode, autoplay, currentSong } = state;
  if (repeatMode === 'ONE' && currentSong) return currentSong;
  if (repeatMode === 'ALL') {
    if (queueIndex + 1 < queue.length) return queue[queueIndex + 1];
    return queue[0] || null;
  }
  if (autoplay) {
    const nextManual = queue.slice(queueIndex + 1).find((s) => s.fromAutoplay === false);
    if (nextManual && queue[queueIndex + 1]?.videoId === nextManual.videoId) {
      return nextManual;
    }
    const nextAutoplay = queue.slice(queueIndex + 1).find((s) => s.fromAutoplay === true);
    if (nextAutoplay) return nextAutoplay;
    if (queueIndex + 1 < queue.length) return queue[queueIndex + 1];
  }
  if (queueIndex + 1 < queue.length) return queue[queueIndex + 1];
  return null;
}

interface PlayerState {
  currentSong: Song | null;
  currentPalette: PaletteColors | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  queue: Song[];
  queueIndex: number;
  stationSeedId: string | null;
  repeatMode: RepeatMode;
  shuffle: boolean;
  autoplay: boolean;
  volume: number;
  likeStatuses: Record<string, LikeStatus>;
  
  // Responsive UI States
  isNowPlayingOpen: boolean;
  nowPlayingTab: 'PLAYER' | 'LYRICS' | 'QUEUE';

  // Actions
  playSong: (song: Song, newQueue?: Song[], isExplicitQueue?: boolean) => Promise<void>;
  setCurrentPalette: (palette: PaletteColors) => void;
  togglePlay: () => void;
  next: () => Promise<void>;
  prev: () => Promise<void>;
  seek: (seconds: number) => void;
  setVolume: (volume: number) => void;
  setQueue: (queue: Song[], index?: number) => void;
  addToQueue: (song: Song) => void;
  addMultipleToQueue: (songs: Song[]) => void;
  playNext: (song: Song) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  toggleAutoplay: () => void;
  cyclePlaybackMode: () => 'CONTINUE' | 'REPEAT_ALL' | 'REPEAT_ONE' | 'OFF';
  setPlaybackMode: (mode: 'CONTINUE' | 'REPEAT_ALL' | 'REPEAT_ONE' | 'OFF') => void;
  refreshRelatedQueue: () => Promise<void>;
  moveQueueItem: (fromIndex: number, toIndex: number) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  shuffleQueue: () => void;
  toggleLike: (videoId: string) => void;
  setNowPlayingOpen: (open: boolean) => void;
  setNowPlayingTab: (tab: 'PLAYER' | 'LYRICS' | 'QUEUE') => void;
}

function recordPlaybackHistory(song: Song) {
  try {
    const raw = localStorage.getItem('yz_playback_history');
    const list: Song[] = raw ? JSON.parse(raw) : [];
    const filtered = list.filter((s) => s.videoId !== song.videoId);
    const updated = [song, ...filtered].slice(0, 100);
    localStorage.setItem('yz_playback_history', JSON.stringify(updated));
  } catch (e) {
    console.warn('Failed recording history:', e);
  }
}

function getSavedVolume(): number {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('yz_volume') : null;
    if (raw !== null) {
      const val = parseFloat(raw);
      if (!isNaN(val) && val >= 0 && val <= 1) {
        return val;
      }
    }
  } catch {}
  return 0.8;
}

export const usePlayerStore = create<PlayerState>((set, get) => {
  // Bind AudioEngine callbacks
  audioEngine.onTimeUpdate((currentTime, duration) => {
    set({ currentTime, duration });
  });

  audioEngine.onPlayStateChange((isPlaying) => {
    if (isPlaying) {
      audioEngine.setVolume(get().volume);
    }
    set({ isPlaying });
  });

  audioEngine.onTrackLoaded(() => {
    audioEngine.setVolume(get().volume);
  });

  audioEngine.onEnded(() => {
    const { repeatMode, next, seek } = get();
    if (repeatMode === 'ONE') {
      seek(0);
      audioEngine.resume();
    } else {
      next();
    }
  });

  // Hardware Media Keys & OS Lockscreen Handlers
  if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
    try {
      navigator.mediaSession.setActionHandler('play', () => get().togglePlay());
      navigator.mediaSession.setActionHandler('pause', () => get().togglePlay());
      navigator.mediaSession.setActionHandler('previoustrack', () => get().prev());
      navigator.mediaSession.setActionHandler('nexttrack', () => get().next());
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (typeof details.seekTime === 'number') {
          get().seek(details.seekTime);
        }
      });
    } catch (e) {
      console.warn('MediaSession handler registration skipped', e);
    }
  }

  return {
    currentSong: null,
    currentPalette: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    queue: [],
    queueIndex: -1,
    stationSeedId: null,
    repeatMode: 'OFF',
    shuffle: false,
    autoplay: true,
    volume: getSavedVolume(),
    likeStatuses: {},
    isNowPlayingOpen: false,
    nowPlayingTab: 'PLAYER',

    setCurrentPalette: (palette: PaletteColors) => {
      set({ currentPalette: palette });
      if (typeof document !== 'undefined') {
        document.documentElement.style.setProperty('--song-dominant', palette.dominant);
        document.documentElement.style.setProperty('--song-secondary', palette.secondary);
        document.documentElement.style.setProperty('--song-dark-base', palette.darkBase);
        document.documentElement.style.setProperty('--song-bottom', palette.bottomColor);
      }
    },

    playSong: async (song: Song, newQueue?: Song[], isExplicitQueue: boolean = false) => {
      // Ensure the playing song has a non-empty thumbnail URL
      const resolvedSong: Song = {
        ...song,
        thumbnailUrl:
          song.thumbnailUrl && song.thumbnailUrl !== '/logo.svg'
            ? song.thumbnailUrl
            : song.videoId
            ? `https://i.ytimg.com/vi/${song.videoId}/mqdefault.jpg`
            : '/logo.svg',
      };

      const isQueueMode = get().repeatMode === 'ALL' || isExplicitQueue;
      let queue = get().queue;
      let queueIndex = get().queueIndex;
      let stationSeedId = get().stationSeedId;

      if (isQueueMode && newQueue && newQueue.length > 0) {
        // In Queue Mode (or explicit playlist queue): retain and play through the given queue
        queue = newQueue.map((s) => ({
          ...s,
          thumbnailUrl:
            s.thumbnailUrl && s.thumbnailUrl !== '/logo.svg'
              ? s.thumbnailUrl
              : s.videoId
              ? `https://i.ytimg.com/vi/${s.videoId}/mqdefault.jpg`
              : resolvedSong.thumbnailUrl,
        }));
        queueIndex = queue.findIndex((s) => s.videoId === resolvedSong.videoId);
        if (queueIndex === -1) {
          queue.unshift(resolvedSong);
          queueIndex = 0;
        }
        stationSeedId = null;
      } else if (isQueueMode) {
        // In Queue Mode without newQueue: preserve existing queue
        const existingIdx = queue.findIndex((s) => s.videoId === resolvedSong.videoId);
        if (existingIdx !== -1) {
          queueIndex = existingIdx;
        } else {
          queue = [resolvedSong, ...queue];
          queueIndex = 0;
        }
      } else {
        // Default Autoplay Mode:
        // Once a related queue is formed, do NOT refresh until it reaches end of queue or user refresh!
        const existingIdx = queue.findIndex((s) => s.videoId === resolvedSong.videoId);
        if (existingIdx !== -1 && queue.length > 1) {
          // Song is already part of the existing formed queue: keep the queue intact!
          queueIndex = existingIdx;
        } else {
          // Brand new song selected outside current queue: form a fresh related queue
          const manualUpcoming = queue.slice(queueIndex + 1).filter((s) => s.fromAutoplay === false);
          queue = [resolvedSong, ...manualUpcoming];
          queueIndex = 0;
          stationSeedId = resolvedSong.videoId;
        }
      }

      set({
        currentSong: resolvedSong,
        queue,
        queueIndex,
        stationSeedId,
        isPlaying: true,
      });

      recordPlaybackHistory(resolvedSong);
      audioEngine.updateMediaSession(resolvedSong);

      if (listenTogetherService.isConnected) {
        listenTogetherService.sendTrack(song);
      }

      // Stream Resolution Pipeline: check memory cache first for 0ms instant start
      let streamUrl = streamCache.get(song.videoId);

      if (!streamUrl) {
        try {
          // Fast parallel resolution: query 320k Lossless stream (JioSaavn)
          const matchPromise = jioSaavnService.findMatch(song.title, song.artist);
          const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500));
          const match = await Promise.race([matchPromise, timeoutPromise]);
          if (match) {
            streamUrl = match;
            streamCache.set(song.videoId, match);
          } else {
            // Direct high-bitrate audio stream fallback (100% ad-free Web Audio playback)
            const ytStreamPromise = innertubeService.resolveAudioStream(song.videoId);
            const ytTimeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500));
            const ytMatch = await Promise.race([ytStreamPromise, ytTimeoutPromise]);
            if (ytMatch && ytMatch.startsWith('http')) {
              streamUrl = ytMatch;
              streamCache.set(song.videoId, ytMatch);
            }
          }
        } catch (e) {
          console.warn('Stream resolution error:', e);
        }
      }

      // Strictly enforce fixed user volume across track transitions
      audioEngine.setVolume(get().volume);

      if (streamUrl) {
        try {
          await audioEngine.playUrl(streamUrl);
        } catch (err) {
          console.warn('HTML5 direct playback failed, falling back to YouTube', err);
          await audioEngine.playVideo(song.videoId);
        }
      } else {
        try {
          await audioEngine.playVideo(song.videoId);
        } catch (err) {
          console.error('Failed to play video for', song.title, err);
        }
      }

      // In Default Autoplay Mode:
      // Once a related queue formed, do NOT refresh until it reaches end of queue or user refresh!
      if (!isQueueMode && get().autoplay) {
        const isQueueFormed = queue.length > 1;
        const isNearEnd = queue.length - queueIndex <= 2;

        if (!isQueueFormed || isNearEnd) {
          const seedIdToQuery = isNearEnd && queue.length > 0 ? queue[queue.length - 1].videoId : resolvedSong.videoId;
          try {
            const recommendations = await innertubeService.getNext(seedIdToQuery);
            const currentIds = new Set(get().queue.map((s) => s.videoId));
            const fresh = recommendations
              .filter((r) => r.videoId !== resolvedSong.videoId && !currentIds.has(r.videoId))
              .map((r) => ({ ...r, fromAutoplay: true }));

            if (fresh.length > 0) {
              set((state) => ({
                queue: [...state.queue, ...fresh],
              }));
              const nextUp = getNextTrack(get());
              if (nextUp) prepareUpcomingSong(nextUp);
            }
          } catch (e) {
            console.warn('Autoplay load/replenish failed:', e);
          }
        } else {
          // Queue is already formed and not near end: pre-download upcoming track in advance
          const nextUp = getNextTrack(get());
          if (nextUp) prepareUpcomingSong(nextUp);
        }
      } else {
        // In Queue Mode: Immediately pre-download next song in queue for zero-lag gapless skipping
        const nextUp = getNextTrack(get());
        if (nextUp) prepareUpcomingSong(nextUp);
      }
    },

    togglePlay: () => {
      const { isPlaying } = get();
      if (isPlaying) {
        audioEngine.pause();
        set({ isPlaying: false });
        if (listenTogetherService.isConnected) {
          listenTogetherService.sendPause();
        }
      } else {
        audioEngine.resume();
        set({ isPlaying: true });
        if (listenTogetherService.isConnected) {
          listenTogetherService.sendPlay();
        }
      }
    },

    next: async () => {
      const { queue, queueIndex, playSong, repeatMode, autoplay, currentSong } = get();

      // Mode 1: Repeat One Track
      if (repeatMode === 'ONE' && currentSong) {
        audioEngine.seek(0);
        audioEngine.resume();
        return;
      }

      // Mode 2: Queue Mode (repeatMode === 'ALL')
      // "play queue when we select queue mode"
      if (repeatMode === 'ALL') {
        if (queueIndex + 1 < queue.length) {
          await playSong(queue[queueIndex + 1], undefined, true);
        } else if (queue.length > 0) {
          await playSong(queue[0], undefined, true);
        }
        return;
      }

      // Mode 3: Default Autoplay Mode (autoplay === true)
      // "always play default releted autoplay songs insted of queue songs"
      if (autoplay) {
        // Priority 1: User explicitly added a manual track to queue (with '+'), play it!
        const nextManualSong = queue.slice(queueIndex + 1).find((s) => s.fromAutoplay === false);
        if (nextManualSong && queue[queueIndex + 1]?.videoId === nextManualSong.videoId) {
          await playSong(nextManualSong);
          return;
        }

        // Priority 2: Upcoming related autoplay track in queue
        const nextAutoplay = queue.slice(queueIndex + 1).find((s) => s.fromAutoplay === true);
        if (nextAutoplay) {
          const remainingAutoplay = queue.slice(queueIndex + 1).filter((s) => s.fromAutoplay === true).length;
          if (remainingAutoplay <= 3 && currentSong) {
            innertubeService
              .getNext(nextAutoplay.videoId)
              .then((more) => {
                const currentIds = new Set(get().queue.map((s) => s.videoId));
                const fresh = more
                  .filter((r) => !currentIds.has(r.videoId))
                  .map((r) => ({ ...r, fromAutoplay: true }));
                if (fresh.length > 0) {
                  set((state) => ({ queue: [...state.queue, ...fresh] }));
                }
              })
              .catch((e) => console.warn('Autoplay replenishment failed:', e));
          }

          await playSong(nextAutoplay);
          return;
        }

        // Priority 3: No upcoming autoplay tracks remaining, fetch fresh related songs for currentSong
        if (currentSong) {
          try {
            const recommendations = await innertubeService.getNext(currentSong.videoId);
            const currentIds = new Set(queue.map((s) => s.videoId));
            const fresh = recommendations
              .filter((r) => r.videoId !== currentSong.videoId && !currentIds.has(r.videoId))
              .map((r) => ({ ...r, fromAutoplay: true }));

            if (fresh.length > 0) {
              set((state) => ({ queue: [...state.queue, ...fresh] }));
              await playSong(fresh[0]);
              return;
            }
          } catch (e) {
            console.warn('Next autoplay fetch failed:', e);
          }
        }

        // Fallback: If any track remains in queue
        if (queueIndex + 1 < queue.length) {
          await playSong(queue[queueIndex + 1]);
          return;
        }
      }

      // Mode 4: Normal Playback (OFF)
      if (queueIndex + 1 < queue.length) {
        await playSong(queue[queueIndex + 1]);
      }
    },

    prev: async () => {
      const { queue, queueIndex, playSong, currentTime, repeatMode } = get();
      if (currentTime > 3) {
        audioEngine.seek(0);
        return;
      }
      if (queueIndex > 0) {
        await playSong(queue[queueIndex - 1], undefined, repeatMode === 'ALL');
      } else {
        audioEngine.seek(0);
      }
    },

    seek: (seconds: number) => {
      audioEngine.seek(seconds);
      set({ currentTime: seconds });
      if (listenTogetherService.isConnected) {
        listenTogetherService.sendSeek(seconds * 1000);
      }
    },

    setVolume: (volume: number) => {
      const clamped = Math.max(0, Math.min(1, volume));
      audioEngine.setVolume(clamped);
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('yz_volume', String(clamped));
        }
      } catch {}
      set({ volume: clamped });
    },

    setQueue: (queue: Song[], index: number = 0) => {
      set({ queue, queueIndex: index });
    },

    addToQueue: (song: Song) => {
      set((state) => ({ queue: [...state.queue, { ...song, fromAutoplay: false }] }));
    },

    addMultipleToQueue: (songs: Song[]) => {
      set((state) => {
        const existingIds = new Set(state.queue.map((s) => s.videoId));
        const fresh = songs
          .filter((s) => !existingIds.has(s.videoId))
          .map((s) => ({ ...s, fromAutoplay: false }));
        return { queue: [...state.queue, ...(fresh.length > 0 ? fresh : songs)] };
      });
    },

    playNext: (song: Song) => {
      set((state) => {
        const newQueue = [...state.queue];
        newQueue.splice(state.queueIndex + 1, 0, { ...song, fromAutoplay: false });
        return { queue: newQueue };
      });
    },

    toggleShuffle: () => {
      set((state) => ({ shuffle: !state.shuffle }));
    },

    cycleRepeat: () => {
      set((state) => {
        const nextMode: RepeatMode =
          state.repeatMode === 'OFF' ? 'ALL' : state.repeatMode === 'ALL' ? 'ONE' : 'OFF';
        return { repeatMode: nextMode };
      });
    },

    toggleAutoplay: () => {
      set((state) => ({ autoplay: !state.autoplay }));
    },

    cyclePlaybackMode: () => {
      const { autoplay, repeatMode } = get();
      if (autoplay && repeatMode === 'OFF') {
        set({ autoplay: false, repeatMode: 'ALL' });
        return 'REPEAT_ALL';
      } else if (repeatMode === 'ALL') {
        set({ autoplay: false, repeatMode: 'ONE' });
        return 'REPEAT_ONE';
      } else if (repeatMode === 'ONE') {
        set({ autoplay: false, repeatMode: 'OFF' });
        return 'OFF';
      } else {
        set({ autoplay: true, repeatMode: 'OFF' });
        return 'CONTINUE';
      }
    },

    setPlaybackMode: (mode: 'CONTINUE' | 'REPEAT_ALL' | 'REPEAT_ONE' | 'OFF') => {
      if (mode === 'CONTINUE') {
        set({ autoplay: true, repeatMode: 'OFF' });
      } else if (mode === 'REPEAT_ALL') {
        set({ autoplay: false, repeatMode: 'ALL' });
      } else if (mode === 'REPEAT_ONE') {
        set({ autoplay: false, repeatMode: 'ONE' });
      } else {
        set({ autoplay: false, repeatMode: 'OFF' });
      }
    },

    moveQueueItem: (fromIndex: number, toIndex: number) => {
      set((state) => {
        if (
          fromIndex < 0 ||
          fromIndex >= state.queue.length ||
          toIndex < 0 ||
          toIndex >= state.queue.length
        ) {
          return state;
        }
        const newQueue = [...state.queue];
        const [moved] = newQueue.splice(fromIndex, 1);
        newQueue.splice(toIndex, 0, moved);

        let newIndex = state.queueIndex;
        if (state.queueIndex === fromIndex) {
          newIndex = toIndex;
        } else if (fromIndex < state.queueIndex && toIndex >= state.queueIndex) {
          newIndex -= 1;
        } else if (fromIndex > state.queueIndex && toIndex <= state.queueIndex) {
          newIndex += 1;
        }

        return { queue: newQueue, queueIndex: newIndex };
      });
    },

    removeFromQueue: (index: number) => {
      set((state) => {
        if (index < 0 || index >= state.queue.length) return state;
        const newQueue = state.queue.filter((_, i) => i !== index);
        let newIndex = state.queueIndex;
        if (index < state.queueIndex) {
          newIndex -= 1;
        } else if (index === state.queueIndex) {
          newIndex = Math.min(newIndex, Math.max(0, newQueue.length - 1));
        }
        return {
          queue: newQueue,
          queueIndex: newIndex,
          currentSong: newQueue[newIndex] || null,
        };
      });
    },

    clearQueue: () => {
      set((state) => {
        if (!state.currentSong) return { queue: [], queueIndex: -1 };
        return {
          queue: [state.currentSong],
          queueIndex: 0,
        };
      });
    },

    shuffleQueue: () => {
      set((state) => {
        if (state.queue.length <= 1) return state;
        const current = state.queue[state.queueIndex];
        const others = state.queue.filter((_, i) => i !== state.queueIndex);
        for (let i = others.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [others[i], others[j]] = [others[j], others[i]];
        }
        return {
          queue: current ? [current, ...others] : others,
          queueIndex: current ? 0 : -1,
        };
      });
    },

    refreshRelatedQueue: async () => {
      const { currentSong } = get();
      if (!currentSong) return;

      try {
        const recommendations = await innertubeService.getNext(currentSong.videoId);
        const fresh = recommendations
          .filter((r) => r.videoId !== currentSong.videoId)
          .map((r) => ({ ...r, fromAutoplay: true }));

        if (fresh.length > 0) {
          set((state) => {
            const manualUpcoming = state.queue.slice(state.queueIndex + 1).filter((s) => s.fromAutoplay === false);
            return {
              queue: [state.currentSong!, ...manualUpcoming, ...fresh],
              queueIndex: 0,
              stationSeedId: currentSong.videoId,
            };
          });
          prepareUpcomingSong(fresh[0]);
        }
      } catch (e) {
        console.warn('Manual refresh of related queue failed:', e);
      }
    },

    toggleLike: (videoId: string) => {
      set((state) => {
        const current = state.likeStatuses[videoId] || 'INDIFFERENT';
        const next: LikeStatus = current === 'LIKE' ? 'INDIFFERENT' : 'LIKE';

        // Directly syncs with real YouTube Music Liked Songs (VLLM)
        innertubeService.rate(videoId, next).catch((e) => {
          console.warn('Real YouTube Music rate error:', e);
        });

        return {
          likeStatuses: { ...state.likeStatuses, [videoId]: next },
        };
      });
    },

    setNowPlayingOpen: (open: boolean) => set({ isNowPlayingOpen: open }),
    setNowPlayingTab: (tab: 'PLAYER' | 'LYRICS' | 'QUEUE') => set({ nowPlayingTab: tab }),
  };
});

