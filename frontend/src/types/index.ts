/**
 * YZ Music Web - Core TypeScript Types
 * Faithfully mirrors Kotlin Data Models in com.music.yzmusic.data.model
 */

export interface Song {
  videoId: string;
  title: string;
  artist: string;
  thumbnailUrl: string | null;
  durationText?: string | null;
  artistId?: string | null;
  albumId?: string | null;
  albumName?: string | null;
  trackNumber?: number | null;
  isVideo?: boolean;
  setVideoId?: string | null;
  fromAutoplay?: boolean;
  localUri?: string | null;
  localPath?: string | null;
  sourceQuality?: 'LOSSLESS' | 'HIGH' | 'LOW' | null;
  isExplicit?: boolean | null;
  radioName?: string | null;
  downloadFormat?: string | null;
}

export type BrowseType =
  | 'ALBUM'
  | 'ARTIST'
  | 'PLAYLIST'
  | 'CHARTS'
  | 'CATEGORY'
  | 'NEW_RELEASES_GRID'
  | 'OTHER';

export interface BrowseItem {
  browseId: string;
  title: string;
  subtitle: string;
  thumbnailUrl: string | null;
  type: BrowseType;
}

export interface BrowseTarget {
  browseId: string;
  params?: string;
  title?: string;
  subtitle?: string;
  thumbnailUrl?: string | null;
  type?: BrowseType | string;
}

export type SearchResult =
  | { type: 'TopTrack'; song: Song }
  | { type: 'Track'; song: Song }
  | { type: 'Browse'; item: BrowseItem };

export type SearchFilterType = 'ALL' | 'SONGS' | 'VIDEOS' | 'ALBUMS' | 'ARTISTS' | 'PLAYLISTS';

export const SEARCH_FILTERS: Record<SearchFilterType, { label: string; params: string | null }> = {
  ALL: { label: 'All', params: null },
  SONGS: { label: 'Songs', params: 'EgWKAQIIAWoKEAkQChAFEAMQBA==' },
  VIDEOS: { label: 'Videos', params: 'EgWKAQIYAWoKEAkQChAFEAMQBA==' },
  ALBUMS: { label: 'Albums', params: 'EgWKAQIYAWoKEAkQChAFEAMQBA==' },
  ARTISTS: { label: 'Artists', params: 'EgWKAQIgAWoKEAkQChAFEAMQBA==' },
  PLAYLISTS: { label: 'Playlists', params: 'EgWKAQIoAWoKEAkQChAFEAMQBA==' },
};

export type ShelfType =
  | 'DEFAULT'
  | 'HERO'
  | 'MOOD_GENRE'
  | 'RANKED'
  | 'VIDEO'
  | 'CHART_SONGS'
  | 'CHART_ARTISTS'
  | 'CHART_VIDEOS'
  | 'NAV_CHIPS'
  | 'QUICK_PICKS';

export interface HomeChip {
  id: string;
  title: string;
  params?: string | null;
  browseId?: string | null;
  badge?: string;
}

export interface ShelfItem {
  title: string;
  subtitle?: string;
  thumbnailUrl?: string | null;
  videoId?: string | null;
  browseId?: string | null;
  params?: string | null;
  stripeColor?: number | null;
  customIndex?: string | null;
  isVideo?: boolean;
  badge?: string | null;
}

export interface HomeShelf {
  title: string;
  items: ShelfItem[];
  subtitle?: string;
  type?: ShelfType;
  moreBrowseId?: string | null;
  moreParams?: string | null;
  strapline?: string | null;
}

export interface HomeFeed {
  shelves: HomeShelf[];
  continuation: string | null;
  chips?: HomeChip[];
}

export interface DetailPage {
  browseId: string;
  title: string;
  subtitle: string;
  thumbnailUrl: string | null;
  type: BrowseType;
  songs: Song[];
  shelves?: HomeShelf[];
  year?: string | null;
  trackCount?: number | null;
  totalDuration?: string | null;
  description?: string | null;
  isEditable?: boolean;
}

export type LikeStatus = 'LIKE' | 'DISLIKE' | 'INDIFFERENT';

export interface Syllable {
  text: string;
  startTimeMs: number;
  endTimeMs: number;
}

export interface LyricLine {
  startTimeMs: number;
  endTimeMs: number;
  words: string;
  syllables?: Syllable[];
  translation?: string;
}

export type LyricsSource =
  | 'LRCLIB'
  | 'MUSIXMATCH'
  | 'GENIUS'
  | 'KUGOU'
  | 'BETTER_LYRICS'
  | 'EMBEDDED';

export interface LyricsData {
  lines: LyricLine[];
  source: LyricsSource;
  synced: boolean;
  hasSyllables?: boolean;
  error?: string;
}

export interface Account {
  name: string;
  email: string;
  thumbnailUrl: string | null;
}

export interface AccountChannel {
  name: string;
  subtitle: string;
  thumbnailUrl: string | null;
  pageId?: string | null;
  dataSyncId?: string | null;
  activeOnWeb?: boolean;
}

export interface LibraryPage {
  likedSongs: Song[];
  librarySongs: Song[];
  shelves: HomeShelf[];
}

export interface UserPlaylist {
  id: string;
  title: string;
  author: string;
  thumbnailUrl?: string | null;
  songCount: number;
  privacy?: 'PUBLIC' | 'PRIVATE' | 'UNLISTED';
  songs?: Song[];
  description?: string;
}

export type RepeatMode = 'OFF' | 'ALL' | 'ONE';

export interface EqualizerBand {
  frequency: number;
  gain: number; // -12dB to +12dB
}

export interface EqualizerPreset {
  name: string;
  gains: number[]; // 7 or 10 bands
}

export interface BitChordMember {
  memberId: string;
  userId: string;
  deviceId: string;
  displayName: string;
  avatarUrl?: string | null;
  isHost: boolean;
  lastSeenMs: number;
}

export interface BitChordPartyState {
  code: string;
  song: Song | null;
  isPlaying: boolean;
  positionMs: number;
  anchorMs: number;
  members: BitChordMember[];
}

