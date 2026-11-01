import React from 'react';
import { X, User, ChevronRight, Keyboard } from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore';
import { useAuthStore } from '../../stores/authStore';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAccount?: () => void;
  onOpenShortcuts?: () => void;
}

const ACCENT_PRESETS = [
  { name: 'Apple Red', color: '#FA2D48' },
  { name: 'Electric Blue', color: '#3B82F6' },
  { name: 'Emerald', color: '#10B981' },
  { name: 'Vibrant Purple', color: '#8B5CF6' },
  { name: 'Amber Glow', color: '#F59E0B' },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onOpenAccount,
  onOpenShortcuts,
}) => {
  const { isSignedIn, account } = useAuthStore();
  const {
    themeMode,
    setThemeMode,
    accentColor,
    setAccentColor,
    crossfadeSeconds,
    setCrossfadeSeconds,
    liquidGlass,
    setLiquidGlass,
    syncedLyrics,
    setSyncedLyrics,
    audioQuality,
    setAudioQuality,
    moduleIndexUrl,
    setModuleIndexUrl,
  } = useSettingsStore();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl">
      <div className="w-full max-w-lg liquid-glass rounded-3xl p-6 shadow-2xl flex flex-col gap-6 max-h-[85vh] overflow-y-auto scrollbar-none backdrop-blur-3xl border border-white/15">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <h3 className="text-xl font-bold text-white">Settings</h3>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 text-white/60">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Account & Integrations Card (faithful to SettingsSheet.kt AccountCard) */}
        <section className="flex flex-col gap-2">
          <h4 className="text-xs font-bold text-white/40 uppercase tracking-wider">Account & Integrations</h4>
          <button
            onClick={() => {
              onClose();
              onOpenAccount?.();
            }}
            className="flex items-center justify-between p-3.5 rounded-2xl liquid-glass border border-white/10 hover:border-white/25 transition-all text-left group cursor-pointer"
          >
            <div className="flex items-center gap-3.5">
              {isSignedIn && account?.thumbnailUrl ? (
                <img
                  src={account.thumbnailUrl}
                  alt={account.name}
                  className="w-11 h-11 rounded-full object-cover border border-white/20 shrink-0"
                />
              ) : (
                <div className="w-11 h-11 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-white/60 shrink-0">
                  <User className="w-5 h-5" />
                </div>
              )}
              <div>
                <p className="text-sm font-bold text-white group-hover:text-accent-red transition-colors">
                  {isSignedIn && account ? account.name : 'Not signed in'}
                </p>
                <p className="text-xs text-white/50">
                  {isSignedIn && account ? account.email || 'YouTube Music Account' : 'Tap to sign in with YouTube Music'}
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-white/40 group-hover:text-white transition-colors" />
          </button>
        </section>

        {/* Appearance Section */}
        <section className="flex flex-col gap-3">
          <h4 className="text-xs font-bold text-white/40 uppercase tracking-wider">Appearance</h4>
          
          <div className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.03]">
            <span className="text-sm font-medium text-white">Theme Mode</span>
            <div className="flex gap-1 bg-white/10 p-1 rounded-xl">
              <button
                onClick={() => setThemeMode('DARK')}
                className={`px-3 py-1 rounded-lg text-xs font-medium ${
                  themeMode === 'DARK' ? 'bg-white/20 text-white' : 'text-white/50'
                }`}
              >
                Dark
              </button>
              <button
                onClick={() => setThemeMode('LIGHT')}
                className={`px-3 py-1 rounded-lg text-xs font-medium ${
                  themeMode === 'LIGHT' ? 'bg-white/20 text-white' : 'text-white/50'
                }`}
              >
                Light
              </button>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-white/[0.03] flex flex-col gap-2">
            <span className="text-sm font-medium text-white">Accent Color</span>
            <div className="flex gap-3 pt-1">
              {ACCENT_PRESETS.map((p) => (
                <button
                  key={p.color}
                  onClick={() => setAccentColor(p.color)}
                  className={`w-7 h-7 rounded-full transition-transform ${
                    accentColor === p.color ? 'scale-125 ring-2 ring-white' : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: p.color }}
                  title={p.name}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.03]">
            <div>
              <p className="text-sm font-medium text-white">Frosted Liquid Glass</p>
              <p className="text-xs text-white/40">Smooth acrylic blurs and reflections</p>
            </div>
            <input
              type="checkbox"
              checked={liquidGlass}
              onChange={(e) => setLiquidGlass(e.target.checked)}
              className="w-5 h-5 accent-accent-red cursor-pointer"
            />
          </div>
        </section>

        {/* Playback & Audio Section */}
        <section className="flex flex-col gap-3">
          <h4 className="text-xs font-bold text-white/40 uppercase tracking-wider">Playback & Audio</h4>

          <div className="p-3 rounded-2xl bg-white/[0.03] flex flex-col gap-2">
            <div className="flex justify-between text-sm font-medium text-white">
              <span>Gapless Crossfade</span>
              <span className="font-mono text-accent-red">{crossfadeSeconds}s</span>
            </div>
            <input
              type="range"
              min={0}
              max={12}
              value={crossfadeSeconds}
              onChange={(e) => setCrossfadeSeconds(parseInt(e.target.value, 10))}
              className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-accent-red"
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.03]">
            <div>
              <p className="text-sm font-medium text-white">Synchronized Karaoke Lyrics</p>
              <p className="text-xs text-white/40">Real-time word and line synchronization</p>
            </div>
            <input
              type="checkbox"
              checked={syncedLyrics}
              onChange={(e) => setSyncedLyrics(e.target.checked)}
              className="w-5 h-5 accent-accent-red cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.03]">
            <div>
              <p className="text-sm font-medium text-white">Streaming Audio Quality</p>
              <p className="text-xs text-white/40">Prioritize lossless FLAC when available</p>
            </div>
            <select
              value={audioQuality}
              onChange={(e) => setAudioQuality(e.target.value as any)}
              className="bg-white/10 border border-white/10 text-white rounded-xl px-3 py-1 text-xs outline-none"
            >
              <option value="LOSSLESS" className="bg-[#1C1C1E]">Lossless (FLAC)</option>
              <option value="HIGH" className="bg-[#1C1C1E]">High (256k AAC/Opus)</option>
              <option value="LOW" className="bg-[#1C1C1E]">Standard (128k)</option>
            </select>
          </div>
        </section>

        {/* Desktop Controls & Shortcuts */}
        {onOpenShortcuts && (
          <section className="flex flex-col gap-2">
            <h4 className="text-xs font-bold text-white/40 uppercase tracking-wider">Keyboard & Desktop Controls</h4>
            <button
              onClick={() => {
                onClose();
                onOpenShortcuts();
              }}
              className="flex items-center justify-between p-3.5 rounded-2xl liquid-glass border border-white/10 hover:border-white/25 transition-all text-left group cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-2xl liquid-glass-circle flex items-center justify-center text-white/80 border border-white/15 shrink-0 group-hover:scale-105 transition-transform">
                  <Keyboard className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white group-hover:text-accent-red transition-colors">
                    Keyboard Shortcuts
                  </p>
                  <p className="text-xs text-white/50">
                    Spacebar (play/pause), arrow keys (seek 10s, volume) & hotkeys
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-white/30 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
            </button>
          </section>
        )}

        {/* Sourcing & Modules Section */}
        <section className="flex flex-col gap-3">
          <h4 className="text-xs font-bold text-white/40 uppercase tracking-wider">Custom Sourcing Modules</h4>

          <div className="p-3 rounded-2xl bg-white/[0.03] flex flex-col gap-2">
            <label className="text-xs text-white/60">Module Index URL (Qobuz & TIDAL Index)</label>
            <input
              type="text"
              value={moduleIndexUrl}
              onChange={(e) => setModuleIndexUrl(e.target.value)}
              placeholder="https://..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-accent-red"
            />
          </div>
        </section>
      </div>
    </div>
  );
};

