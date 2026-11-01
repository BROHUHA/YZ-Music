import React from 'react';
import {
  Play,
  Clock,
  ListPlus,
  Music2,
  Disc,
  User,
  ListMusic,
  X,
} from 'lucide-react';
import { Song, BrowseItem } from '../types';
import { useSearchStore } from '../stores/searchStore';
import { usePlayerStore } from '../stores/playerStore';

interface SearchViewProps {
  onOpenDetail?: (
    browseId: string,
    params?: string,
    title?: string,
    subtitle?: string,
    thumbnailUrl?: string | null,
    type?: string
  ) => void;
}

export const SearchView: React.FC<SearchViewProps> = ({ onOpenDetail }) => {
  const {
    query,
    setQuery,
    filter,
    results,
    loading,
    history,
    performSearch,
    removeHistoryItem,
    clearHistory,
  } = useSearchStore();

  const { playSong, addToQueue } = usePlayerStore();

  // Categorize results for the 'ALL' filter view
  const topResult = results?.find((r): r is { type: 'TopTrack'; song: Song } => r.type === 'TopTrack');
  const allSongs = results?.filter((r): r is { type: 'Track'; song: Song } => r.type === 'Track').map((r) => r.song) || [];
  const allBrowse = results?.filter((r): r is { type: 'Browse'; item: BrowseItem } => r.type === 'Browse').map((r) => r.item) || [];

  const artistItems = allBrowse.filter((item) => item.type === 'ARTIST');
  const albumItems = allBrowse.filter((item) => item.type === 'ALBUM');
  const playlistItems = allBrowse.filter((item) => item.type === 'PLAYLIST');
  const otherItems = allBrowse.filter((item) => item.type === 'OTHER');

  return (
    <div className="p-4 sm:p-6 pb-28 md:pb-8 flex flex-col gap-6 max-w-4xl mx-auto w-full">
      {/* 1. Recent Searches View (Shown when input is empty and no results) */}
      {results === null && query.trim().length === 0 && (
        <div className="flex flex-col gap-3">
          {history.length > 0 ? (
            <>
              <div className="flex items-center justify-between px-1">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-accent-red" />
                  Recent Searches
                </h3>
                <button
                  type="button"
                  onClick={clearHistory}
                  className="text-xs font-semibold text-accent-red hover:text-white transition-colors px-2.5 py-1 rounded-md hover:bg-white/10"
                >
                  Clear all
                </button>
              </div>

              <div className="flex flex-col divide-y divide-white/5 rounded-2xl liquid-glass overflow-hidden border border-white/10">
                {history.map((term, idx) => (
                  <div
                    key={`hist-${term}-${idx}`}
                    onClick={() => {
                      setQuery(term);
                      performSearch(term);
                    }}
                    className="px-4 py-3 hover:bg-white/[0.08] cursor-pointer flex items-center justify-between text-sm text-white/80 hover:text-white transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <Clock className="w-4 h-4 text-white/40 group-hover:text-accent-red transition-colors" />
                      <span className="font-medium">{term}</span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeHistoryItem(term);
                      }}
                      className="w-7 h-7 rounded-full hover:bg-white/10 text-white/40 hover:text-white flex items-center justify-center transition-colors"
                      title="Remove from history"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-20 flex flex-col items-center gap-3 text-white/40">
              <div className="w-16 h-16 rounded-full liquid-glass flex items-center justify-center border border-white/10">
                <Music2 className="w-8 h-8 text-white/30" />
              </div>
              <p className="text-sm font-medium">Search for your favorite songs, artists, or albums</p>
            </div>
          )}
        </div>
      )}

      {/* 2. Loading Skeleton */}
      {loading && (
        <div className="flex flex-col gap-3 animate-pulse">
          <div className="h-32 bg-white/5 rounded-2xl w-full" />
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-white/5 rounded-2xl w-full" />
          ))}
        </div>
      )}

      {/* 3. Results List View */}
      {!loading && results !== null && (
        <div className="flex flex-col gap-6">
          {/* Promoted Top Result Card (Matching SearchScreen.kt TopResultCard) */}
          {filter === 'ALL' && topResult && (
            <div className="p-4 sm:p-5 rounded-2xl liquid-glass-card border border-white/10 shadow-xl flex flex-col gap-4">
              <span className="text-xs font-bold uppercase tracking-wider text-accent-red">
                Top Result
              </span>

              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-white/5 relative border border-white/10 shadow-md">
                  <img
                    src={topResult.song.thumbnailUrl || (topResult.song.videoId ? `https://i.ytimg.com/vi/${topResult.song.videoId}/hqdefault.jpg` : '/logo.svg')}
                    alt={topResult.song.title}
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      e.currentTarget.src = '/logo.svg';
                    }}
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="overflow-hidden flex-1">
                  <h3 className="text-lg sm:text-xl font-bold text-white truncate leading-tight">
                    {topResult.song.title}
                  </h3>
                  <p className="text-sm text-white/60 truncate mt-1">
                    {topResult.song.artist}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() =>
                    playSong({
                      ...topResult.song,
                      thumbnailUrl:
                        topResult.song.thumbnailUrl ||
                        (topResult.song.videoId ? `https://i.ytimg.com/vi/${topResult.song.videoId}/hqdefault.jpg` : null),
                    })
                  }
                  className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-tr from-accent-red to-[#FF4B63] text-white font-semibold text-sm shadow-[0_4px_20px_rgba(250,45,72,0.4)] hover:scale-105 active:scale-95 transition-all"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>Play</span>
                </button>

                <button
                  type="button"
                  onClick={() => addToQueue(topResult.song)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-full liquid-glass-pill hover:border-white/20 text-white font-medium text-sm active:scale-95 transition-all"
                >
                  <ListPlus className="w-4 h-4 text-white/60" />
                  <span>Add to Queue</span>
                </button>
              </div>
            </div>
          )}

          {/* Grouped Result Sections for 'ALL' filter */}
          {filter === 'ALL' && (
            <>
              {/* Songs Section */}
              {allSongs.length > 0 && (
                <div className="flex flex-col gap-2">
                  <h3 className="text-base font-bold text-white px-1 tracking-tight flex items-center gap-2">
                    <Music2 className="w-4 h-4 text-accent-red" />
                    Songs
                  </h3>
                  <div className="flex flex-col divide-y divide-white/5 rounded-2xl liquid-glass overflow-hidden border border-white/10">
                    {allSongs.map((song, idx) => (
                      <div
                        key={`song-${song.videoId}-${idx}`}
                        onClick={() =>
                          playSong({
                            ...song,
                            thumbnailUrl:
                              song.thumbnailUrl ||
                              (song.videoId ? `https://i.ytimg.com/vi/${song.videoId}/hqdefault.jpg` : null),
                          })
                        }
                        className="flex items-center gap-3.5 p-3 hover:bg-white/[0.08] transition-all cursor-pointer group"
                      >
                        <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-white/5 relative border border-white/10">
                          <img
                            src={song.thumbnailUrl || (song.videoId ? `https://i.ytimg.com/vi/${song.videoId}/hqdefault.jpg` : '/logo.svg')}
                            alt={song.title}
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              e.currentTarget.src = '/logo.svg';
                            }}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Play className="w-4 h-4 fill-white text-white ml-0.5" />
                          </div>
                        </div>

                        <div className="overflow-hidden flex-1">
                          <h4 className="text-sm font-semibold text-white truncate leading-tight group-hover:text-accent-red transition-colors">
                            {song.title}
                          </h4>
                          <p className="text-xs text-white/50 truncate mt-0.5">{song.artist}</p>
                        </div>

                        {song.durationText && (
                          <span className="text-xs text-white/40 shrink-0 font-medium">
                            {song.durationText}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Artists Section (Circular Avatars) */}
              {artistItems.length > 0 && (
                <div className="flex flex-col gap-2">
                  <h3 className="text-base font-bold text-white px-1 tracking-tight flex items-center gap-2">
                    <User className="w-4 h-4 text-accent-red" />
                    Artists
                  </h3>
                  <div className="flex flex-col divide-y divide-white/5 rounded-2xl liquid-glass overflow-hidden border border-white/10">
                    {artistItems.map((item, idx) => (
                      <div
                        key={`artist-${item.browseId}-${idx}`}
                        onClick={() =>
                          onOpenDetail &&
                          onOpenDetail(item.browseId, undefined, item.title, item.subtitle, item.thumbnailUrl, item.type)
                        }
                        className="flex items-center gap-3.5 p-3 hover:bg-white/[0.08] transition-all cursor-pointer group"
                      >
                        <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 bg-white/5 relative border border-white/10">
                          <img
                            src={item.thumbnailUrl || '/logo.svg'}
                            alt={item.title}
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              e.currentTarget.src = '/logo.svg';
                            }}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        </div>

                        <div className="overflow-hidden flex-1">
                          <h4 className="text-sm font-semibold text-white truncate leading-tight group-hover:text-accent-red transition-colors">
                            {item.title}
                          </h4>
                          <p className="text-xs text-white/50 truncate mt-0.5">Artist</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Albums Section */}
              {albumItems.length > 0 && (
                <div className="flex flex-col gap-2">
                  <h3 className="text-base font-bold text-white px-1 tracking-tight flex items-center gap-2">
                    <Disc className="w-4 h-4 text-accent-red" />
                    Albums
                  </h3>
                  <div className="flex flex-col divide-y divide-white/5 rounded-2xl liquid-glass overflow-hidden border border-white/10">
                    {albumItems.map((item, idx) => (
                      <div
                        key={`album-${item.browseId}-${idx}`}
                        onClick={() =>
                          onOpenDetail &&
                          onOpenDetail(item.browseId, undefined, item.title, item.subtitle, item.thumbnailUrl, item.type)
                        }
                        className="flex items-center gap-3.5 p-3 hover:bg-white/[0.08] transition-all cursor-pointer group"
                      >
                        <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-white/5 relative border border-white/10">
                          <img
                            src={item.thumbnailUrl || '/logo.svg'}
                            alt={item.title}
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              e.currentTarget.src = '/logo.svg';
                            }}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        </div>

                        <div className="overflow-hidden flex-1">
                          <h4 className="text-sm font-semibold text-white truncate leading-tight group-hover:text-accent-red transition-colors">
                            {item.title}
                          </h4>
                          <p className="text-xs text-white/50 truncate mt-0.5">
                            Album {item.subtitle ? `• ${item.subtitle}` : ''}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Playlists Section */}
              {playlistItems.length > 0 && (
                <div className="flex flex-col gap-2">
                  <h3 className="text-base font-bold text-white px-1 tracking-tight flex items-center gap-2">
                    <ListMusic className="w-4 h-4 text-accent-red" />
                    Playlists
                  </h3>
                  <div className="flex flex-col divide-y divide-white/5 rounded-2xl liquid-glass overflow-hidden border border-white/10">
                    {playlistItems.map((item, idx) => (
                      <div
                        key={`playlist-${item.browseId}-${idx}`}
                        onClick={() =>
                          onOpenDetail &&
                          onOpenDetail(item.browseId, undefined, item.title, item.subtitle, item.thumbnailUrl, item.type)
                        }
                        className="flex items-center gap-3.5 p-3 hover:bg-white/[0.08] transition-all cursor-pointer group"
                      >
                        <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-white/5 relative border border-white/10">
                          <img
                            src={item.thumbnailUrl || '/logo.svg'}
                            alt={item.title}
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              e.currentTarget.src = '/logo.svg';
                            }}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        </div>

                        <div className="overflow-hidden flex-1">
                          <h4 className="text-sm font-semibold text-white truncate leading-tight group-hover:text-accent-red transition-colors">
                            {item.title}
                          </h4>
                          <p className="text-xs text-white/50 truncate mt-0.5">
                            Playlist {item.subtitle ? `• ${item.subtitle}` : ''}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* More / Topics Section */}
              {otherItems.length > 0 && (
                <div className="flex flex-col gap-2">
                  <h3 className="text-base font-bold text-white px-1 tracking-tight">More</h3>
                  <div className="flex flex-col divide-y divide-white/5 rounded-2xl liquid-glass overflow-hidden border border-white/10">
                    {otherItems.map((item, idx) => (
                      <div
                        key={`other-${item.browseId}-${idx}`}
                        onClick={() =>
                          onOpenDetail &&
                          onOpenDetail(item.browseId, undefined, item.title, item.subtitle, item.thumbnailUrl, item.type)
                        }
                        className="flex items-center gap-3.5 p-3 hover:bg-white/[0.08] transition-all cursor-pointer group"
                      >
                        <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-white/5 relative border border-white/10">
                          <img
                            src={item.thumbnailUrl || '/logo.svg'}
                            alt={item.title}
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              e.currentTarget.src = '/logo.svg';
                            }}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        </div>

                        <div className="overflow-hidden flex-1">
                          <h4 className="text-sm font-semibold text-white truncate leading-tight group-hover:text-accent-red transition-colors">
                            {item.title}
                          </h4>
                          <p className="text-xs text-white/50 truncate mt-0.5">
                            {item.subtitle || 'Community & Topics'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Filtered Specific View (When filter is not 'ALL') */}
          {filter !== 'ALL' && (
            <div className="flex flex-col divide-y divide-white/5 rounded-2xl liquid-glass overflow-hidden border border-white/10">
              {results.map((res, idx) => {
                if (res.type === 'Track' || res.type === 'TopTrack') {
                  const song = res.song;
                  return (
                    <div
                      key={`track-filt-${song.videoId}-${idx}`}
                      onClick={() =>
                        playSong({
                          ...song,
                          thumbnailUrl:
                            song.thumbnailUrl ||
                            (song.videoId ? `https://i.ytimg.com/vi/${song.videoId}/hqdefault.jpg` : null),
                        })
                      }
                      className="flex items-center gap-3.5 p-3 hover:bg-white/[0.08] transition-all cursor-pointer group"
                    >
                      <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-white/5 relative border border-white/10">
                        <img
                          src={song.thumbnailUrl || (song.videoId ? `https://i.ytimg.com/vi/${song.videoId}/hqdefault.jpg` : '/logo.svg')}
                          alt={song.title}
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            e.currentTarget.src = '/logo.svg';
                          }}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Play className="w-4 h-4 fill-white text-white ml-0.5" />
                        </div>
                      </div>

                      <div className="overflow-hidden flex-1">
                        <h4 className="text-sm font-semibold text-white truncate leading-tight group-hover:text-accent-red transition-colors">
                          {song.title}
                        </h4>
                        <p className="text-xs text-white/50 truncate mt-0.5">{song.artist}</p>
                      </div>

                      {song.durationText && (
                        <span className="text-xs text-white/40 shrink-0 font-medium">
                          {song.durationText}
                        </span>
                      )}
                    </div>
                  );
                } else if (res.type === 'Browse') {
                  const item = res.item;
                  const isArtist = item.type === 'ARTIST';
                  return (
                    <div
                      key={`browse-filt-${item.browseId}-${idx}`}
                      onClick={() =>
                        onOpenDetail &&
                        onOpenDetail(item.browseId, undefined, item.title, item.subtitle, item.thumbnailUrl, item.type)
                      }
                      className="flex items-center gap-3.5 p-3 hover:bg-white/[0.08] transition-all cursor-pointer group"
                    >
                      <div
                        className={`w-12 h-12 overflow-hidden shrink-0 bg-white/5 relative border border-white/10 ${
                          isArtist ? 'rounded-full' : 'rounded-xl'
                        }`}
                      >
                        <img
                          src={item.thumbnailUrl || '/logo.svg'}
                          alt={item.title}
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            e.currentTarget.src = '/logo.svg';
                          }}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      </div>

                      <div className="overflow-hidden flex-1">
                        <h4 className="text-sm font-semibold text-white truncate leading-tight group-hover:text-accent-red transition-colors">
                          {item.title}
                        </h4>
                        <p className="text-xs text-white/50 truncate mt-0.5">
                          {item.type} {item.subtitle ? `• ${item.subtitle}` : ''}
                        </p>
                      </div>
                    </div>
                  );
                }
                return null;
              })}
            </div>
          )}

          {/* Empty state when query returns no results */}
          {results.length === 0 && (
            <div className="text-center py-20 text-white/40 text-sm">
              No results found for "{query}". Try searching for another artist, song, or album.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
