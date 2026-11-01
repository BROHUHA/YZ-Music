import React, { useEffect, useState } from 'react';
import {
  X,
  Check,
  LogOut,
  RefreshCw,
  ExternalLink,
  Copy,
  Heart,
  ListMusic,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { YouTubeMusicLogo } from './YouTubeMusicLogo';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AccountModal: React.FC<AccountModalProps> = ({ isOpen, onClose }) => {
  const {
    isSignedIn,
    account,
    library,
    likedSongs,
    error,
    loginWithOAuth,
    loginWithSession,
    syncLibrary,
    logout,
  } = useAuthStore();

  // Google 1-Tap Device Code Flow State
  const [deviceFlowState, setDeviceFlowState] = useState<'idle' | 'loading' | 'waiting' | 'success'>('idle');
  const [deviceUserCode, setDeviceUserCode] = useState<string | null>(null);
  const [deviceCode, setDeviceCode] = useState<string | null>(null);
  const [deviceUrl, setDeviceUrl] = useState<string>('https://www.google.com/device');
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [pollIntervalSec, setPollIntervalSec] = useState<number>(5);
  const [copied, setCopied] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [avatarFailed, setAvatarFailed] = useState<boolean>(false);
  const [showCookieInput, setShowCookieInput] = useState<boolean>(false);
  const [cookieInput, setCookieInput] = useState<string>('');
  const [copiedBookmarklet, setCopiedBookmarklet] = useState<boolean>(false);

  // Poll auto-session capture receiver
  useEffect(() => {
    if (!isOpen || isSignedIn) return;

    let cancel = false;
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/auth/auto-session');
        if (res.ok && !cancel) {
          const data = await res.json();
          if (data?.cookie) {
            await loginWithSession(data.cookie);
            onClose();
          }
        }
      } catch {
        // silent
      }
    }, 2500);

    return () => {
      cancel = true;
      clearInterval(interval);
    };
  }, [isOpen, isSignedIn, loginWithSession, onClose]);

  // Poll Google OAuth token endpoint while user approves in the Google tab
  useEffect(() => {
    if (!isOpen || isSignedIn || deviceFlowState !== 'waiting' || !deviceCode) return;

    let timeoutId: NodeJS.Timeout;
    let currentDelay = Math.max(pollIntervalSec * 1000, 5000);
    let isCancelled = false;

    const poll = async () => {
      try {
        const res = await fetch('/api/auth/device/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ device_code: deviceCode }),
        });

        if (res.ok && !isCancelled) {
          const data = await res.json();
          if (data?.status === 'success' && data?.accessToken) {
            setDeviceFlowState('success');
            await loginWithOAuth(data.accessToken, data.account, data.refreshToken);
            setTimeout(() => {
              onClose();
              setDeviceFlowState('idle');
            }, 700);
            return;
          } else if (data?.error === 'slow_down') {
            currentDelay = Math.max(currentDelay + 2000, 7000);
          } else if (data?.error && data.error !== 'authorization_pending') {
            setDeviceError(`Google: ${data.error}`);
            setDeviceFlowState('idle');
            return;
          }
        }
      } catch (err: any) {
        console.warn('Device token poll error:', err);
      }

      if (!isCancelled) {
        timeoutId = setTimeout(poll, currentDelay);
      }
    };

    timeoutId = setTimeout(poll, currentDelay);

    return () => {
      isCancelled = true;
      clearTimeout(timeoutId);
    };
  }, [isOpen, isSignedIn, deviceFlowState, deviceCode, pollIntervalSec, loginWithOAuth, onClose]);

  if (!isOpen) return null;

  // Start the 1-Click Google Sign-In
  const handleStartGoogleDeviceFlow = async () => {
    setDeviceFlowState('loading');
    setDeviceError(null);
    setCopied(false);

    try {
      const res = await fetch('/api/auth/device/code', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.user_code && data.device_code) {
          setDeviceUserCode(data.user_code);
          setDeviceCode(data.device_code);
          if (data.interval) {
            setPollIntervalSec(Math.max(data.interval, 5));
          }
          const fullUrl = `https://www.google.com/device?user_code=${encodeURIComponent(data.user_code)}`;
          setDeviceUrl(fullUrl);
          setDeviceFlowState('waiting');

          // Auto-copy code to clipboard for convenience
          if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(data.user_code).then(() => setCopied(true)).catch(() => {});
          }

          // Open Google's device verification in a new tab pre-filled with the code
          window.open(fullUrl, '_blank', 'noopener,noreferrer');
        } else {
          setDeviceError(data.error_description || data.error || 'Failed to start Google sign-in');
          setDeviceFlowState('idle');
        }
      } else {
        setDeviceError('Unable to connect to Google Auth endpoint');
        setDeviceFlowState('idle');
      }
    } catch (e: any) {
      setDeviceError(e.message || 'Network error');
      setDeviceFlowState('idle');
    }
  };

  const handleCopyCode = () => {
    if (deviceUserCode && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(deviceUserCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-fade-in">
      <div className="w-full max-w-sm liquid-glass rounded-3xl p-6 shadow-2xl flex flex-col gap-5 border border-white/15 animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between pb-1">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent-red/20 border border-accent-red/30 flex items-center justify-center shadow-lg shadow-accent-red/20 shrink-0">
              <YouTubeMusicLogo size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">
                {isSignedIn ? 'YouTube Music' : 'Sign in'}
              </h3>
              <p className="text-[11px] text-white/50">
                {isSignedIn ? 'Connected Account' : 'Personalized Feed & Library'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {(error || deviceError) && (
          <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-xs text-red-200 flex items-start gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 shrink-0" />
            <div className="flex-1 leading-snug">{deviceError || error}</div>
          </div>
        )}

        {isSignedIn && account ? (
          /* ================= SIGNED IN PROFILE VIEW ================= */
          <div className="flex flex-col gap-4">
            {/* User Profile Card */}
            <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center gap-3.5">
              {!avatarFailed && account.thumbnailUrl ? (
                <img
                  src={`/api/avatar?url=${encodeURIComponent(account.thumbnailUrl)}`}
                  alt=""
                  onError={() => setAvatarFailed(true)}
                  className="w-12 h-12 rounded-full object-cover border border-white/20 shadow-md shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-accent-red to-purple-600 border border-white/20 flex items-center justify-center text-base font-bold text-white shrink-0 shadow-md">
                  {account.name?.charAt(0)?.toUpperCase() || 'U'}
                </div>
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <h4 className="text-sm font-bold text-white truncate">{account.name}</h4>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" title="Connected" />
                </div>
                {account.email && (
                  <p className="text-[11px] text-white/50 truncate mt-0.5">{account.email}</p>
                )}
                <span className="inline-block text-[10px] text-emerald-400/90 font-medium mt-1">
                  Active & Synced
                </span>
              </div>
            </div>

            {/* Quick Stats Summary */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-accent-red/15 flex items-center justify-center text-accent-red shrink-0">
                  <Heart className="w-3.5 h-3.5 fill-current" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white">
                    {library?.likedSongs?.length || likedSongs.length || 0}
                  </div>
                  <div className="text-[10px] text-white/40 truncate">Liked Songs</div>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-blue-500/15 flex items-center justify-center text-blue-400 shrink-0">
                  <ListMusic className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white">
                    {library?.shelves?.length || 0}
                  </div>
                  <div className="text-[10px] text-white/40 truncate">Playlists</div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 mt-1">
              <button
                onClick={async () => {
                  setSyncing(true);
                  await syncLibrary();
                  setSyncing(false);
                }}
                disabled={syncing}
                className="flex-1 flex items-center justify-center gap-1.5 p-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs font-semibold text-white transition-all cursor-pointer active:scale-95 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-accent-red' : ''}`} />
                <span>{syncing ? 'Syncing...' : 'Sync Library'}</span>
              </button>

              <button
                onClick={logout}
                className="flex-1 flex items-center justify-center gap-1.5 p-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-xs font-semibold text-red-400 transition-all cursor-pointer active:scale-95"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        ) : (
          /* ================= PURE 1-CLICK GOOGLE SIGN IN VIEW ================= */
          <div className="flex flex-col gap-4">
            {/* STATE 1: IDLE */}
            {deviceFlowState === 'idle' && (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-white/60 leading-relaxed text-center">
                  Sign in with Google to sync your YouTube Music library, personalized mixes, and playlists.
                </p>

                <button
                  type="button"
                  onClick={handleStartGoogleDeviceFlow}
                  className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-accent-red to-[#FF4B63] text-white text-xs font-bold shadow-[0_0_20px_rgba(250,45,72,0.4)] border border-white/20 active:scale-95 hover:scale-[1.01] transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Sign in with Google</span>
                </button>

                {/* 1-Click Sync from music.youtube.com */}
                <div className="pt-2 border-t border-white/10 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-white/70">
                      1-Tap YouTube Music Web Sync
                    </span>
                    <span className="text-[10px] text-emerald-400 font-medium">Full Library</span>
                  </div>

                  <p className="text-[11px] text-white/50 leading-relaxed">
                    While signed into <span className="text-white font-medium">music.youtube.com</span>, run this 1-click script in your browser to sync your full playlists and history:
                  </p>

                  <button
                    type="button"
                    onClick={() => {
                      const origin = window.location.origin;
                      const code = `javascript:(function(){fetch('${origin}/api/auth/auto-session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cookie:document.cookie})}).then(r=>r.json()).then(d=>alert('YZ Music: Successfully connected! You can now switch back.')).catch(e=>alert('YZ Music sync error: '+e));})()`;
                      if (navigator.clipboard?.writeText) {
                        navigator.clipboard.writeText(code);
                        setCopiedBookmarklet(true);
                        setTimeout(() => setCopiedBookmarklet(false), 2500);
                      }
                    }}
                    className="w-full py-2.5 px-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/15 text-white text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
                  >
                    {copiedBookmarklet ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-300">Sync Script Copied! Paste in music.youtube.com URL bar</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-white/60" />
                        <span>Copy 1-Click Sync Script</span>
                      </>
                    )}
                  </button>

                  <div className="flex items-center justify-between pt-0.5">
                    <a
                      href="https://music.youtube.com"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-accent-red hover:underline flex items-center gap-1"
                    >
                      <span>Open music.youtube.com</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>

                    <button
                      type="button"
                      onClick={() => setShowCookieInput(!showCookieInput)}
                      className="text-[11px] text-white/40 hover:text-white/70 transition-colors cursor-pointer"
                    >
                      {showCookieInput ? 'Hide manual paste' : 'Manual session paste'}
                    </button>
                  </div>

                  {showCookieInput && (
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (!cookieInput.trim()) return;
                        const ok = await loginWithSession(cookieInput.trim());
                        if (ok) {
                          onClose();
                        }
                      }}
                      className="flex flex-col gap-2 pt-1 animate-fade-in"
                    >
                      <textarea
                        value={cookieInput}
                        onChange={(e) => setCookieInput(e.target.value)}
                        placeholder="Paste music.youtube.com cookie (SAPISID=...)"
                        rows={2}
                        className="w-full bg-white/5 border border-white/15 rounded-xl p-2.5 text-[11px] text-white outline-none focus:border-accent-red font-mono resize-none"
                      />
                      <button
                        type="submit"
                        className="w-full py-2 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold border border-white/15 transition-all cursor-pointer active:scale-95"
                      >
                        Connect Session
                      </button>
                    </form>
                  )}
                </div>
              </div>
            )}

            {/* STATE 2: LOADING */}
            {deviceFlowState === 'loading' && (
              <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col items-center justify-center gap-2.5 text-center">
                <RefreshCw className="w-6 h-6 text-accent-red animate-spin" />
                <span className="text-xs text-white/70 font-medium">Connecting to Google...</span>
              </div>
            )}

            {/* STATE 3: WAITING FOR USER APPROVAL ON GOOGLE */}
            {deviceFlowState === 'waiting' && deviceUserCode && (
              <div className="p-4 rounded-2xl bg-white/[0.04] border border-accent-red/30 flex flex-col items-center gap-3.5 text-center animate-fade-in">
                <div className="text-[11px] text-white/50">Your Google Code</div>

                <div
                  onClick={handleCopyCode}
                  className="w-full py-2.5 px-4 rounded-xl bg-white/10 border border-white/15 text-2xl font-mono font-black text-white tracking-widest flex items-center justify-center gap-2 cursor-pointer hover:bg-white/15 transition-all select-all group"
                  title="Click to copy"
                >
                  <span>{deviceUserCode}</span>
                  {copied ? (
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <Copy className="w-4 h-4 text-white/40 group-hover:text-white shrink-0" />
                  )}
                </div>

                {copied && (
                  <span className="text-[10px] text-emerald-400 font-medium -mt-2">
                    Copied to clipboard!
                  </span>
                )}

                <a
                  href={deviceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-2.5 px-4 rounded-xl bg-accent-red hover:bg-[#FF4B63] text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-md shadow-accent-red/20 active:scale-95"
                >
                  <span>Open Google Tab</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                {/* Radar Status */}
                <div className="flex items-center gap-2 text-[11px] text-white/60 pt-0.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-red opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-red" />
                  </span>
                  <span>Waiting for you to tap "Allow"...</span>
                </div>
              </div>
            )}

            {/* STATE 4: SUCCESS */}
            {deviceFlowState === 'success' && (
              <div className="p-5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex flex-col items-center gap-2 text-center animate-fade-in">
                <Check className="w-7 h-7 text-emerald-400 animate-bounce" />
                <div className="text-xs font-bold text-white">Signed in with Google!</div>
                <div className="text-[10px] text-emerald-300">Syncing your feed and library...</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
