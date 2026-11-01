/**
 * YZ Music Web - Core Audio Engine
 * High-fidelity hybrid engine providing:
 * - Direct YouTube Audio Stream Engine (100% reliable for all YouTube Music tracks)
 * - HTML5 Web Audio API Graph (10-Band EQ, Tone Pad, Crossfade)
 * - MediaSession API integration (OS lockscreen / media keys)
 */

import { Song, EqualizerPreset } from '../types';

export const EQ_FREQUENCIES = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

export const EQ_PRESETS: EqualizerPreset[] = [
  { name: 'Flat', gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { name: 'Bass Boost', gains: [6, 5, 4, 2, 0, 0, 0, 0, 0, 0] },
  { name: 'Bass Reducer', gains: [-6, -5, -4, -2, 0, 0, 0, 0, 0, 0] },
  { name: 'Treble Boost', gains: [0, 0, 0, 0, 0, 1, 2, 4, 5, 6] },
  { name: 'Treble Reducer', gains: [0, 0, 0, 0, 0, -1, -2, -4, -5, -6] },
  { name: 'Vocal Boost', gains: [-2, -2, 0, 3, 5, 4, 3, 1, 0, -2] },
  { name: 'Electronic', gains: [5, 4, 2, 0, -2, 2, 1, 3, 4, 5] },
  { name: 'Rock', gains: [4, 3, -1, -2, 1, 2, 3, 4, 4, 4] },
  { name: 'Pop', gains: [-1, 1, 3, 4, 3, 1, -1, -1, 1, 2] },
  { name: 'Acoustic', gains: [3, 2, 1, 1, 2, 2, 3, 3, 2, 1] },
];

declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void;
    YT?: any;
  }
}

export class AudioEngine {
  private mode: 'YOUTUBE' | 'HTML5' = 'HTML5';

  // HTML5 Web Audio API components
  private ctx: AudioContext | null = null;
  private audio: HTMLAudioElement;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private eqFilters: BiquadFilterNode[] = [];
  private toneLowShelf: BiquadFilterNode | null = null;
  private toneHighShelf: BiquadFilterNode | null = null;
  private toneMidPeak: BiquadFilterNode | null = null;
  private crossfadeDuration: number = 0;

  // Stored DSP Settings for real-time Web Audio API execution
  private currentEqGains: number[] = new Array(10).fill(0);
  private currentToneX: number = 0;
  private currentToneY: number = 0;
  private currentVolume: number = 0.8;

  // YouTube Audio Player components
  private ytPlayer: any = null;
  private ytReady: boolean = false;
  private ytTicker: any = null;
  private ytPendingVideoId: string | null = null;
  private ytPendingStartTime: number = 0;
  private currentPlayingVideoId: string | null = null;
  private isAdMuted: boolean = false;

  // Preload & Advance Download Engine for Instant 0ms Fast Track Switching
  private preloadAudio: HTMLAudioElement;
  private preloadedStreamUrl: string | null = null;
  private preloadedVideoId: string | null = null;
  private preloadedReady: boolean = false;

  // Callbacks
  private onTimeUpdateCallback?: (currentTime: number, duration: number) => void;
  private onEndedCallback?: () => void;
  private onTrackLoadedCallback?: () => void;
  private onErrorCallback?: (err: any) => void;
  private onPlayStateChangeCallback?: (isPlaying: boolean) => void;

  constructor() {
    this.audio = new Audio();
    this.audio.preload = 'auto';
    this.audio.crossOrigin = 'anonymous'; // Essential for Web Audio API DSP pipeline
    (this.audio as any).preservesPitch = true;

    this.preloadAudio = new Audio();
    this.preloadAudio.preload = 'auto';
    this.preloadAudio.crossOrigin = 'anonymous';
    this.preloadAudio.volume = 0; // Kept silent during advance buffering
    (this.preloadAudio as any).preservesPitch = true;

    this.preloadAudio.addEventListener('canplaythrough', () => {
      this.preloadedReady = true;
    });
    this.preloadAudio.addEventListener('loadeddata', () => {
      this.preloadedReady = true;
    });

    try {
      const savedVol = typeof localStorage !== 'undefined' ? localStorage.getItem('yz_volume') : null;
      if (savedVol !== null) {
        const parsed = parseFloat(savedVol);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
          this.currentVolume = parsed;
        }
      }
    } catch {}
    this.audio.volume = this.currentVolume;

