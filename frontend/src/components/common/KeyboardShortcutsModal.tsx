import React from 'react';
import { X, Keyboard, Play, RotateCw, RotateCcw, Volume2, SkipForward, SkipBack, Maximize2 } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const shortcutGroups = [
    {
      category: 'Playback Controls',
      shortcuts: [
        { key: 'Space / K', desc: 'Play / Pause toggle', icon: Play },
        { key: '← / J', desc: 'Rewind 10 seconds', icon: RotateCcw },
        { key: '→ / L', desc: 'Fast-forward 10 seconds', icon: RotateCw },
        { key: 'N', desc: 'Next track', icon: SkipForward },
        { key: 'P', desc: 'Previous track', icon: SkipBack },
      ],
    },
    {
      category: 'Audio & Volume',
      shortcuts: [
        { key: '↑', desc: 'Increase volume 5%', icon: Volume2 },
        { key: '↓', desc: 'Decrease volume 5%', icon: Volume2 },
        { key: 'M', desc: 'Mute / Unmute audio', icon: Volume2 },
      ],
    },
    {
      category: 'Navigation & View',
      shortcuts: [
        { key: 'F', desc: 'Toggle full-screen player', icon: Maximize2 },
        { key: 'Esc', desc: 'Close open dialogs or player', icon: X },
        { key: '?', desc: 'Show keyboard shortcuts', icon: Keyboard },
      ],
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-3xl liquid-glass-surface border border-white/20 shadow-2xl p-6 sm:p-7 relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl liquid-glass-circle flex items-center justify-center border border-white/20 shadow-sm">
              <Keyboard className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                Keyboard Shortcuts
              </h2>
              <p className="text-xs text-white/60">
                Desktop hotkeys for lightning-fast media control
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Shortcuts Categories */}
        <div className="mt-5 space-y-5 max-h-[60vh] overflow-y-auto pr-1 scrollbar-none">
          {shortcutGroups.map((group) => (
            <div key={group.category}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-2.5">
                {group.category}
              </h3>
              <div className="space-y-1.5">
                {group.shortcuts.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-white/5 transition-colors border border-white/5"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <item.icon className="w-4 h-4 text-white/60 shrink-0" />
                      <span className="text-sm text-white/90 font-medium truncate">
                        {item.desc}
                      </span>
                    </div>

                    <kbd className="px-2.5 py-1 text-xs font-mono font-semibold text-white/90 bg-white/10 border border-white/20 rounded-lg shadow-sm shrink-0">
                      {item.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer tip */}
        <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-white/50">
          <span>Press <kbd className="px-1.5 py-0.5 font-mono bg-white/10 rounded">?</kbd> anytime to open this guide</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-full bg-white/15 hover:bg-white/25 text-white font-medium text-xs transition-all cursor-pointer"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};

