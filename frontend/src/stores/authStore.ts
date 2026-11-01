/**
 * YZ Music Web - Real YouTube Music Authentication Store
 * Faithful to AuthStore.kt and AccountSessions.kt
 * Connects directly to Google YouTube Music to fetch real personal libraries, playlists, and liked songs.
 */

import { create } from 'zustand';
import { Account, AccountChannel, LibraryPage, Song, UserPlaylist } from '../types';
import { innertubeService } from '../services/innertube';
import { usePlayerStore } from './playerStore';

interface AuthState {
  account: Account | null;
  savedAccounts: Account[];
  channels: AccountChannel[];
  activeChannel: AccountChannel | null;
  cookie: string | null;
  isSignedIn: boolean;
  isLoading: boolean;
  isSyncing: boolean;
  error: string | null;
  library: LibraryPage | null;
  userPlaylists: UserPlaylist[];
  likedSongs: Song[];
  feedRefreshTrigger: number;

  // Scrobbling settings (from AccountAndScrobblingScreen.kt)
  lastfmEnabled: boolean;
  lastfmUsername: string;
  listenBrainzEnabled: boolean;
  listenBrainzToken: string;

  // Actions
  loginWithSession: (cookieString: string) => Promise<boolean>;
  loginWithOAuth: (accessToken: string, account: Account, refreshToken?: string) => Promise<boolean>;
  selectChannel: (channel: AccountChannel) => Promise<void>;
  createPlaylist: (title: string, description?: string) => Promise<UserPlaylist>;
  addSongToPlaylist: (playlistId: string, song: Song) => Promise<void>;
  removeSongFromPlaylist: (playlistId: string, videoId: string) => void;
  toggleLikeSong: (song: Song) => Promise<void>;
  logout: () => void;
  syncLibrary: () => Promise<void>;
  setLastfm: (enabled: boolean, username?: string) => void;
  setListenBrainz: (enabled: boolean, token?: string) => void;
}

