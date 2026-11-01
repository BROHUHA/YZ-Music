import { useEffect, useRef } from 'react';
import { usePlayerStore } from '../stores/playerStore';

interface UseKeyboardShortcutsOptions {
  onToggleShortcutsModal?: () => void;
  onCloseModals?: () => void;
}

export function useKeyboardShortcuts(options?: UseKeyboardShortcutsOptions) {
  const {
    currentSong,
    togglePlay,
    currentTime,
    duration,
    seek,
    volume,
    setVolume,
    next,
    prev,
    isNowPlayingOpen,
    setNowPlayingOpen,
  } = usePlayerStore();

  const lastNonZeroVolumeRef = useRef<number>(volume > 0 ? volume : 0.8);

  useEffect(() => {
    if (volume > 0) {
      lastNonZeroVolumeRef.current = volume;
    }
  }, [volume]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;

      // Ignore when user is actively typing in form inputs or contenteditable elements
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        if (e.key === 'Escape') {
          target.blur();
        }
        return;
      }

      // Check for '?' key to toggle shortcuts cheatsheet
      if (e.key === '?' || (e.shiftKey && e.code === 'Slash')) {
        e.preventDefault();
        options?.onToggleShortcutsModal?.();
        return;
      }

      // Escape key closes NowPlayingScreen or modals
      if (e.key === 'Escape') {
        if (isNowPlayingOpen) {
          e.preventDefault();
          setNowPlayingOpen(false);
          return;
        }
        options?.onCloseModals?.();
        return;
      }

      // Spacebar or 'k' -> Play / Pause
      if (e.code === 'Space' || e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        if (currentSong) {
          togglePlay();
        }
        return;
      }

      // Left Arrow or 'j' -> Seek backward 10s
      if (e.key === 'ArrowLeft' || e.key === 'j' || e.key === 'J') {
        if (e.shiftKey) {
          e.preventDefault();
          prev();
          return;
        }

        e.preventDefault();
        if (currentSong && duration > 0) {
          seek(Math.max(0, currentTime - 10));
        }
        return;
      }

      // Right Arrow or 'l' -> Seek forward 10s
      if (e.key === 'ArrowRight' || e.key === 'l' || e.key === 'L') {
        if (e.shiftKey) {
          e.preventDefault();
          next();
          return;
        }

        e.preventDefault();
        if (currentSong && duration > 0) {
          seek(Math.min(duration, currentTime + 10));
        }
        return;
      }

      // Up Arrow -> Volume +5%
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setVolume(Math.min(1, Math.round((volume + 0.05) * 100) / 100));
        return;
      }

      // Down Arrow -> Volume -5%
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setVolume(Math.max(0, Math.round((volume - 0.05) * 100) / 100));
        return;
      }

      // 'm' or 'M' -> Toggle Mute
      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        if (volume > 0) {
          lastNonZeroVolumeRef.current = volume;
          setVolume(0);
        } else {
          setVolume(lastNonZeroVolumeRef.current || 0.8);
        }
        return;
      }

      // 'n' or 'N' -> Next Song
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        next();
        return;
      }

      // 'p' or 'P' -> Previous Song
      if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        prev();
        return;
      }

      // 'f' or 'F' -> Toggle Fullscreen / Expanded Now Playing
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        setNowPlayingOpen(!isNowPlayingOpen);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    currentSong,
    togglePlay,
    currentTime,
    duration,
    seek,
    volume,
    setVolume,
    next,
    prev,
    isNowPlayingOpen,
    setNowPlayingOpen,
    options,
  ]);
}
