import React, { useState } from 'react';
import { X, Sliders } from 'lucide-react';
import { EQ_FREQUENCIES, EQ_PRESETS } from '../../audio/audioEngine';
import { useSettingsStore } from '../../stores/settingsStore';

interface EqualizerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EqualizerModal: React.FC<EqualizerModalProps> = ({ isOpen, onClose }) => {
  const [tab, setTab] = useState<'TONE' | 'GRAPHIC'>('TONE');
  const {
    toneX,
    toneY,
    setTonePad,
    eqGains,
    setEqGain,
    selectedPreset,
    setPreset,
  } = useSettingsStore();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl">
      <div className="w-full max-w-lg liquid-glass rounded-3xl p-6 shadow-2xl flex flex-col gap-6 backdrop-blur-3xl border border-white/15">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-accent-red" />
            <h3 className="text-lg font-bold text-white">Equalizer & Audio DSP</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 text-white/60">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch: Tone Pad vs Graphic EQ */}
        <div className="flex bg-white/5 p-1 rounded-xl">
          <button
            onClick={() => setTab('TONE')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              tab === 'TONE' ? 'bg-white/20 text-white' : 'text-white/50'
            }`}
          >
            Dynamic Tone Pad
          </button>
          <button
            onClick={() => setTab('GRAPHIC')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              tab === 'GRAPHIC' ? 'bg-white/20 text-white' : 'text-white/50'
            }`}
          >
            Graphic 10-Band EQ
          </button>
        </div>

        {/* Tone Pad View */}
        {tab === 'TONE' && (
          <div className="flex flex-col items-center gap-4">
            <div
              className="relative w-64 h-64 bg-white/5 border border-white/10 rounded-2xl cursor-crosshair overflow-hidden touch-none"
              onPointerMove={(e) => {
                if (e.buttons === 1) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
                  const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
                  setTonePad(
                    Math.max(-1, Math.min(1, x)),
                    Math.max(-1, Math.min(1, y))
                  );
                }
              }}
            >
              {/* Grid guide */}
              <div className="absolute inset-x-0 top-1/2 h-[1px] bg-white/10" />
              <div className="absolute inset-y-0 left-1/2 w-[1px] bg-white/10" />

              {/* Puck */}
              <div
                className="absolute w-6 h-6 rounded-full bg-accent-red shadow-lg shadow-accent-red/50 border-2 border-white -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-transform"
                style={{
                  left: `${((toneX + 1) / 2) * 100}%`,
                  top: `${((-toneY + 1) / 2) * 100}%`,
                }}
              />
            </div>
            <div className="flex justify-between w-64 text-[10px] text-white/40 uppercase tracking-widest font-mono">
              <span>Warmer / Bass</span>
              <span>Brighter / Treble</span>
            </div>
          </div>
        )}

        {/* Graphic EQ View */}
        {tab === 'GRAPHIC' && (
          <div className="flex flex-col gap-4">
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
              {EQ_PRESETS.map((p) => {
                const isActive = selectedPreset === p.name;
                return (
                  <button
                    key={p.name}
                    onClick={() => setPreset(p.name)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 active:scale-95 cursor-pointer ${
                      isActive
                        ? 'bg-accent-red text-white shadow-md shadow-accent-red/30'
                        : 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10'
                    }`}
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between h-44 px-2">
              {EQ_FREQUENCIES.map((freq, idx) => (
                <div key={freq} className="flex flex-col items-center h-full justify-between">
                  <span className="text-[10px] text-white/40 font-mono">{eqGains[idx] || 0}dB</span>
                  <input
                    type="range"
                    min={-12}
                    max={12}
                    step={1}
                    value={eqGains[idx] || 0}
                    onChange={(e) => setEqGain(idx, parseFloat(e.target.value))}
                    className="h-28 -rotate-90 appearance-none bg-white/20 accent-accent-red rounded cursor-pointer w-24"
                  />
                  <span className="text-[10px] text-white/60 font-mono mt-2">
                    {freq >= 1000 ? `${freq / 1000}k` : freq}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

