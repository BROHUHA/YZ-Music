import React, { useEffect, useState } from 'react';
import {
  Heart,
  Download,
  Music2,
  RefreshCw,
  User,
  ChevronRight,
  Play,
  Plus,
  X,
  HardDrive,
  Disc3,
  Users,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { YouTubeMusicLogo } from '../components/common/YouTubeMusicLogo';

interface LibraryViewProps {
  onOpenDetail?: (
    browseId: string,
    params?: string,
    title?: string,
    subtitle?: string,
    thumbnailUrl?: string | null,
    type?: any
  ) => void;
  onOpenAccount?: () => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({ onOpenDetail, onOpenAccount }) => {
  const {
    isSignedIn,
    account,
    library,
    userPlaylists,
    likedSongs,
    isSyncing,
    syncLibrary,
    createPlaylist,
  } = useAuthStore();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [expandedShelves, setExpandedShelves] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (isSignedIn && !isSyncing && !library) {
      syncLibrary();
    }
  }, [isSignedIn, isSyncing, library, syncLibrary]);

  const toggleShelfExpand = (shelfTitle: string) => {
    setExpandedShelves((prev) => ({
      ...prev,
      [shelfTitle]: !prev[shelfTitle],
    }));
  };

  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    await createPlaylist(newTitle, newDesc);
    setNewTitle('');
    setNewDesc('');
    setShowCreateModal(false);
  };

  // Extract distinct shelves from library (Playlists, Albums, Artists, Subscriptions)
  const albumShelf = library?.shelves?.find((s) => s.title.toLowerCase().includes('album'));
  const artistShelf = library?.shelves?.find(
    (s) => s.title.toLowerCase().includes('artist') || s.title.toLowerCase().includes('subscription')
  );
  const otherShelves = library?.shelves?.filter(
    (s) =>
      !s.title.toLowerCase().includes('playlist') &&
      !s.title.toLowerCase().includes('album') &&
      !s.title.toLowerCase().includes('artist') &&
      !s.title.toLowerCase().includes('subscription')
  ) || [];

  return (
    <div className="p-4 sm:p-6 pb-28 md:pb-8 flex flex-col gap-6 max-w-6xl mx-auto w-full animate-fade-in">
      {/* 1. Header (Subtitle & Controls) */}
      <div className="flex items-center justify-between -mt-1 sm:-mt-2">
        <div>
          <p className="text-xs text-white/50">
            {isSignedIn && account
              ? `Signed in as ${account.name}`
              : 'Sign in to access your personal collection'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isSignedIn ? (
            <button
              onClick={() => syncLibrary()}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full liquid-glass border border-white/15 text-white text-xs font-semibold hover:border-white/30 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
              title="Refresh Library"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-accent-red' : ''}`} />
              <span className="hidden sm:inline">{isSyncing ? 'Syncing...' : 'Sync'}</span>
            </button>
          ) : (
            <button
              onClick={onOpenAccount}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-accent-red to-[#FF4B63] text-white text-xs font-semibold shadow-[0_0_15px_rgba(250,45,72,0.4)] border border-white/20 active:scale-95 transition-all cursor-pointer"
            >
              <User className="w-4 h-4" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Replay Banner (matching ReplayBanner in LibraryScreen.kt) */}
      <div
        onClick={() => {
          onOpenDetail?.('FEmusic_history', undefined, 'Your Replay', 'Listening History', null, 'PLAYLIST');
        }}
        className="w-full p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-purple-900/40 via-accent-red/20 to-blue-900/30 border border-white/10 flex items-center justify-between cursor-pointer hover:border-white/25 transition-all group shadow-xl active:scale-[0.99]"
      >
        <div className="flex flex-col gap-0.5 min-w-0 pr-4">
          <span className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            <span>Your Replay</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-white/80">
              STATS
            </span>
          </span>
          <span className="text-xs text-white/70 truncate">
            Top songs, artists, albums and genres — counted on this device
          </span>
        </div>
        <ChevronRight className="w-5 h-5 text-white/60 group-hover:text-white transition-colors shrink-0" />
      </div>

      {/* 3. On Device Shelf (matching ON_DEVICE in LibraryScreen.kt) */}
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-bold text-white/50 uppercase tracking-wider">On Device</h3>
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {/* Downloads Card */}
          <div
            onClick={() => {
              onOpenDetail?.('local:downloads', undefined, 'Downloads', 'Downloaded songs', null, 'PLAYLIST');
            }}
            className="flex items-center gap-3.5 p-3.5 sm:p-4 rounded-2xl liquid-glass border border-white/10 hover:border-blue-400/30 transition-all cursor-pointer group active:scale-[0.98]"
          >
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shrink-0 text-blue-400 shadow-md">
              <Download className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors truncate">
                Downloads
              </h4>
              <p className="text-[11px] text-white/40 truncate">Downloaded songs</p>
            </div>
          </div>

          {/* Local Music Card */}
          <div
            onClick={() => {
              onOpenDetail?.('local:all', undefined, 'Local Music', 'Audio files on device', null, 'PLAYLIST');
            }}
            className="flex items-center gap-3.5 p-3.5 sm:p-4 rounded-2xl liquid-glass border border-white/10 hover:border-emerald-400/30 transition-all cursor-pointer group active:scale-[0.98]"
          >
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0 text-emerald-400 shadow-md">
              <HardDrive className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors truncate">
                Local music
              </h4>
              <p className="text-[11px] text-white/40 truncate">Audio files on device</p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Signed Out Prompt (matching MessageState in LibraryScreen.kt) */}
      {!isSignedIn && (
        <div className="p-6 rounded-3xl liquid-glass border border-accent-red/25 bg-gradient-to-br from-accent-red/10 via-black/40 to-black/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left shadow-xl">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-accent-red/20 border border-accent-red/40 flex items-center justify-center shrink-0">
              <YouTubeMusicLogo size={22} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Connect YouTube Music</h3>
              <p className="text-xs text-white/50 mt-0.5">
                Sign in to your Google account to see your YouTube Music liked songs, playlists, and history.
              </p>
            </div>
          </div>
          <button
            onClick={onOpenAccount}
            className="px-5 py-2.5 rounded-xl bg-white text-black text-xs font-bold hover:bg-white/90 active:scale-95 transition-all shrink-0 cursor-pointer shadow-lg"
          >
            Sign in
          </button>
        </div>
      )}

      {/* 5. Playlists Shelf (matching PlaylistShelf in LibraryScreen.kt) */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white tracking-tight">Playlists</h3>
          {userPlaylists.length > 3 && (
            <button
              onClick={() => toggleShelfExpand('playlists')}
              className="text-xs font-semibold text-accent-red hover:text-white transition-colors cursor-pointer"
            >
              {expandedShelves['playlists'] ? 'Show less' : 'Show all'}
            </button>
          )}
        </div>

        <div
          className={`grid gap-3.5 sm:gap-4 ${
            expandedShelves['playlists']
              ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'
              : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'
          }`}
        >
          {/* Tile 1: New Playlist Card (matching NewShelfCard in LibraryScreen.kt) */}
          <div
            onClick={() => setShowCreateModal(true)}
            className="p-3 rounded-2xl border border-dashed border-white/20 hover:border-accent-red/50 bg-white/[0.02] hover:bg-white/[0.05] transition-all cursor-pointer group flex flex-col gap-2.5 items-center justify-center text-center aspect-square"
          >
            <div className="w-12 h-12 rounded-2xl bg-accent-red/15 border border-accent-red/30 flex items-center justify-center text-accent-red group-hover:scale-110 transition-transform shadow-md">
              <Plus className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h4 className="font-bold text-xs text-white group-hover:text-accent-red transition-colors">
                New playlist
              </h4>
              <p className="text-[10px] text-white/40 mt-0.5">Saved to YouTube Music</p>
            </div>
          </div>

          {/* Tile 2: Liked Music Card (matching VLLM in LibraryScreen.kt) */}
          <div
            onClick={() => {
              onOpenDetail?.('VLLM', undefined, 'Liked Music', 'Auto Playlist', null, 'PLAYLIST');
            }}
            className="p-3 rounded-2xl liquid-glass border border-accent-red/30 hover:border-accent-red transition-all cursor-pointer group flex flex-col gap-2.5 aspect-square relative overflow-hidden shadow-lg hover:shadow-accent-red/20"
          >
            <div className="w-full h-full rounded-xl bg-gradient-to-br from-accent-red to-[#FF4B63] flex items-center justify-center text-white relative shadow-inner">
              <Heart className="w-10 h-10 fill-current text-white group-hover:scale-110 transition-transform" />
              <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-xl">
                <Play className="w-6 h-6 fill-white text-white ml-0.5" />
              </div>
            </div>
            <div className="min-w-0 mt-auto">
              <h4 className="font-bold text-xs text-white truncate group-hover:text-accent-red transition-colors">
                Liked Music
              </h4>
              <p className="text-[10px] text-white/50 truncate mt-0.5">
                {library?.likedSongs?.length || likedSongs.length || 0} songs
              </p>
            </div>
          </div>

          {/* Tiles 3+: User & Remote Playlists */}
          {(expandedShelves['playlists'] ? userPlaylists : userPlaylists.slice(0, 3)).map((pl) => (
            <div
              key={pl.id}
              onClick={() => {
                onOpenDetail?.(
                  pl.id.startsWith('VL') ? pl.id : `VL${pl.id}`,
                  undefined,
                  pl.title,
                  `Playlist • ${pl.author}`,
                  pl.thumbnailUrl || pl.songs?.[0]?.thumbnailUrl || null,
                  'PLAYLIST'
                );
              }}
              className="p-3 rounded-2xl liquid-glass border border-white/5 hover:border-white/25 transition-all cursor-pointer group flex flex-col gap-2.5 aspect-square"
            >
              <div className="aspect-square w-full rounded-xl overflow-hidden bg-white/5 relative">
                {pl.thumbnailUrl || pl.songs?.[0]?.thumbnailUrl ? (
                  <img
                    src={pl.thumbnailUrl || pl.songs?.[0]?.thumbnailUrl || ''}
                    alt={pl.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-accent-red/20 to-purple-600/20 text-white/40">
                    <Music2 className="w-8 h-8" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <div className="w-9 h-9 rounded-full bg-accent-red flex items-center justify-center shadow-lg shadow-accent-red/50">
                    <Play className="w-4 h-4 fill-white text-white ml-0.5" />
                  </div>
                </div>
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-xs text-white truncate group-hover:text-accent-red transition-colors">
                  {pl.title}
                </h4>
                <p className="text-[10px] text-white/40 truncate mt-0.5">
                  {pl.songCount ? `${pl.songCount} tracks` : pl.songs?.length ? `${pl.songs.length} tracks` : 'Playlist'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 6. Albums Shelf (matching Albums in LibraryScreen.kt) */}
      {albumShelf && albumShelf.items.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <Disc3 className="w-4 h-4 text-purple-400" />
              <span>Albums</span>
            </h3>
            {albumShelf.items.length > 5 && (
              <button
                onClick={() => toggleShelfExpand('albums')}
                className="text-xs font-semibold text-accent-red hover:text-white transition-colors cursor-pointer"
              >
                {expandedShelves['albums'] ? 'Show less' : 'Show all'}
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 sm:gap-4">
            {(expandedShelves['albums'] ? albumShelf.items : albumShelf.items.slice(0, 5)).map((item, idx) => (
              <div
                key={`${item.browseId || item.title}-${idx}`}
                onClick={() => {
                  if (item.browseId) {
                    onOpenDetail?.(
                      item.browseId,
                      item.params || undefined,
                      item.title,
                      item.subtitle,
                      item.thumbnailUrl,
                      'ALBUM'
                    );
                  }
                }}
                className="p-3 rounded-2xl liquid-glass border border-white/5 hover:border-white/20 transition-all cursor-pointer group flex flex-col gap-2.5"
              >
                <div className="aspect-square w-full rounded-xl overflow-hidden bg-white/5 relative">
                  {item.thumbnailUrl ? (
                    <img
                      src={item.thumbnailUrl}
                      alt={item.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/30">
                      <Disc3 className="w-8 h-8" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <div className="w-9 h-9 rounded-full bg-accent-red flex items-center justify-center shadow-lg shadow-accent-red/50">
                      <Play className="w-4 h-4 fill-white text-white ml-0.5" />
                    </div>
                  </div>
                </div>
                <div className="min-w-0">
                  <h4 className="font-bold text-xs text-white truncate group-hover:text-accent-red transition-colors">
                    {item.title}
                  </h4>
                  {item.subtitle && (
                    <p className="text-[10px] text-white/40 truncate mt-0.5">{item.subtitle}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 7. Artists Shelf (matching Artists in LibraryScreen.kt with circular portraits) */}
      {artistShelf && artistShelf.items.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" />
              <span>Artists</span>
            </h3>
            {artistShelf.items.length > 5 && (
              <button
                onClick={() => toggleShelfExpand('artists')}
                className="text-xs font-semibold text-accent-red hover:text-white transition-colors cursor-pointer"
              >
                {expandedShelves['artists'] ? 'Show less' : 'Show all'}
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 sm:gap-4">
            {(expandedShelves['artists'] ? artistShelf.items : artistShelf.items.slice(0, 5)).map((item, idx) => (
              <div
                key={`${item.browseId || item.title}-${idx}`}
                onClick={() => {
                  if (item.browseId) {
                    onOpenDetail?.(
                      item.browseId,
                      item.params || undefined,
                      item.title,
                      item.subtitle,
                      item.thumbnailUrl,
                      'ARTIST'
                    );
                  }
                }}
                className="p-3 rounded-2xl liquid-glass border border-white/5 hover:border-white/20 transition-all cursor-pointer group flex flex-col gap-2.5 items-center text-center"
              >
                <div className="aspect-square w-24 sm:w-28 rounded-full overflow-hidden bg-white/5 relative shadow-lg">
                  {item.thumbnailUrl ? (
                    <img
                      src={item.thumbnailUrl}
                      alt={item.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/30">
                      <Users className="w-8 h-8" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 w-full">
                  <h4 className="font-bold text-xs text-white truncate group-hover:text-accent-red transition-colors">
                    {item.title}
                  </h4>
                  {item.subtitle && (
                    <p className="text-[10px] text-white/40 truncate mt-0.5">{item.subtitle}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 8. Other Shelves (Podcasts, Mixes) */}
      {otherShelves.map((shelf, idx) => (
        <section key={`${shelf.title}-${idx}`} className="flex flex-col gap-3">
          <h3 className="text-lg font-bold text-white tracking-tight">{shelf.title}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 sm:gap-4">
            {shelf.items.map((item, itemIdx) => (
              <div
                key={`${item.browseId || item.title}-${itemIdx}`}
                onClick={() => {
                  if (item.browseId) {
                    onOpenDetail?.(
                      item.browseId,
                      item.params || undefined,
                      item.title,
                      item.subtitle,
                      item.thumbnailUrl,
                      'PLAYLIST'
                    );
                  }
                }}
                className="p-3 rounded-2xl liquid-glass border border-white/5 hover:border-white/20 transition-all cursor-pointer group flex flex-col gap-2.5"
              >
                <div className="aspect-square w-full rounded-xl overflow-hidden bg-white/5 relative">
                  {item.thumbnailUrl ? (
                    <img
                      src={item.thumbnailUrl}
                      alt={item.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/30">
                      <Music2 className="w-8 h-8" />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <h4 className="font-bold text-xs text-white truncate group-hover:text-accent-red transition-colors">
                    {item.title}
                  </h4>
                  {item.subtitle && (
                    <p className="text-[10px] text-white/40 truncate mt-0.5">{item.subtitle}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      {/* Create Playlist Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-fade-in">
          <div className="w-full max-w-md liquid-glass rounded-3xl p-6 shadow-2xl flex flex-col gap-4 border border-white/15 animate-scale-in">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="text-base font-bold text-white tracking-tight">New Playlist</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePlaylist} className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-white/70">Playlist Name</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Late Night Vibes"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-accent-red transition-colors"
                  autoFocus
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-white/70">Description (Optional)</label>
                <input
                  type="text"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="What's this playlist about?"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-accent-red transition-colors"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newTitle.trim()}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-accent-red to-[#FF4B63] text-white text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shadow-lg shadow-accent-red/20"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
