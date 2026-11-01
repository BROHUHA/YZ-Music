import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, SkipForward, Heart, Music2 } from 'lucide-react';
import { usePlayerStore } from '../../stores/playerStore';
import { Song } from '../../types';

interface MiniPlayerProps {
  isInline?: boolean;
  className?: string;
}

function getInitialThumb(song: Song | null): string {
  if (!song) return '/logo.svg';
  if (song.thumbnailUrl && song.thumbnailUrl !== '/logo.svg') {
    if (song.thumbnailUrl.includes('maxresdefault.jpg')) {
      return song.thumbnailUrl.replace('maxresdefault.jpg', 'hqdefault.jpg');
    }
    return song.thumbnailUrl;
  }
  if (song.videoId) {
    return `https://i.ytimg.com/vi/${song.videoId}/hqdefault.jpg`;
  }
  return '/logo.svg';
}

export const MiniPlayer: React.FC<MiniPlayerProps> = ({ isInline = false, className = '' }) => {
  const {
    currentSong,
    isPlaying,
    currentTime,
    duration,
    togglePlay,
    next,
    prev,
    likeStatuses,
    toggleLike,
    setNowPlayingOpen,
    currentPalette,
  } = usePlayerStore();

  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const [offsetX, setOffsetX] = useState(0);
  const [thumbSrc, setThumbSrc] = useState<string>(() => getInitialThumb(currentSong));
  const [isImgBroken, setIsImgBroken] = useState(false);

  useEffect(() => {
    setIsImgBroken(false);
    setThumbSrc(getInitialThumb(currentSong));
  }, [currentSong?.videoId, currentSong?.thumbnailUrl]);

  if (!currentSong) return null;

  const isLiked = likeStatuses[currentSong.videoId] === 'LIKE';
  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;
  const accentColor = currentPalette?.dominant || '#FA2D48';

  const handleThumbnailError = () => {
    if (!currentSong) {
      setIsImgBroken(true);
      return;
    }
    if (thumbSrc.includes('maxresdefault.jpg') || thumbSrc.includes('hq720.jpg')) {
      setThumbSrc(`https://i.ytimg.com/vi/${currentSong.videoId}/hqdefault.jpg`);
      return;
    }
    if (currentSong.videoId && !thumbSrc.includes(`vi/${currentSong.videoId}/hqdefault.jpg`)) {
      setThumbSrc(`https://i.ytimg.com/vi/${currentSong.videoId}/hqdefault.jpg`);
      return;
    }
    if (currentSong.videoId && !thumbSrc.includes(`vi/${currentSong.videoId}/mqdefault.jpg`)) {
      setThumbSrc(`https://i.ytimg.com/vi/${currentSong.videoId}/mqdefault.jpg`);
      return;
    }
    if (currentSong.thumbnailUrl && !thumbSrc.startsWith('/api/avatar')) {
      setThumbSrc(`/api/avatar?url=${encodeURIComponent(currentSong.thumbnailUrl)}`);
      return;
    }
    setIsImgBroken(true);
    setThumbSrc('/logo.svg');
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isInline) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isInline || touchStartX.current === null) return;
    const diffX = e.touches[0].clientX - touchStartX.current;
    setOffsetX(Math.max(-50, Math.min(50, diffX * 0.45)));
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (isInline || touchStartX.current === null) return;
    const diffX = e.changedTouches[0].clientX - touchStartX.current;
    const diffY = e.changedTouches[0].clientY - (touchStartY.current || 0);

    if (Math.abs(diffX) > 38 && Math.abs(diffX) > Math.abs(diffY)) {
      if (diffX < 0) {
        next();
      } else {
        prev();
      }
    }
    touchStartX.current = null;
    touchStartY.current = null;
    setOffsetX(0);
  };

  // Compact Inline Mode (single 56px row accessory between Tab circle and Search circle)
  if (isInline) {
    return (
      <div
        onClick={() => setNowPlayingOpen(true)}
        className={`h-14 rounded-full liquid-glass-surface px-2.5 flex items-center gap-2.5 min-w-0 cursor-pointer active:scale-[0.98] transition-transform overflow-hidden shadow-2xl relative group ${className}`}
      >
        {/* Real-time bottom progress bar */}
        <div className="absolute bottom-1.5 left-5 right-5 h-[2px] bg-white/15 overflow-hidden rounded-full pointer-events-none">
          <div
            className="h-full transition-all duration-300 ease-linear rounded-full"
            style={{
              width: `${progressPercent}%`,
              background: `linear-gradient(to right, ${accentColor}, #FA2D48)`,
            }}
          />
        </div>

        {/* 34px Album Artwork */}
        <div className="w-[34px] h-[34px] rounded-xl overflow-hidden shrink-0 bg-white/10 border border-white/20 shadow-sm flex items-center justify-center">
          {!isImgBroken ? (
            <img
              src={thumbSrc}
              alt={currentSong.title}
              referrerPolicy="no-referrer"
              onError={handleThumbnailError}
              className="w-full h-full object-cover"
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center text-white/70"
              style={{ backgroundColor: `${accentColor}33` }}
            >
              <Music2 className="w-4 h-4 text-accent-red" />
            </div>
          )}
        </div>

        {/* Compact Title & Live Equalizer Waveform */}
        <div className="flex-1 min-w-0 flex items-center gap-1.5 overflow-hidden">
          <span className="text-[12.5px] font-bold text-white truncate leading-tight drop-shadow-sm group-hover:text-accent-red transition-colors">
            {currentSong.title}
          </span>
          {isPlaying && (
            <div className="flex items-end gap-[1.5px] h-3 shrink-0 pb-0.5">
              <div
                className="w-[2px] rounded-full playing-eq-bar-1"
                style={{ backgroundColor: accentColor }}
              />
              <div
                className="w-[2px] rounded-full playing-eq-bar-2"
                style={{ backgroundColor: accentColor }}
              />
            </div>
          )}
        </div>

        {/* Compact Tactile Play / Pause Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            togglePlay();
          }}
          className="w-9 h-9 rounded-full liquid-glass-circle flex items-center justify-center text-white border border-white/30 shadow-md active:scale-90 hover:scale-105 transition-all shrink-0 cursor-pointer ml-auto"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause className="w-3.5 h-3.5 fill-white" />
          ) : (
            <Play className="w-3.5 h-3.5 fill-white ml-0.5" />
          )}
        </button>
      </div>
    );
  }

  // Expanded Mode (64px full-width card above the navigation tabs)
  return (
    <div
      onClick={() => setNowPlayingOpen(true)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        transform: `translateX(${offsetX}px)`,
        transition: offsetX === 0 ? 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none',
        boxShadow: `0 14px 40px -4px rgba(0,0,0,0.85), 0 0 24px ${accentColor}25`,
      }}
      className={`relative w-full h-[64px] rounded-full liquid-glass-surface px-3 sm:px-3.5 flex items-center justify-between cursor-pointer group active:scale-[0.99] transition-transform overflow-hidden shadow-2xl ${className}`}
    >
      {/* Real-time bottom progress bar */}
      <div className="absolute bottom-1.5 left-6 right-6 h-[2px] bg-white/15 overflow-hidden rounded-full pointer-events-none">
        <div
          className="h-full transition-all duration-300 ease-linear rounded-full"
          style={{
            width: `${progressPercent}%`,
            background: `linear-gradient(to right, ${accentColor}, #FA2D48)`,
          }}
        />
      </div>

      {/* Ambient Palette Glow */}
      <div
        className="absolute inset-0 pointer-events-none opacity-25 transition-opacity duration-700"
        style={{
          background: `radial-gradient(ellipse 90% 70% at 30% 50%, ${accentColor} 0%, transparent 75%)`,
        }}
      />

      {/* Left Section: 44px Artwork Squircle + Title & Artist + EQ Waveform */}
      <div className="flex items-center min-w-0 flex-1 mr-2 relative z-10">
        <div className="relative w-11 h-11 rounded-2xl overflow-hidden shrink-0 shadow-md bg-white/10 border border-white/25 group-hover:scale-105 transition-transform duration-300 flex items-center justify-center">
          {!isImgBroken ? (
            <img
              src={thumbSrc}
              alt={currentSong.title}
              referrerPolicy="no-referrer"
              onError={handleThumbnailError}
              className="w-full h-full object-cover"
              loading="eager"
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center text-white/70"
              style={{ backgroundColor: `${accentColor}33` }}
            >
              <Music2 className="w-5 h-5 text-accent-red" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 ml-3 overflow-hidden">
          <div className="flex items-center gap-1.5">
            <h4 className="text-[13.5px] sm:text-sm font-bold text-white truncate leading-tight tracking-tight drop-shadow-sm group-hover:text-accent-red transition-colors">
              {currentSong.title}
            </h4>

            {/* Live Equalizer Waveform Animation */}
            <div
              className="flex items-end justify-center gap-[2.5px] h-4 shrink-0 ml-1.5 pb-0.5"
              title={isPlaying ? 'Playing' : 'Paused'}
            >
              <div
                className={`w-[2.5px] rounded-full transition-all duration-300 ${
                  isPlaying ? 'playing-eq-bar-1' : 'h-1.5 opacity-50'
                }`}
                style={{ backgroundColor: accentColor }}
              />
              <div
                className={`w-[2.5px] rounded-full transition-all duration-300 ${
                  isPlaying ? 'playing-eq-bar-2' : 'h-3 opacity-50'
                }`}
                style={{ backgroundColor: accentColor }}
              />
              <div
                className={`w-[2.5px] rounded-full transition-all duration-300 ${
                  isPlaying ? 'playing-eq-bar-3' : 'h-2 opacity-50'
                }`}
                style={{ backgroundColor: accentColor }}
              />
            </div>
          </div>

          <p className="text-[11.5px] text-white/65 truncate leading-tight mt-0.5 tracking-tight font-medium">
            {currentSong.artist}
          </p>
        </div>
      </div>

      {/* Right Controls: Like, Play/Pause, Next */}
      <div
        className="flex items-center gap-1 sm:gap-1.5 shrink-0 relative z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => toggleLike(currentSong.videoId)}
          className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-80 hover:bg-white/10 ${
            isLiked ? 'text-accent-red fill-accent-red animate-like' : 'text-white/60 hover:text-white'
          }`}
          aria-label={isLiked ? 'Unlike' : 'Like'}
        >
          <Heart className={`w-[18px] h-[18px] ${isLiked ? 'fill-accent-red text-accent-red' : ''}`} />
        </button>

        <button
          onClick={togglePlay}
          className="w-10 h-10 rounded-full liquid-glass-circle flex items-center justify-center text-white border border-white/30 shadow-md active:scale-90 hover:scale-105 transition-all cursor-pointer ml-0.5"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause className="w-4 h-4 fill-white" />
          ) : (
            <Play className="w-4 h-4 fill-white ml-0.5" />
          )}
        </button>

        <button
          onClick={next}
          className="w-9 h-9 rounded-full hover:bg-white/10 active:scale-85 flex items-center justify-center text-white/80 hover:text-white transition-all cursor-pointer"
          aria-label="Next track"
        >
          <SkipForward className="w-[18px] h-[18px] fill-current" />
        </button>
      </div>
    </div>
  );
};