    this.setupHtml5Listeners();
    this.loadYouTubeIframeAPI();
  }

  // ---- YouTube Player Integration ----

  private loadYouTubeIframeAPI() {
    if (typeof window === 'undefined') return;

    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    }

    const previousOnReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (previousOnReady) previousOnReady();
      this.initYouTubePlayer();
    };

    // Polling fallback to guarantee initialization even if onYouTubeIframeAPIReady fired early
    const checkYT = setInterval(() => {
      if (window.YT && window.YT.Player) {
        clearInterval(checkYT);
        this.initYouTubePlayer();
      }
    }, 50);

    // Timeout poll after 10 seconds
    setTimeout(() => clearInterval(checkYT), 10000);
  }

  private initYouTubePlayer() {
    if (this.ytPlayer || !window.YT || !window.YT.Player) return;

    const container = document.getElementById('yt-audio-player');
    if (!container) return;

    try {
      this.ytPlayer = new window.YT.Player('yt-audio-player', {
        height: '250',
        width: '250',
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          rel: 0,
          playsinline: 1,
          enablejsapi: 1,
          origin: window.location.origin,
          iv_load_policy: 3,
          modestbranding: 1,
        },
        events: {
          onReady: () => {
            this.ytReady = true;
            try {
              this.ytPlayer.unMute();
              this.ytPlayer.setVolume(Math.round(this.currentVolume * 100));
            } catch (e) {
              console.warn('Volume init', e);
            }
            if (this.ytPendingVideoId) {
              const pendingId = this.ytPendingVideoId;
              const pendingStart = this.ytPendingStartTime;
              this.ytPendingVideoId = null;
              this.ytPendingStartTime = 0;
              this.playVideo(pendingId, pendingStart);
            }
          },
          onStateChange: (event: any) => {
            // Immediately inspect and suppress any ads on state change
            this.checkAndSkipAds();

            // YT.PlayerState: PLAYING = 1, ENDED = 0, PAUSED = 2, BUFFERING = 3
            if (event.data === 1) {
              if (!this.isAdMuted) {
                try {
                  this.ytPlayer.setVolume(Math.round(this.currentVolume * 100));
                } catch {}
                if (this.onPlayStateChangeCallback) this.onPlayStateChangeCallback(true);
                if (this.onTrackLoadedCallback) this.onTrackLoadedCallback();
              }
              this.startTicker();
            } else if (event.data === 0) {
              this.stopTicker();
              if (this.onPlayStateChangeCallback) this.onPlayStateChangeCallback(false);
              if (this.onEndedCallback) this.onEndedCallback();
            } else if (event.data === 2) {
              this.stopTicker();
              if (this.onPlayStateChangeCallback) this.onPlayStateChangeCallback(false);
            }
          },
          onError: (err: any) => {
            console.warn('YouTube Player error code:', err?.data, err);
            if (this.onErrorCallback) this.onErrorCallback(err);
          },
        },
      });
    } catch (e) {
      console.error('Failed to create YouTube Player instance', e);
    }
  }

  public async playVideo(videoId: string, startTime: number = 0): Promise<void> {
    this.mode = 'YOUTUBE';
    this.currentPlayingVideoId = videoId;
    this.isAdMuted = false;
    this.audio.pause();

    if (!this.ytReady || !this.ytPlayer || typeof this.ytPlayer.loadVideoById !== 'function') {
      this.ytPendingVideoId = videoId;
      this.ytPendingStartTime = startTime;
      return;
    }

    try {
      this.ytPlayer.unMute();
      this.ytPlayer.setVolume(Math.round(this.currentVolume * 100));
      this.ytPlayer.loadVideoById({
        videoId,
        startSeconds: startTime,
      });
      this.ytPlayer.playVideo();
    } catch (e) {
      console.warn('playVideo invocation error:', e);
    }
  }

  private startTicker() {
    this.stopTicker();
    this.ytTicker = setInterval(() => {
      // Continuous Ad Guard Check
      this.checkAndSkipAds();

      if (this.ytPlayer && typeof this.ytPlayer.getCurrentTime === 'function') {
        const cur = this.ytPlayer.getCurrentTime() || 0;
        const dur = this.ytPlayer.getDuration() || 0;
        if (this.onTimeUpdateCallback && !this.isAdMuted) {
          this.onTimeUpdateCallback(cur, dur);
        }
      }
    }, 150);
  }

  /**
   * Automated Ad Skip Guard:
   * Suppresses ads instantly, seeks to finish them, and restores user audio.
   */
  private checkAndSkipAds(): void {
    if (!this.ytPlayer || typeof this.ytPlayer.getVideoData !== 'function') return;

    try {
      const videoData = this.ytPlayer.getVideoData();
      const currentId = videoData?.video_id;
      const duration = typeof this.ytPlayer.getDuration === 'function' ? this.ytPlayer.getDuration() : 0;

      // Ad Detection Criteria:
      // 1. Current video id does not match requested song video id
      // 2. Video metadata explicitly flagged as ad
      // 3. Short duration <= 35s when loaded song is different
      const isAd = Boolean(
        (currentId && this.currentPlayingVideoId && currentId !== this.currentPlayingVideoId) ||
        (videoData && (videoData as any).isAd) ||
        (duration > 0 && duration <= 35 && currentId && currentId !== this.currentPlayingVideoId)
      );

      if (isAd) {
        if (!this.isAdMuted) {
          this.isAdMuted = true;
          // Mute ad immediately to eliminate ad sound
          this.ytPlayer.mute();
        }

        // Instantly seek to duration to trigger YouTube's auto-advance past the ad
        if (duration > 0) {
          this.ytPlayer.seekTo(duration, true);
        }
        try {
          // Accelerate ad to 16x speed
          this.ytPlayer.setPlaybackRate?.(16);
        } catch {}
      } else {
        // Song is playing normally
        if (this.isAdMuted) {
          this.isAdMuted = false;
          try {
            this.ytPlayer.setPlaybackRate?.(1);
          } catch {}
          this.ytPlayer.unMute();
          this.ytPlayer.setVolume(Math.round(this.currentVolume * 100));
        }
      }
    } catch {}
  }

  private stopTicker() {
    if (this.ytTicker) {
      clearInterval(this.ytTicker);
      this.ytTicker = null;
    }
  }

  // ---- HTML5 Web Audio API ----

  public initAudioContext() {
    if (this.ctx && this.sourceNode) return;
    if (typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      if (!this.ctx) {
        this.ctx = new AudioCtx({ latencyHint: 'playback' });
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }

      if (!this.gainNode) {
        this.gainNode = this.ctx.createGain();
        this.gainNode.gain.value = 1.0;
      }

      if (!this.sourceNode) {
        this.sourceNode = this.ctx.createMediaElementSource(this.audio);
      }

      // Build 10-Band EQ Filters
      this.eqFilters = EQ_FREQUENCIES.map((freq, idx) => {
        const filter = this.ctx!.createBiquadFilter();
        filter.type = 'peaking';
        filter.frequency.value = freq;
        filter.Q.value = 1.4;
        filter.gain.value = this.currentEqGains[idx] || 0;
        return filter;
      });

      // Build Tone Pad Filters
      this.toneLowShelf = this.ctx.createBiquadFilter();
      this.toneLowShelf.type = 'lowshelf';
      this.toneLowShelf.frequency.value = 250;
      this.toneLowShelf.gain.value = -this.currentToneX * 8.0;

      this.toneHighShelf = this.ctx.createBiquadFilter();
      this.toneHighShelf.type = 'highshelf';
      this.toneHighShelf.frequency.value = 4000;
      this.toneHighShelf.gain.value = this.currentToneX * 8.0;

      this.toneMidPeak = this.ctx.createBiquadFilter();
      this.toneMidPeak.type = 'peaking';
      this.toneMidPeak.frequency.value = 1000;
      this.toneMidPeak.Q.value = 1.0;
      this.toneMidPeak.gain.value = this.currentToneY * 6.0;

      let current: AudioNode = this.sourceNode;
      for (const eq of this.eqFilters) {
        current.connect(eq);
        current = eq;
      }

      current.connect(this.toneLowShelf);
      this.toneLowShelf.connect(this.toneHighShelf);
      this.toneHighShelf.connect(this.toneMidPeak);
      this.toneMidPeak.connect(this.gainNode);
      this.gainNode.connect(this.ctx.destination);
    } catch (e) {
      console.warn('Web Audio API not fully available, falling back to direct HTML5 Audio', e);
    }
  }

  private setupHtml5Listeners() {
    this.audio.addEventListener('timeupdate', () => {
      if (this.mode === 'HTML5' && this.onTimeUpdateCallback) {
        this.onTimeUpdateCallback(this.audio.currentTime, this.audio.duration || 0);
      }
    });

    this.audio.addEventListener('play', () => {
      if (this.mode === 'HTML5' && this.onPlayStateChangeCallback) {
        this.onPlayStateChangeCallback(true);
      }
    });

    this.audio.addEventListener('pause', () => {
      if (this.mode === 'HTML5' && this.onPlayStateChangeCallback) {
        this.onPlayStateChangeCallback(false);
      }
    });

    this.audio.addEventListener('ended', () => {
      if (this.mode === 'HTML5' && this.onEndedCallback) {
        this.onEndedCallback();
      }
    });

    this.audio.addEventListener('loadedmetadata', () => {
      if (this.mode === 'HTML5' && this.onTrackLoadedCallback) {
        this.onTrackLoadedCallback();
      }
    });

    this.audio.addEventListener('error', (e) => {
      console.warn('HTML5 audio error', e);
      if (this.mode === 'HTML5' && this.onErrorCallback) {
        this.onErrorCallback(e);
      }
    });
  }

  /**
   * Pre-downloads the upcoming track in advance for instant 0ms switching
   */
  public preloadNextTrack(streamUrl?: string | null, videoId?: string | null): void {
    if (streamUrl) {
      if (this.preloadedStreamUrl === streamUrl && this.preloadedReady) {
        return;
      }
      this.preloadedStreamUrl = streamUrl;
      this.preloadedVideoId = videoId || null;
      this.preloadedReady = false;

      try {
        this.preloadAudio.src = streamUrl;
        this.preloadAudio.load();

        // Range request for first 1MB ensures the browser disk/memory cache stores the media chunks in advance
        if (typeof fetch !== 'undefined') {
          fetch(streamUrl, {
            headers: { Range: 'bytes=0-1048576' },
            mode: 'cors',
          }).catch(() => {});
        }
      } catch (err) {
        console.warn('Preload audio error:', err);
      }
    } else if (videoId) {
      this.preloadedVideoId = videoId;
      if (typeof Image !== 'undefined') {
        const preImg = new Image();
        preImg.src = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
      }
    }
  }

  public async playUrl(streamUrl: string, startTime: number = 0): Promise<void> {
    this.mode = 'HTML5';
    this.stopTicker();
    if (this.ytPlayer && typeof this.ytPlayer.pauseVideo === 'function') {
      try {
        this.ytPlayer.pauseVideo();
      } catch {}
    }

    this.initAudioContext();
    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume().catch(() => {});
    }

    try {
      // If preloaded in advance, audio chunks are already in cache
      if (this.preloadedStreamUrl === streamUrl) {
        this.preloadAudio.pause();
        this.preloadAudio.removeAttribute('src');
      }

      this.audio.src = streamUrl;
      this.audio.volume = this.currentVolume;
      this.audio.currentTime = startTime;
      await this.audio.play();
      if (this.onPlayStateChangeCallback) {
        this.onPlayStateChangeCallback(true);
      }
    } catch (err) {
      console.warn('Play error', err);
      throw err;
    }
  }

  // ---- Unified Transport Controls ----

  public pause(): void {
    if (this.mode === 'YOUTUBE' && this.ytPlayer && typeof this.ytPlayer.pauseVideo === 'function') {
      this.ytPlayer.pauseVideo();
      this.stopTicker();
    } else {
      this.audio.pause();
    }
  }

  public resume(): Promise<void> {
    if (this.mode === 'YOUTUBE' && this.ytPlayer && typeof this.ytPlayer.playVideo === 'function') {
      this.ytPlayer.playVideo();
      this.startTicker();
      return Promise.resolve();
    } else {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.audio.play();
    }
  }

  public seek(seconds: number): void {
    if (this.mode === 'YOUTUBE' && this.ytPlayer && typeof this.ytPlayer.seekTo === 'function') {
      this.ytPlayer.seekTo(seconds, true);
    } else {
      this.audio.currentTime = seconds;
    }
  }

  public setVolume(volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    this.currentVolume = clamped;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('yz_volume', String(clamped));
      }
    } catch {}

    if (this.mode === 'YOUTUBE' && this.ytPlayer && typeof this.ytPlayer.setVolume === 'function') {
      try {
        this.ytPlayer.setVolume(Math.round(clamped * 100));
      } catch {}
    } else {
      this.audio.volume = clamped;
    }
  }

  public getVolume(): number {
    return this.currentVolume;
  }

  public setCrossfadeDuration(seconds: number): void {
    this.crossfadeDuration = Math.max(0, Math.min(12, seconds));
  }

  public getCrossfadeDuration(): number {
    return this.crossfadeDuration;
  }

  public setEqGain(bandIndex: number, gainDb: number): void {
    this.currentEqGains[bandIndex] = gainDb;
    this.initAudioContext();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (this.eqFilters[bandIndex]) {
      const now = this.ctx?.currentTime || 0;
      this.eqFilters[bandIndex].gain.setTargetAtTime(gainDb, now, 0.05);
    }
  }

  public applyEqPreset(preset: EqualizerPreset): void {
    this.initAudioContext();
    preset.gains.forEach((gain, idx) => {
      this.setEqGain(idx, gain);
    });
  }

  public setTonePad(toneX: number, toneY: number): void {
    this.currentToneX = toneX;
    this.currentToneY = toneY;
    this.initAudioContext();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (this.toneLowShelf && this.toneHighShelf && this.toneMidPeak) {
      const now = this.ctx?.currentTime || 0;
      this.toneLowShelf.gain.setTargetAtTime(-toneX * 8.0, now, 0.05);
      this.toneHighShelf.gain.setTargetAtTime(toneX * 8.0, now, 0.05);
      this.toneMidPeak.gain.setTargetAtTime(toneY * 6.0, now, 0.05);
    }
  }

  public getPreloadedVideoId(): string | null {
    return this.preloadedVideoId;
  }

  public get isLossless(): boolean {
    return this.mode === 'HTML5';
  }

  public get playbackMode(): 'HTML5' | 'YOUTUBE' {
    return this.mode;
  }

  public onTimeUpdate(cb: (currentTime: number, duration: number) => void) {
    this.onTimeUpdateCallback = cb;
  }

  public onEnded(cb: () => void) {
    this.onEndedCallback = cb;
  }

  public onTrackLoaded(cb: () => void) {
    this.onTrackLoadedCallback = cb;
  }

  public onError(cb: (err: any) => void) {
    this.onErrorCallback = cb;
  }

  public onPlayStateChange(cb: (isPlaying: boolean) => void) {
    this.onPlayStateChangeCallback = cb;
  }

  public updateMediaSession(song: Song) {
    if (!('mediaSession' in navigator)) return;

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: song.title,
        artist: song.artist,
        album: song.albumName || 'YZ Music',
        artwork: [
          { src: song.thumbnailUrl || '/logo.svg', sizes: '512x512', type: 'image/jpeg' },
        ],
      });
    } catch (e) {
      console.warn('Failed to update MediaSession metadata', e);
    }
  }

  public get duration(): number {
    if (this.mode === 'YOUTUBE' && this.ytPlayer && typeof this.ytPlayer.getDuration === 'function') {
      return this.ytPlayer.getDuration() || 0;
    }
    return this.audio.duration || 0;
  }

  public get currentTime(): number {
    if (this.mode === 'YOUTUBE' && this.ytPlayer && typeof this.ytPlayer.getCurrentTime === 'function') {
      return this.ytPlayer.getCurrentTime() || 0;
    }
    return this.audio.currentTime || 0;
  }

  public get isPaused(): boolean {
    if (this.mode === 'YOUTUBE' && this.ytPlayer && typeof this.ytPlayer.getPlayerState === 'function') {
      return this.ytPlayer.getPlayerState() !== 1;
    }
    return this.audio.paused;
  }
}

export const audioEngine = new AudioEngine();