function loadLocalPlaylists(): UserPlaylist[] {
  try {
    const raw = localStorage.getItem('yz_user_custom_playlists');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export const useAuthStore = create<AuthState>((set, get) => {
  const savedAccountJson = localStorage.getItem('yz_yt_account');
  const savedCookie = localStorage.getItem('yz_yt_cookie');
  const savedChannelsJson = localStorage.getItem('yz_yt_channels');
  const savedActiveChannelJson = localStorage.getItem('yz_yt_active_channel');

  let initialAccount: Account | null = null;
  let initialChannels: AccountChannel[] = [];
  let initialActiveChannel: AccountChannel | null = null;

  try {
    if (savedAccountJson) initialAccount = JSON.parse(savedAccountJson);
    if (savedChannelsJson) initialChannels = JSON.parse(savedChannelsJson);
    if (savedActiveChannelJson) initialActiveChannel = JSON.parse(savedActiveChannelJson);
  } catch (e) {
    console.warn('Failed parsing stored auth accounts:', e);
  }

  const savedToken = localStorage.getItem('yz_yt_access_token');
  const isSignedIn = !!(initialAccount && (savedToken || savedCookie));

  return {
    account: initialAccount,
    savedAccounts: initialAccount ? [initialAccount] : [],
    channels: initialChannels,
    activeChannel: initialActiveChannel,
    cookie: savedCookie,
    isSignedIn,
    isLoading: false,
    isSyncing: false,
    error: null,
    library: null,
    userPlaylists: loadLocalPlaylists(),
    likedSongs: [],
    feedRefreshTrigger: 0,

    lastfmEnabled: localStorage.getItem('yz_lastfm_enabled') === 'true',
    lastfmUsername: localStorage.getItem('yz_lastfm_username') || '',
    listenBrainzEnabled: localStorage.getItem('yz_listenbrainz_enabled') === 'true',
    listenBrainzToken: localStorage.getItem('yz_listenbrainz_token') || '',

    /**
     * Connects directly to Google YouTube Music using authentic session credentials
     * Calls /youtubei/v1/account/account_menu and /youtubei/v1/browse for real library
     */
    loginWithSession: async (rawCookie: string) => {
      const trimmed = rawCookie.trim();
      if (!trimmed) {
        set({ error: 'Please provide a valid YouTube Music session cookie string.' });
        return false;
      }

      set({ isLoading: true, error: null });

      try {
        innertubeService.setCookie(trimmed);

        // 1. Fetch real account profile from YouTube Music account_menu
        const menuResult = await innertubeService.getAccountMenu();

        let accountToSave: Account;
        let channelsToSave: AccountChannel[] = [];
        let activeChannel: AccountChannel | null = null;

        if (menuResult?.account) {
          accountToSave = menuResult.account;
          channelsToSave = menuResult.channels;
          activeChannel = channelsToSave.find((c) => c.activeOnWeb) || channelsToSave[0] || null;
        } else if (innertubeService.hasApiSid(trimmed)) {
          // If account menu shape is minimal, fallback to valid session identifier
          accountToSave = {
            name: 'YouTube Music Account',
            email: 'Google Authenticated',
            thumbnailUrl: null,
          };
        } else {
          throw new Error(
            'The session cookie is missing Google authentication credentials (SAPISID or __Secure-3PAPISID). Please ensure you are signed into YouTube Music.'
          );
        }

        // 2. Persist real session
        localStorage.setItem('yz_yt_cookie', trimmed);
        localStorage.setItem('yz_yt_account', JSON.stringify(accountToSave));
        localStorage.setItem('yz_yt_channels', JSON.stringify(channelsToSave));
        if (activeChannel) {
          localStorage.setItem('yz_yt_active_channel', JSON.stringify(activeChannel));
          innertubeService.setActiveChannel(activeChannel.pageId || null, activeChannel.dataSyncId || null);
        }

        set({
          cookie: trimmed,
          account: accountToSave,
          channels: channelsToSave,
          activeChannel,
          isSignedIn: true,
          isLoading: false,
          error: null,
        });

        // 3. Immediately fetch user's real YouTube Music library, playlists, and liked music
        await get().syncLibrary();
        return true;
      } catch (err: any) {
        console.error('Login error:', err);
        innertubeService.setCookie(null);
        set({
          isLoading: false,
          error:
            err?.message ||
            'Failed to connect to YouTube Music. Please ensure you are signed in on music.youtube.com.',
        });
        return false;
      }
    },

    /**
     * Authenticates via Google / YouTube Device Code Flow (OAuth 2.0 Bearer token)
     */
    loginWithOAuth: async (accessToken: string, account: Account, refreshToken?: string) => {
      set({ isLoading: true, error: null });
      try {
        innertubeService.setAccessToken(accessToken);
        if (refreshToken) {
          localStorage.setItem('yz_yt_refresh_token', refreshToken);
        }
        localStorage.setItem('yz_yt_account', JSON.stringify(account));

        set((state) => ({
          isSignedIn: true,
          account,
          savedAccounts: [account],
          isLoading: false,
          feedRefreshTrigger: state.feedRefreshTrigger + 1,
        }));

        // Trigger real library sync immediately
        await get().syncLibrary();
        return true;
      } catch (err: any) {
        console.error('OAuth login error:', err);
        set({ isLoading: false, error: err?.message || 'OAuth sign-in failed' });
        return false;
      }
    },

    selectChannel: async (channel: AccountChannel) => {
      localStorage.setItem('yz_yt_active_channel', JSON.stringify(channel));
      innertubeService.setActiveChannel(channel.pageId || null, channel.dataSyncId || null);

      set({
        activeChannel: channel,
        account: {
          name: channel.name,
          email: channel.subtitle || get().account?.email || '',
          thumbnailUrl: channel.thumbnailUrl || get().account?.thumbnailUrl || null,
        },
      });

      await get().syncLibrary();
    },

    /**
     * Fetches real playlists, saved albums, and real Liked Music from YouTube Music
     */
    syncLibrary: async () => {
      set({ isSyncing: true });
      try {
        const lib = await innertubeService.getLibrary();

        // Sync real liked songs into player store like statuses
        const likeMap: Record<string, 'LIKE'> = {};
        lib.likedSongs.forEach((song) => {
          likeMap[song.videoId] = 'LIKE';
        });
        usePlayerStore.setState((s) => ({
          likeStatuses: { ...s.likeStatuses, ...likeMap },
        }));

        // Merge remote playlists into userPlaylists
        const playlistShelf = lib.shelves.find(
          (s) => s.title.toLowerCase().includes('playlist')
        );
        let nextPlaylists = get().userPlaylists;
        if (playlistShelf && playlistShelf.items.length > 0) {
          const remotePlaylists: UserPlaylist[] = playlistShelf.items.map((item) => ({
            id: item.browseId?.replace(/^VL/, '') || item.browseId || `P_${item.title}`,
            title: item.title,
            author: get().account?.name || 'YouTube Music',
            songCount: parseInt(item.subtitle?.replace(/\D/g, '') || '0', 10),
            thumbnailUrl: item.thumbnailUrl,
            songs: [],
            isCustom: false,
          }));
          const localList = loadLocalPlaylists();
          nextPlaylists = [
            ...localList,
            ...remotePlaylists.filter((rp) => !localList.some((lp) => lp.id === rp.id)),
          ];
        }

        set({
          library: lib,
          likedSongs: lib.likedSongs,
          userPlaylists: nextPlaylists,
          isSyncing: false,
        });
      } catch (e) {
        console.warn('Real library sync error:', e);
        set({ isSyncing: false });
      }
    },

    createPlaylist: async (title: string, description?: string) => {
      const { userPlaylists, account, isSignedIn } = get();
      let realYtPlaylistId: string | null = null;

      if (isSignedIn) {
        try {
          realYtPlaylistId = await innertubeService.createPlaylist(title, 'PRIVATE', description);
        } catch (e) {
          console.warn('Real YouTube Music playlist create error:', e);
        }
      }

      const id = realYtPlaylistId || `UP_${Date.now()}`;

      const newPlaylist: UserPlaylist = {
        id,
        title: title.trim(),
        author: account?.name || 'You',
        songCount: 0,
        thumbnailUrl: null,
        description: description?.trim(),
        songs: [],
      };

      const nextPlaylists = [newPlaylist, ...userPlaylists];
      localStorage.setItem('yz_user_custom_playlists', JSON.stringify(nextPlaylists));
      set({ userPlaylists: nextPlaylists });

      // If created on YouTube Music, sync real library to reflect immediately
      if (realYtPlaylistId) {
        get().syncLibrary();
      }

      return newPlaylist;
    },

    addSongToPlaylist: async (playlistId: string, song: Song) => {
      const { userPlaylists, isSignedIn } = get();

      // If this is a real YouTube Music playlist, add to Google's cloud
      if (isSignedIn && !playlistId.startsWith('UP_')) {
        try {
          await innertubeService.addTracksToPlaylist(playlistId, [song.videoId]);
        } catch (e) {
          console.warn('Real YouTube Music add song error:', e);
        }
      }

      const nextPlaylists = userPlaylists.map((pl) => {
        if (pl.id !== playlistId) return pl;
        const songs = pl.songs || [];
        if (songs.some((s) => s.videoId === song.videoId)) return pl;
        const updated = [...songs, song];
        return {
          ...pl,
          songs: updated,
          songCount: updated.length,
          thumbnailUrl: pl.thumbnailUrl || song.thumbnailUrl,
        };
      });

      localStorage.setItem('yz_user_custom_playlists', JSON.stringify(nextPlaylists));
      set({ userPlaylists: nextPlaylists });
    },

    removeSongFromPlaylist: (playlistId: string, videoId: string) => {
      const { userPlaylists } = get();
      const nextPlaylists = userPlaylists.map((pl) => {
        if (pl.id !== playlistId) return pl;
        const updated = (pl.songs || []).filter((s) => s.videoId !== videoId);
        return {
          ...pl,
          songs: updated,
          songCount: updated.length,
        };
      });

      localStorage.setItem('yz_user_custom_playlists', JSON.stringify(nextPlaylists));
      set({ userPlaylists: nextPlaylists });
    },

    toggleLikeSong: async (song: Song) => {
      const { likedSongs, isSignedIn } = get();
      const isLiked = likedSongs.some((s) => s.videoId === song.videoId);
      const nextLiked = isLiked
        ? likedSongs.filter((s) => s.videoId !== song.videoId)
        : [song, ...likedSongs];

      set({ likedSongs: nextLiked });

      usePlayerStore.setState((s) => ({
        likeStatuses: {
          ...s.likeStatuses,
          [song.videoId]: isLiked ? 'INDIFFERENT' : 'LIKE',
        },
      }));

      // Directly sync rating with Google's YouTube Music Liked Songs (VLLM)
      if (isSignedIn) {
        try {
          await innertubeService.rate(song.videoId, isLiked ? 'INDIFFERENT' : 'LIKE');
        } catch (e) {
          console.warn('Real YouTube Music rate error:', e);
        }
      }
    },

    logout: () => {
      localStorage.removeItem('yz_yt_account');
      localStorage.removeItem('yz_yt_cookie');
      localStorage.removeItem('yz_yt_access_token');
      localStorage.removeItem('yz_yt_refresh_token');
      localStorage.removeItem('yz_yt_channels');
      localStorage.removeItem('yz_yt_active_channel');
      localStorage.removeItem('yz_yt_page_id');
      localStorage.removeItem('yz_yt_datasync_id');

      innertubeService.setCookie(null);
      innertubeService.setAccessToken(null);
      innertubeService.setActiveChannel(null, null);

      set((state) => ({
        account: null,
        cookie: null,
        channels: [],
        activeChannel: null,
        isSignedIn: false,
        likedSongs: [],
        library: null,
        error: null,
        feedRefreshTrigger: state.feedRefreshTrigger + 1,
      }));
    },

    setLastfm: (enabled: boolean, username?: string) => {
      localStorage.setItem('yz_lastfm_enabled', String(enabled));
      if (username !== undefined) localStorage.setItem('yz_lastfm_username', username);
      set({
        lastfmEnabled: enabled,
        lastfmUsername: username !== undefined ? username : get().lastfmUsername,
      });
    },

    setListenBrainz: (enabled: boolean, token?: string) => {
      localStorage.setItem('yz_listenbrainz_enabled', String(enabled));
      if (token !== undefined) localStorage.setItem('yz_listenbrainz_token', token);
      set({
        listenBrainzEnabled: enabled,
        listenBrainzToken: token !== undefined ? token : get().listenBrainzToken,
      });
    },
  };
});
