import React, { useState, useEffect } from 'react';
import { X, Users, Copy, Check, LogIn, Plus, LogOut, Radio } from 'lucide-react';
import { listenTogetherService } from '../../services/listenTogether';
import { BitChordPartyState } from '../../types';

interface ListenTogetherModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ListenTogetherModal: React.FC<ListenTogetherModalProps> = ({ isOpen, onClose }) => {
  const [inputCode, setInputCode] = useState('');
  const [partyState, setPartyState] = useState<BitChordPartyState>({
    code: '',
    song: null,
    isPlaying: false,
    positionMs: 0,
    anchorMs: 0,
    members: [],
  });
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = listenTogetherService.subscribe(setPartyState);
    return () => unsub();
  }, []);

  if (!isOpen) return null;

  const handleCreateParty = async () => {
    setLoading(true);
    setError(null);
    try {
      await listenTogetherService.createParty('Host Listener');
    } catch (err: any) {
      setError(err.message || 'Failed to create party');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinParty = async () => {
    if (!inputCode.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await listenTogetherService.joinParty(inputCode.trim());
      setInputCode('');
    } catch (err: any) {
      setError(err.message || 'Failed to join party. Check the code and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveParty = async () => {
    await listenTogetherService.leaveParty();
  };

  const handleCopy = () => {
    if (!partyState.code) return;
    navigator.clipboard.writeText(partyState.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isInParty = !!partyState.code;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl">
      <div className="w-full max-w-md liquid-glass rounded-3xl p-6 shadow-2xl flex flex-col gap-5 backdrop-blur-3xl border border-white/15">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-500" />
            <h3 className="text-lg font-bold text-white">Listen Together</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 text-white/60">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs">
            {error}
          </div>
        )}

        {isInParty ? (
          <div className="flex flex-col gap-4">
            {/* Active Party Code Header */}
            <div className="flex flex-col items-center gap-3 p-5 bg-white/[0.04] rounded-2xl border border-white/10 relative overflow-hidden">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px] text-green-400 uppercase tracking-widest font-bold">Party Active</span>
              </div>
              <span className="font-mono text-3xl font-extrabold tracking-widest text-accent-red">
                {partyState.code}
              </span>
              <button
                onClick={handleCopy}
                className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 hover:bg-white/15 text-xs font-semibold text-white transition-all active:scale-95"
              >
                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copied Link' : 'Copy Code'}</span>
              </button>
            </div>

            {/* Currently Synced Track (if playing) */}
            {partyState.song && (
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                <img
                  src={partyState.song.thumbnailUrl || '/logo.svg'}
                  alt={partyState.song.title}
                  className="w-10 h-10 rounded-lg object-cover"
                />
                <div className="overflow-hidden flex-1">
                  <div className="flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-accent-red animate-pulse" />
                    <span className="text-xs font-bold text-white truncate">{partyState.song.title}</span>
                  </div>
                  <span className="text-[11px] text-white/50 truncate block">{partyState.song.artist}</span>
                </div>
              </div>
            )}

            {/* Member List */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold text-white/50 uppercase tracking-wider">
                Connected Devices ({partyState.members.length}/5)
              </span>
              <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto">
                {partyState.members.map((m) => (
                  <div
                    key={m.memberId}
                    className="flex items-center justify-between p-2 rounded-xl bg-white/[0.02]"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-accent-red to-purple-600 flex items-center justify-center text-xs font-bold text-white">
                        {m.displayName.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-white">{m.displayName}</span>
                    </div>
                    {m.isHost && (
                      <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">
                        Host
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Leave Party Button */}
            <button
              onClick={handleLeaveParty}
              className="w-full py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 font-semibold text-xs border border-red-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 mt-2"
            >
              <LogOut className="w-4 h-4" />
              <span>Leave Party</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-xs text-white/60 leading-relaxed">
              Listen with friends in real time. Create a 6-character room code, share it, and up to 5 devices stay synchronized with sub-frame accuracy.
            </p>

            <button
              disabled={loading}
              onClick={handleCreateParty}
              className="w-full py-3 rounded-2xl bg-accent-red disabled:opacity-50 text-white font-semibold text-sm shadow-lg shadow-accent-red/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              <span>{loading ? 'Connecting...' : 'Start a New Party'}</span>
            </button>

            <div className="flex items-center gap-3">
              <div className="h-[1px] bg-white/10 flex-1" />
              <span className="text-xs text-white/40 uppercase font-semibold">or join</span>
              <div className="h-[1px] bg-white/10 flex-1" />
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                maxLength={6}
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                placeholder="6-digit code"
                className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-center font-mono text-base font-bold tracking-widest text-white uppercase outline-none focus:border-blue-500"
              />
              <button
                disabled={inputCode.length !== 6 || loading}
                onClick={handleJoinParty}
                className="px-6 py-3 rounded-2xl bg-blue-600 disabled:opacity-40 text-white font-semibold text-sm active:scale-95 transition-all flex items-center justify-center"
              >
                <LogIn className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
