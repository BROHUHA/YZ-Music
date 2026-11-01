/**
 * YZ Music Web - User Settings Store (Zustand with localStorage persistence)
 * Faithful to AppSettings.kt
 */

import { create } from 'zustand';
import { audioEngine, EQ_PRESETS } from '../audio/audioEngine';

interface SettingsState {
  themeMode: 'SYSTEM' | 'LIGHT' | 'DARK';
  accentColor: string;
  crossfadeSeconds: number;
  liquidGlass: boolean;
  syncedLyrics: boolean;
  audioQuality: 'LOSSLESS' | 'HIGH' | 'LOW';
  moduleIndexUrl: string;
  equalizerEnabled: boolean;
  toneX: number;
  toneY: number;
  eqGains: number[];
  selectedPreset: string;

  setThemeMode: (mode: 'SYSTEM' | 'LIGHT' | 'DARK') => void;
  setAccentColor: (color: string) => void;
  setCrossfadeSeconds: (secs: number) => void;
  setLiquidGlass: (enabled: boolean) => void;
  setSyncedLyrics: (enabled: boolean) => void;
  setAudioQuality: (quality: 'LOSSLESS' | 'HIGH' | 'LOW') => void;
  setModuleIndexUrl: (url: string) => void;
  setTonePad: (x: number, y: number) => void;
  setEqGain: (index: number, val: number) => void;
  setPreset: (presetName: string) => void;
}

export const useSettingsStore = create<SettingsState>((set) => {
  const savedAccent = localStorage.getItem('yz_accent_color') || '#FA2D48';
  const savedCrossfade = parseInt(localStorage.getItem('yz_crossfade') || '0', 10);
  const savedModuleIndex = localStorage.getItem('yz_module_index_url') || 'https://yz-music-sources.vercel.app/index.json';
  
  // Default to LOSSLESS audio
  const savedQuality = (localStorage.getItem('yz_quality') as any) || 'LOSSLESS';

  // Load Equalizer & Tone Pad DSP state
  const savedGainsRaw = localStorage.getItem('yz_eq_gains');
  const savedGains: number[] = savedGainsRaw ? JSON.parse(savedGainsRaw) : new Array(10).fill(0);
  const savedPreset = localStorage.getItem('yz_eq_preset') || 'Flat';
  const savedToneX = parseFloat(localStorage.getItem('yz_tone_x') || '0');
  const savedToneY = parseFloat(localStorage.getItem('yz_tone_y') || '0');

  // Apply default crossfade & initial DSP settings to engine
  audioEngine.setCrossfadeDuration(savedCrossfade);
  savedGains.forEach((g, idx) => audioEngine.setEqGain(idx, g));
  audioEngine.setTonePad(savedToneX, savedToneY);

  return {
    themeMode: (localStorage.getItem('yz_theme') as any) || 'DARK',
    accentColor: savedAccent,
    crossfadeSeconds: savedCrossfade,
    liquidGlass: localStorage.getItem('yz_liquid_glass') !== 'false',
    syncedLyrics: localStorage.getItem('yz_synced_lyrics') !== 'false',
    audioQuality: savedQuality,
    moduleIndexUrl: savedModuleIndex,
    equalizerEnabled: true,
    toneX: savedToneX,
    toneY: savedToneY,
    eqGains: savedGains,
    selectedPreset: savedPreset,

    setThemeMode: (mode) => {
      localStorage.setItem('yz_theme', mode);
      set({ themeMode: mode });
      if (mode === 'DARK' || (mode === 'SYSTEM' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    },

    setAccentColor: (color) => {
      localStorage.setItem('yz_accent_color', color);
      document.documentElement.style.setProperty('--accent-color', color);
      set({ accentColor: color });
    },

    setCrossfadeSeconds: (secs) => {
      localStorage.setItem('yz_crossfade', secs.toString());
      audioEngine.setCrossfadeDuration(secs);
      set({ crossfadeSeconds: secs });
    },

    setLiquidGlass: (enabled) => {
      localStorage.setItem('yz_liquid_glass', enabled ? 'true' : 'false');
      set({ liquidGlass: enabled });
    },

    setSyncedLyrics: (enabled) => {
      localStorage.setItem('yz_synced_lyrics', enabled ? 'true' : 'false');
      set({ syncedLyrics: enabled });
    },

    setAudioQuality: (quality) => {
      localStorage.setItem('yz_quality', quality);
      set({ audioQuality: quality });
    },

    setModuleIndexUrl: (url) => {
      localStorage.setItem('yz_module_index_url', url);
      set({ moduleIndexUrl: url });
    },

    setTonePad: (x, y) => {
      localStorage.setItem('yz_tone_x', x.toString());
      localStorage.setItem('yz_tone_y', y.toString());
      audioEngine.setTonePad(x, y);
      set({ toneX: x, toneY: y });
    },

    setEqGain: (index, val) => {
      set((state) => {
        const next = [...state.eqGains];
        next[index] = val;
        localStorage.setItem('yz_eq_gains', JSON.stringify(next));
        audioEngine.setEqGain(index, val);
        return { eqGains: next, selectedPreset: 'Custom' };
      });
    },

    setPreset: (presetName) => {
      const p = EQ_PRESETS.find((pr) => pr.name === presetName);
      if (p) {
        localStorage.setItem('yz_eq_preset', presetName);
        localStorage.setItem('yz_eq_gains', JSON.stringify(p.gains));
        audioEngine.applyEqPreset(p);
        set({ selectedPreset: presetName, eqGains: [...p.gains] });
      }
    },
  };
});

