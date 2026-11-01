/**
 * YZ Music Web - Innertube & YouTube Music API Client
 * Replicates YtMusicRepository.kt and Innertube.kt for browser environment
 */

import {
  HomeFeed,
  HomeShelf,
  HomeChip,
  ShelfItem,
  ShelfType,
  SearchResult,
  SearchFilterType,
  SEARCH_FILTERS,
  DetailPage,
  Song,
  Account,
  AccountChannel,
  LibraryPage,
} from '../types';
import { trendingService, DEFAULT_HOME_CHIPS } from './trendingService';

const INNERTUBE_BASE = '/api/innertube';

interface RequestContext {
  client: {
    clientName: string;
    clientVersion: string;
    hl: string;
    gl: string;
  };
}

const DEFAULT_CONTEXT: RequestContext = {
  client: {
    clientName: 'WEB_REMIX',
    clientVersion: '1.20250101.01.00',
    hl: 'en',
    gl: 'US',
  },
};

export class InnertubeService {
  private cookie: string | null = null;
  private accessToken: string | null = null;
  private activePageId: string | null = null;
  private activeDataSyncId: string | null = null;

  constructor() {
    this.cookie = localStorage.getItem('yz_yt_cookie');
    this.accessToken = localStorage.getItem('yz_yt_access_token');
    this.activePageId = localStorage.getItem('yz_yt_page_id');
    this.activeDataSyncId = localStorage.getItem('yz_yt_datasync_id');
  }

  public setAccessToken(token: string | null) {
    this.accessToken = token;
    if (token) {
      localStorage.setItem('yz_yt_access_token', token);
    } else {
      localStorage.removeItem('yz_yt_access_token');
    }
  }

  public getAccessToken(): string | null {
    return this.accessToken;
  }

  public setCookie(cookie: string | null) {
    this.cookie = cookie;
    if (cookie) {
      localStorage.setItem('yz_yt_cookie', cookie);
    } else {
      localStorage.removeItem('yz_yt_cookie');
      this.setActiveChannel(null, null);
    }
  }

  public setActiveChannel(pageId: string | null, dataSyncId: string | null) {
    this.activePageId = pageId;
    this.activeDataSyncId = dataSyncId;
    if (pageId) {
      localStorage.setItem('yz_yt_page_id', pageId);
    } else {
      localStorage.removeItem('yz_yt_page_id');
    }
    if (dataSyncId) {
      localStorage.setItem('yz_yt_datasync_id', dataSyncId);
    } else {
      localStorage.removeItem('yz_yt_datasync_id');
    }
  }

  public sapisidFrom(cookieHeader: string | null): string | null {
    if (!cookieHeader) return null;
    const parts = cookieHeader.split(';');
    const jar: Record<string, string> = {};
    for (const part of parts) {
      const [rawName, ...rest] = part.split('=');
      const name = rawName?.trim();
      const value = rest.join('=').trim();
      if (name && value) {
        jar[name] = value;
      }
    }
    return jar['SAPISID'] || jar['__Secure-3PAPISID'] || jar['__Secure-1PAPISID'] || null;
  }

  public hasApiSid(cookieHeader: string | null): boolean {
    return !!this.sapisidFrom(cookieHeader);
  }

  public async calculateSapisidHash(sapisid: string, origin = 'https://music.youtube.com'): Promise<string> {
    const timestamp = Math.floor(Date.now() / 1000);
    const msg = `${timestamp} ${sapisid} ${origin}`;
    const buffer = new TextEncoder().encode(msg);
    const digestBuffer = await crypto.subtle.digest('SHA-1', buffer);
    const digestArray = Array.from(new Uint8Array(digestBuffer));
    const digestHex = digestArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    return `SAPISIDHASH ${timestamp}_${digestHex}`;
  }

  private async post(endpoint: string, body: Record<string, any>): Promise<any> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    } else if (this.cookie) {
      headers['x-yt-cookie'] = this.cookie;
      const sapisid = this.sapisidFrom(this.cookie);
      if (sapisid) {
        try {
          headers['Authorization'] = await this.calculateSapisidHash(sapisid);
        } catch (e) {
          console.warn('SAPISIDHASH generation skipped:', e);
        }
      }
      if (this.activePageId) {
        headers['X-Goog-PageId'] = this.activePageId;
      }
    }

    const clientContext = this.accessToken
      ? {
          clientName: 'TVHTML5',
          clientVersion: '7.20260707.07.00',
          hl: 'en',
          gl: 'US',
        }
      : DEFAULT_CONTEXT.client;

    const payload = {
      context: {
        client: clientContext,
        user: {
          lockedSafetyMode: false,
          ...(this.activeDataSyncId ? { onBehalfOfUser: this.activeDataSyncId } : {}),
        },
      },
      ...body,
    };

    const res = await fetch(`${INNERTUBE_BASE}/${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`Innertube request to ${endpoint} failed with status ${res.status}`);
    }

    return res.json();
  }

  /**
   * Home Feed: Listen Now shelves + Recently Played + Dynamic Trending & Chips
   */
  public async getHome(params?: string): Promise<HomeFeed> {
    const body: any = { browseId: 'FEmusic_home' };
    if (params) {
      body.params = params;
    }

    const [homeRaw, historySongs] = await Promise.allSettled([
      this.post('browse', body),
      !params && (this.cookie || this.accessToken) ? this.getHistory() : Promise.resolve([]),
    ]);

    const homeFeed =
      homeRaw.status === 'fulfilled'
        ? this.parseHome(homeRaw.value)
        : { shelves: [], continuation: null, chips: [] };

    // Ensure chips are available
    if (!homeFeed.chips || homeFeed.chips.length === 0) {
      homeFeed.chips = [...DEFAULT_HOME_CHIPS];
    } else {
      const existingIds = new Set(homeFeed.chips.map((c) => c.id));
      for (const def of DEFAULT_HOME_CHIPS) {
        if (!existingIds.has(def.id)) {
          homeFeed.chips.push(def);
        }
      }
    }

    // When on default 'All' feed, ensure dynamic trend shelves are ALWAYS present every time
    if (!params) {
      const hasQuickPicks = homeFeed.shelves.some(
        (s) => s.type === 'QUICK_PICKS' || /quick picks|quick plays/i.test(s.title)
      );
      if (!hasQuickPicks) {
        homeFeed.shelves.unshift(trendingService.getQuickPicksShelf());
      }

      const hasHits = homeFeed.shelves.some((s) => /today's hits|top hits/i.test(s.title));
      if (!hasHits) {
        homeFeed.shelves.splice(1, 0, trendingService.getHitsShelf());
      }

      const hasNewReleases = homeFeed.shelves.some((s) => /new release|fresh drop/i.test(s.title));
      if (!hasNewReleases) {
        homeFeed.shelves.splice(2, 0, trendingService.getNewReleasesShelf());
      }

      const hasVideos = homeFeed.shelves.some((s) => s.type === 'VIDEO' || /music video|video song/i.test(s.title));
      if (!hasVideos) {
        homeFeed.shelves.splice(3, 0, trendingService.getMusicVideosShelf());
      }

      const hasCovers = homeFeed.shelves.some((s) => /cover|remix/i.test(s.title));
      if (!hasCovers) {
        homeFeed.shelves.splice(4, 0, trendingService.getCoversRemixesShelf());
      }

      const hasCommunity = homeFeed.shelves.some((s) => /community/i.test(s.title));
      if (!hasCommunity) {
        homeFeed.shelves.splice(5, 0, trendingService.getTrendingCommunityShelf());
      }

      const hasRegional = homeFeed.shelves.some(
        (s) => /south|blockbusters|spotlight|regional/i.test(s.title)
      );
      if (!hasRegional) {
        homeFeed.shelves.splice(6, 0, trendingService.getRegionalSpotlightShelf());
      }

      const hasSeasonal = homeFeed.shelves.some(
        (s) => /diwali|festive|season|bash/i.test(s.title)
      );
      if (!hasSeasonal) {
        homeFeed.shelves.splice(7, 0, trendingService.getSeasonalShelf());
      }
    }

    if (!params && historySongs.status === 'fulfilled' && historySongs.value.length > 0) {
      const recentItems: ShelfItem[] = historySongs.value.slice(0, 15).map((song) => ({
        title: song.title,
        subtitle: song.artist,
        thumbnailUrl: song.thumbnailUrl,
        videoId: song.videoId,
      }));

      // Lead shelf: account's listening history matching YtMusicRepository.kt
      homeFeed.shelves.unshift({
        title: 'Recently played',
        subtitle: 'From your listening history',
        items: recentItems,
        type: 'DEFAULT' as any,
      });
    }

    return homeFeed;
  }

  /**
   * Account's Listening History (FEmusic_history)
   */
  public async getHistory(): Promise<Song[]> {
    try {
      const raw = await this.post('browse', { browseId: 'FEmusic_history' });
      const detail = this.parseDetail('FEmusic_history', raw);
      return detail.songs || [];
    } catch {
      return [];
    }
  }

  /**
   * Paging continuation for Home Feed
   */
  public async getMoreHome(continuationToken: string): Promise<HomeFeed> {
    const raw = await this.post('browse', { continuation: continuationToken });
    return this.parseHome(raw);
  }

  /**
   * Explore Feed: Trending, Charts, Moods & Genres
   */
  public async getExplore(): Promise<HomeShelf[]> {
    const [exploreRaw, chartsRaw] = await Promise.allSettled([
      this.post('browse', { browseId: 'FEmusic_explore' }),
      this.post('browse', { browseId: 'FEmusic_charts' }),
    ]);

    const exploreShelves = exploreRaw.status === 'fulfilled' ? this.parseShelves(exploreRaw.value) : [];
    const chartsShelves = chartsRaw.status === 'fulfilled' ? this.parseShelves(chartsRaw.value) : [];

    return [...exploreShelves, ...chartsShelves];
  }

  /**
   * Search Catalogue with Filters (All, Songs, Videos, Albums, Artists, Playlists)
   */
  public async search(query: string, filter: SearchFilterType = 'ALL'): Promise<SearchResult[]> {
    const params = SEARCH_FILTERS[filter]?.params;
    const body: Record<string, any> = { query };
    if (params) body.params = params;

    const raw = await this.post('search', body);
    return this.parseSearchResults(raw);
  }

  /**
   * Search Query Auto-Suggestions
   */
  public async getSearchSuggestions(query: string): Promise<string[]> {
    try {
      const raw = await this.post('music/get_search_suggestions', {
        input: query,
      });
      const renderers = this.collectRenderers(raw, 'searchSuggestionRenderer');
      const seen = new Set<string>();
      const suggestions: string[] = [];
      for (const r of renderers) {
        const text =
          r?.navigationEndpoint?.searchEndpoint?.query ||
          r?.suggestion?.runs?.map((part: any) => part?.text || '').join('') ||
          r?.suggestion?.simpleText ||
          '';
        const cleaned = text.trim();
        if (cleaned && !seen.has(cleaned.toLowerCase())) {
          seen.add(cleaned.toLowerCase());
          suggestions.push(cleaned);
        }
      }
      return suggestions;
    } catch {
      return [];
    }
  }

  /**
   * Live media typeahead results (parallel with suggestions)
   */
  public async searchTypeahead(query: string): Promise<SearchResult[]> {
    try {
      const raw = await this.post('search', { query });
      const results = this.parseSearchResults(raw);
      return results.slice(0, 5);
    } catch {
      return [];
    }
  }

  /**
   * Browse Detail: Album, Artist, or Playlist
   */
  public async getBrowse(
    browseId: string,
    params?: string,
    initialInfo?: { title?: string; subtitle?: string; thumbnailUrl?: string | null; type?: any }
  ): Promise<DetailPage> {
    const body: Record<string, any> = { browseId };
    if (params) body.params = params;
    const raw = await this.post('browse', body);
    return this.parseDetail(browseId, raw, initialInfo);
  }

  /**
   * Next / Radio Recommendations for Autoplay Queue & Related Tracks
   * Mirrors Innertube.kt:574 (RDAMVM$videoId radio mix with isAudioOnly: true)
   */
  public async getNext(videoId: string, playlistId?: string): Promise<Song[]> {
    const radioPlaylistId = playlistId || `RDAMVM${videoId}`;
    const body: Record<string, any> = {
      videoId,
      playlistId: radioPlaylistId,
      isAudioOnly: true,
    };

    try {
      const raw = await this.post('next', body);
      const songs = this.parseNextSongs(raw);
      if (songs.length > 0) return songs;
    } catch (e) {
      console.warn('Innertube getNext primary post failed:', e);
    }

    // Fallback: request without RDAMVM if primary returned nothing
    if (!playlistId) {
      try {
        const raw = await this.post('next', { videoId });
        const songs = this.parseNextSongs(raw);
        if (songs.length > 0) return songs;
      } catch (e) {
        console.warn('Innertube getNext fallback attempt failed:', e);
      }
    }

    return [];
  }

  /**
   * Fetch official lyrics from YouTube Music via Innertube (supports timed synced lyrics & plain)
   */
  public async getLyricsDetailed(videoId: string): Promise<{ text: string | null; lines?: { startTimeMs: number; endTimeMs: number; words: string }[] } | null> {
    try {
      const nextRaw = await this.post('next', { videoId });
      const tabs =
        nextRaw?.contents?.singleColumnMusicWatchNextResultsRenderer?.tabbedRenderer?.watchNextTabbedResultsRenderer?.tabs;
      if (!Array.isArray(tabs)) return null;

      let lyricsBrowseId: string | null = null;
      for (const tab of tabs) {
        const tr = tab?.tabRenderer;
        const titleText = tr?.title?.runs?.[0]?.text || tr?.title || '';
        if (/lyrics/i.test(titleText) && tr?.endpoint?.browseEndpoint?.browseId) {
          lyricsBrowseId = tr.endpoint.browseEndpoint.browseId;
          break;
        }
      }

      if (!lyricsBrowseId) return null;

      const browseRaw = await this.post('browse', { browseId: lyricsBrowseId });

      // 1. Check for official timed synced lyrics (Musixmatch stream on YouTube Music)
      const timedRenderers = [
        ...this.collectRenderers(browseRaw, 'musicTimedLyricsRenderer'),
        ...this.collectRenderers(browseRaw, 'timedLyricsRenderer'),
      ];
      if (timedRenderers.length > 0) {
        const timedData = timedRenderers[0];
        const rawLines = timedData?.lyricLines || timedData?.lines || timedData?.timedLyricsData?.lines || [];
        if (Array.isArray(rawLines) && rawLines.length > 0) {
          const lines = rawLines.map((l: any) => ({
            startTimeMs: Number(l.cueRange?.startTimeMilliseconds || l.startTimeMs || l.cueRange?.startTimeMs || 0),
            endTimeMs: Number(l.cueRange?.endTimeMilliseconds || l.endTimeMs || l.cueRange?.endTimeMs || 0),
            words: (l.lyricLine?.runs?.map((r: any) => r.text).join('') || l.lyricLine || l.text || '').trim(),
          })).filter((l: any) => l.words.length > 0);

          if (lines.length > 0) {
            return {
              text: lines.map((l: any) => l.words).join('\n'),
              lines,
            };
          }
        }
      }

      // 2. Fallback to description shelf renderer (plain text lyrics)
      const descShelves = this.collectRenderers(browseRaw, 'musicDescriptionShelfRenderer');
      if (descShelves && descShelves.length > 0) {
        const runs = descShelves[0]?.description?.runs;
        let text = '';
        if (Array.isArray(runs)) {
          text = runs.map((r: any) => r.text || '').join('');
        } else {
          text = descShelves[0]?.description?.simpleText || '';
        }
        return { text: text || null };
      }
      return null;
    } catch (e) {
      console.warn('Innertube lyrics retrieval failed', e);
      return null;
    }
  }

  public async getLyrics(videoId: string): Promise<string | null> {
    const res = await this.getLyricsDetailed(videoId);
    return res?.text || null;
  }

  /**
   * Stream URL Resolution with multi-source fallback (JioSaavn 320k -> Innertube -> Piped)
   */
  public async resolveAudioStream(videoId: string): Promise<string> {
    // Direct stream resolution if needed
    try {
      const playerResponse = await this.post('player', {
        videoId,
        context: {
          client: {
            clientName: 'TVHTML5',
            clientVersion: '7.20260707.07.00',
            hl: 'en',
            gl: 'US',
          },
        },
      });

      const formats = [
        ...(playerResponse?.streamingData?.adaptiveFormats || []),
        ...(playerResponse?.streamingData?.formats || []),
      ];

      const audioFormats = formats.filter((f: any) => f.mimeType?.startsWith('audio/') && f.url);
      audioFormats.sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));

      if (audioFormats.length > 0 && audioFormats[0].url) {
        return audioFormats[0].url;
      }
    } catch (e) {
      console.warn('Innertube player resolution error', e);
    }

    return '';
  }

  // ---- Parsers ----

  private parseHome(json: any): HomeFeed {
    const shelves = this.parseShelves(json);
    const continuation = this.extractContinuationToken(json);
    const chips = this.parseChips(json);
    return { shelves, continuation, chips };
  }

  private parseChips(json: any): HomeChip[] {
    const rawChips = this.collectRenderers(json, 'chipCloudChipRenderer');
    if (!Array.isArray(rawChips) || rawChips.length === 0) return [];

    const chips: HomeChip[] = [];
    for (const c of rawChips) {
      const title =
        c?.text?.runs?.[0]?.text ||
        c?.text?.simpleText ||
        '';
      if (!title) continue;

      const endpoint = c?.navigationEndpoint?.browseEndpoint;
      chips.push({
        id: title.toLowerCase().replace(/\s+/g, '_'),
        title,
        params: endpoint?.params || null,
        browseId: endpoint?.browseId || null,
      });
    }
    return chips;
  }

  private parseShelves(json: any): HomeShelf[] {
    const rawSectionList =
      json?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents ||
      json?.continuationContents?.sectionListContinuation?.contents ||
      [];

    const sectionList = rawSectionList.length > 0
      ? rawSectionList
      : [
          ...this.collectRenderers(json, 'musicCarouselShelfRenderer').map(r => ({ musicCarouselShelfRenderer: r })),
          ...this.collectRenderers(json, 'musicImmersiveCarouselShelfRenderer').map(r => ({ musicImmersiveCarouselShelfRenderer: r })),
          ...this.collectRenderers(json, 'musicShelfRenderer').map(r => ({ musicShelfRenderer: r })),
        ];

    const shelves: HomeShelf[] = [];

    for (const section of sectionList) {
      const shelfRenderer =
        section?.musicCarouselShelfRenderer ||
        section?.musicImmersiveCarouselShelfRenderer ||
        section?.musicShelfRenderer ||
        section?.gridRenderer;

      if (!shelfRenderer) continue;

      const header =
        shelfRenderer?.header?.musicCarouselShelfBasicHeaderRenderer ||
        shelfRenderer?.header?.gridHeaderRenderer ||
        shelfRenderer?.header;

      const title =
        header?.title?.runs?.[0]?.text ||
        shelfRenderer?.title?.runs?.[0]?.text ||
        '';

      const strapline =
        header?.strapline?.runs?.map((r: any) => r.text).join('') ||
        shelfRenderer?.strapline?.runs?.map((r: any) => r.text).join('') ||
        '';

      const subtitle = strapline;

      const moreEndpoint =
        header?.moreContentButton?.buttonRenderer?.navigationEndpoint?.browseEndpoint ||
        header?.title?.runs?.[0]?.navigationEndpoint?.browseEndpoint ||
        shelfRenderer?.bottomEndpoint?.browseEndpoint;

      const moreBrowseId = moreEndpoint?.browseId || null;
      const moreParams = moreEndpoint?.params || null;

      const items: ShelfItem[] = [];
      const contents = shelfRenderer?.contents || shelfRenderer?.items || [];

      for (const item of contents) {
        // 1. Navigation Button (Moods & Genres, category buttons)
        if (item?.musicNavigationButtonRenderer) {
          const nb = item.musicNavigationButtonRenderer;
          const nbTitle = nb?.buttonText?.runs?.[0]?.text || '';
          const endpoint = nb?.clickCommand?.browseEndpoint;
          const stripeColor = nb?.solid?.leftStripeColor || null;
          if (nbTitle) {
            items.push({
              title: nbTitle,
              subtitle: '',
              thumbnailUrl: null,
              videoId: null,
              browseId: endpoint?.browseId || null,
              params: endpoint?.params || null,
              stripeColor: stripeColor ? Number(stripeColor) : null,
            });
          }
          continue;
        }

        const renderer =
          item?.musicTwoRowItemRenderer ||
          item?.musicResponsiveListItemRenderer ||
          item?.musicMultiRowListItemRenderer;

        if (!renderer) continue;

        const itemTitle =
          renderer?.title?.runs?.[0]?.text ||
          renderer?.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text ||
          '';

        const itemSubtitle =
          renderer?.subtitle?.runs?.map((r: any) => r.text).join('') ||
          renderer?.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.map((r: any) => r.text).join('') ||
          '';

        const thumb =
          renderer?.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)[0]?.url ||
          renderer?.thumbnailRenderer?.musicMosaicThumbnailRenderer?.thumbnails?.slice(-1)[0]?.url ||
          renderer?.thumbnailRenderer?.musicCustomThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)[0]?.url ||
          renderer?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)[0]?.url ||
          renderer?.thumbnail?.croppedSquareThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)[0]?.url ||
          renderer?.thumbnail?.thumbnails?.slice(-1)[0]?.url ||
          null;

        const watchEndpoint =
          renderer?.navigationEndpoint?.watchEndpoint ||
          renderer?.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint ||
          (renderer?.playlistItemData?.videoId ? { videoId: renderer.playlistItemData.videoId } : null) ||
          renderer?.onTap?.watchEndpoint;

        const browseEndpoint =
          renderer?.navigationEndpoint?.browseEndpoint ||
          renderer?.title?.runs?.[0]?.navigationEndpoint?.browseEndpoint ||
          renderer?.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.navigationEndpoint?.browseEndpoint ||
          renderer?.onTap?.browseEndpoint;

        const customIndex =
          renderer?.customIndexColumn?.musicCustomIndexColumnRenderer?.text?.runs?.[0]?.text || null;

        const isVideo =
          (watchEndpoint?.videoId != null &&
            (itemSubtitle.toLowerCase().includes('video') ||
              itemSubtitle.toLowerCase().includes('views') ||
              renderer?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.some((t: any) => t.width > t.height * 1.5))) ||
          false;

        items.push({
          title: itemTitle,
          subtitle: itemSubtitle,
          thumbnailUrl: thumb,
          videoId: watchEndpoint?.videoId || null,
          browseId: browseEndpoint?.browseId || null,
          params: browseEndpoint?.params || null,
          customIndex,
          isVideo,
        });
      }

      if (items.length > 0) {
        let type: ShelfType = 'DEFAULT';
        const allNoThumbnails = items.every((it) => it.thumbnailUrl == null);
        if (
          allNoThumbnails &&
          (items.every((it) => it.browseId?.startsWith('FEmusic_') || it.stripeColor != null || it.videoId == null) ||
            title.toLowerCase() === 'explore' ||
            title.toLowerCase() === 'navigation')
        ) {
          type = 'NAV_CHIPS';
        } else if (/quick picks|quick plays/i.test(title)) {
          type = 'QUICK_PICKS';
        } else if (section?.musicImmersiveCarouselShelfRenderer) {
          type = 'HERO';
        } else if (items.some((it) => it.stripeColor != null || it.browseId?.startsWith('FEmusic_moods_and_genres'))) {
          type = 'MOOD_GENRE';
        } else if (items.some((it) => it.customIndex != null) || /trending|top|chart/i.test(title)) {
          if (items.some((it) => it.browseId?.startsWith('UC') || it.subtitle?.toLowerCase().includes('subscriber'))) {
            type = 'CHART_ARTISTS';
          } else if (/video/i.test(title) || (items.length > 0 && items.every((it) => it.isVideo))) {
            type = 'CHART_VIDEOS';
          } else if (/song/i.test(title) || items.some((it) => it.videoId)) {
            type = 'CHART_SONGS';
          } else {
            type = 'RANKED';
          }
        } else if (/video/i.test(title) || (items.length > 0 && items.every((it) => it.isVideo && it.videoId))) {
          type = 'VIDEO';
        }

        shelves.push({
          title: title || (type === 'NAV_CHIPS' ? 'Navigation' : 'Featured'),
          subtitle,
          strapline: strapline || undefined,
          type,
          moreBrowseId,
          moreParams,
          items,
        });
      }
    }

    return shelves;
  }

  private collectRenderers(root: any, name: string): any[] {
    const out: any[] = [];
    function walk(node: any) {
      if (!node || typeof node !== 'object') return;
      if (node[name]) out.push(node[name]);
      if (Array.isArray(node)) {
        for (const item of node) walk(item);
      } else {
        for (const key of Object.keys(node)) walk(node[key]);
      }
    }
    walk(root);
    return out;
  }

  private parseSearchResults(json: any): SearchResult[] {
    const cardItems = this.collectRenderers(json, 'musicCardShelfRenderer');
    const responsiveItems = this.collectRenderers(json, 'musicResponsiveListItemRenderer');

    const results: SearchResult[] = [];
    const seen = new Set<string>();

    // Promoted Card result if present (TopTrack or TopBrowse)
    for (const card of cardItems) {
      const videoId = card?.onTap?.watchEndpoint?.videoId || card?.buttons?.[0]?.buttonRenderer?.navigationEndpoint?.watchEndpoint?.videoId;
      const browseId = card?.onTap?.browseEndpoint?.browseId;
      const title = card?.title?.runs?.map((r: any) => r.text).join('') || '';
      const subtitle = card?.subtitle?.runs?.map((r: any) => r.text).join('') || '';
      const thumbs = card?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails || [];
      const thumb = thumbs.length > 0 ? thumbs[thumbs.length - 1].url : null;

      if (videoId && !seen.has(`v:${videoId}`)) {
        seen.add(`v:${videoId}`);
        results.push({
          type: 'TopTrack',
          song: {
            videoId,
            title,
            artist: subtitle || 'YouTube Music',
            thumbnailUrl: thumb,
          },
        });
      } else if (browseId && !seen.has(`b:${browseId}`)) {
        seen.add(`b:${browseId}`);
        const isArtist = browseId.startsWith('UC') || subtitle.toLowerCase().includes('artist');
        const isPlaylist = browseId.startsWith('VL') || browseId.startsWith('PL') || subtitle.toLowerCase().includes('playlist');
        results.push({
          type: 'Browse',
          item: {
            browseId,
            title,
            subtitle,
            thumbnailUrl: thumb,
            type: isArtist ? 'ARTIST' : isPlaylist ? 'PLAYLIST' : 'ALBUM',
          },
        });
      }
    }

    for (const r of responsiveItems) {
      const videoId =
        r.playlistItemData?.videoId ||
        r.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint?.videoId ||
        r.navigationEndpoint?.watchEndpoint?.videoId ||
        r.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.navigationEndpoint?.watchEndpoint?.videoId;

      const browseId =
        r.navigationEndpoint?.browseEndpoint?.browseId ||
        r.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId;

      const title =
        r.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text ||
        r.title?.runs?.[0]?.text ||
        '';

      const artist =
        r.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text ||
        r.subtitle?.runs?.[0]?.text ||
        '';

      const durationText =
        r.flexColumns?.[2]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text ||
        r.fixedColumns?.[0]?.musicResponsiveListItemFixedColumnRenderer?.text?.runs?.[0]?.text ||
        null;

      const thumbs =
        r.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails ||
        r.thumbnail?.thumbnails ||
        [];
      const thumb = thumbs.length > 0 ? thumbs[thumbs.length - 1].url : null;

      // Classify whether it's a browse entity (Artist, Album, Playlist) or a Track
      const pageType = r.navigationEndpoint?.browseEndpoint?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType || '';
      const isArtist = browseId?.startsWith('UC') || pageType.includes('ARTIST') || artist.toLowerCase().includes('artist');
      const isPlaylist = browseId?.startsWith('VL') || browseId?.startsWith('PL') || pageType.includes('PLAYLIST') || artist.toLowerCase().includes('playlist');
      const isAlbum = browseId?.startsWith('MPREb_') || pageType.includes('ALBUM') || artist.toLowerCase().includes('album') || artist.toLowerCase().includes('single');

      if ((isArtist || isPlaylist || isAlbum) && browseId && !seen.has(`b:${browseId}`)) {
        seen.add(`b:${browseId}`);
        results.push({
          type: 'Browse',
          item: {
            browseId,
            title,
            subtitle: artist,
            thumbnailUrl: thumb,
            type: isArtist ? 'ARTIST' : isPlaylist ? 'PLAYLIST' : 'ALBUM',
          },
        });
      } else if (videoId && !seen.has(`v:${videoId}`)) {
        seen.add(`v:${videoId}`);
        results.push({
          type: 'Track',
          song: {
            videoId,
            title,
            artist: artist || 'YouTube Music',
            thumbnailUrl: thumb,
            durationText,
          },
        });
      } else if (browseId && !seen.has(`b:${browseId}`)) {
        seen.add(`b:${browseId}`);
        results.push({
          type: 'Browse',
          item: {
            browseId,
            title,
            subtitle: artist,
            thumbnailUrl: thumb,
            type: 'OTHER',
          },
        });
      }
    }

    return results;
  }

  private parseDetail(
    browseId: string,
    json: any,
    initialInfo?: { title?: string; subtitle?: string; thumbnailUrl?: string | null; type?: any }
  ): DetailPage {
    const headerRenderers = [
      'musicResponsiveHeaderRenderer',
      'musicDetailHeaderRenderer',
      'musicEditablePlaylistDetailHeaderRenderer',
      'musicVisualHeaderRenderer',
      'musicImmersiveHeaderRenderer',
      'musicHeaderRenderer',
    ];

    let header: any = null;
    for (const hName of headerRenderers) {
      const found = this.collectRenderers(json, hName);
      if (found.length > 0) {
        if (found[0]?.header?.musicResponsiveHeaderRenderer) {
          header = found[0].header.musicResponsiveHeaderRenderer;
        } else if (found[0]?.header?.musicDetailHeaderRenderer) {
          header = found[0].header.musicDetailHeaderRenderer;
        } else if (found[0]?.header) {
          header = found[0].header;
        } else {
          header = found[0];
        }
        break;
      }
    }

    const defaultTitle =
      initialInfo?.title ||
      (browseId === 'FEmusic_charts'
        ? 'Charts'
        : browseId === 'FEmusic_new_releases'
        ? 'New Releases'
        : browseId.includes('moods_and_genres')
        ? 'Moods & Genres'
        : 'Collection');

    const title =
      header?.title?.runs?.map((r: any) => r.text).join('') ||
      header?.title?.text ||
      json?.header?.musicHeaderRenderer?.title?.runs?.[0]?.text ||
      defaultTitle;

    const subtitle =
      header?.straplineTextOne?.runs?.map((r: any) => r.text).join('') ||
      header?.subtitle?.runs?.map((r: any) => r.text).join('') ||
      header?.secondTitle?.runs?.map((r: any) => r.text).join('') ||
      initialInfo?.subtitle ||
      '';

    const headerThumbs =
      header?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails ||
      header?.thumbnail?.croppedSquareThumbnailRenderer?.thumbnail?.thumbnails ||
      header?.thumbnail?.musicCustomThumbnailRenderer?.thumbnail?.thumbnails ||
      header?.thumbnail?.musicMosaicThumbnailRenderer?.thumbnails ||
      header?.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails ||
      header?.thumbnailRenderer?.musicMosaicThumbnailRenderer?.thumbnails ||
      header?.thumbnailRenderer?.musicCustomThumbnailRenderer?.thumbnail?.thumbnails ||
      header?.foregroundThumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails ||
      header?.thumbnail?.thumbnails ||
      [];
    let rawThumb: string | null = null;
    if (Array.isArray(headerThumbs) && headerThumbs.length > 0) {
      const last = headerThumbs[headerThumbs.length - 1];
      rawThumb = typeof last === 'string' ? last : (last?.url || null);
    }
    if (rawThumb && rawThumb.startsWith('//')) {
      rawThumb = 'https:' + rawThumb;
    }
    let thumb = rawThumb || initialInfo?.thumbnailUrl || null;
    if (thumb && thumb.startsWith('//')) {
      thumb = 'https:' + thumb;
    }

    const responsiveItems = this.collectRenderers(json, 'musicResponsiveListItemRenderer');
    const multiRowItems = this.collectRenderers(json, 'musicMultiRowListItemRenderer');
    const allItems = [...responsiveItems, ...multiRowItems];

    const songs: Song[] = [];
    const seen = new Set<string>();

    for (const r of allItems) {
      const videoId =
        r.playlistItemData?.videoId ||
        r.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint?.videoId ||
        r.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchPlaylistEndpoint?.videoId ||
        r.navigationEndpoint?.watchEndpoint?.videoId ||
        r.doubleTapEndpoint?.watchEndpoint?.videoId ||
        r.onTap?.watchEndpoint?.videoId ||
        r.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.navigationEndpoint?.watchEndpoint?.videoId;

      if (!videoId || seen.has(videoId)) continue;
      seen.add(videoId);

      const songTitle =
        r.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text ||
        r.title?.runs?.[0]?.text ||
        '';

      const subtitleRuns =
        r.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs ||
        r.subtitle?.runs ||
        [];
      const fullSubtitle = subtitleRuns.map((x: any) => x.text).join('');
      const parts = fullSubtitle.split(' • ').map((s: string) => s.trim());

      const artist =
        r.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text ||
        r.secondTitle?.runs?.[0]?.text ||
        (parts.length > 0 && !parts[0].includes(':') ? parts[0] : null) ||
        subtitle ||
        title ||
        'Unknown Artist';

      // Duration text from fixedColumns or parts
      const durationFromFixed =
        r.fixedColumns?.[0]?.musicResponsiveListItemFixedColumnRenderer?.text?.runs?.[0]?.text;
      const durationFromParts = parts.find((p: string) => /^\d+:\d+$/.test(p));
      const durationText = durationFromFixed || durationFromParts || '';

      const thumbs =
        r.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails ||
        r.thumbnail?.croppedSquareThumbnailRenderer?.thumbnail?.thumbnails ||
        r.thumbnail?.thumbnails ||
        [];
      let songThumb = thumbs.length > 0 ? thumbs[thumbs.length - 1].url : thumb;
      if (songThumb && songThumb.startsWith('//')) {
        songThumb = 'https:' + songThumb;
      }

      songs.push({
        videoId,
        title: songTitle || 'Unknown Title',
        artist,
        thumbnailUrl: songThumb,
        albumName: title,
        durationText,
      });
    }

    // If playlist or album header thumbnail was missing, fall back to the first song's high-res thumbnail!
    if ((!thumb || thumb === '/logo.svg') && songs.length > 0 && songs[0]?.thumbnailUrl) {
      thumb = songs[0].thumbnailUrl;
    }

    // Backfill any song that lacked a thumbnail with the confirmed collection thumbnail
    if (thumb) {
      for (const s of songs) {
        if (!s.thumbnailUrl || s.thumbnailUrl === '/logo.svg') {
          s.thumbnailUrl = thumb;
        }
      }
    }

    const shelves = this.parseShelves(json);

    let type: any = initialInfo?.type || 'OTHER';
    if (browseId.startsWith('UC')) type = 'ARTIST';
    else if (browseId.startsWith('VL') || browseId.startsWith('PL')) type = 'PLAYLIST';
    else if (browseId.startsWith('MPREb_')) type = 'ALBUM';
    else if (browseId === 'FEmusic_charts') type = 'CHARTS';
    else if (browseId === 'FEmusic_new_releases' || browseId === 'FEmusic_new_releases_albums') type = 'NEW_RELEASES_GRID';
    else if (browseId.includes('moods_and_genres')) type = 'CATEGORY';

    return {
      browseId,
      title,
      subtitle,
      thumbnailUrl: thumb,
      type,
      songs,
      shelves,
    };
  }

  private parseNextSongs(json: any): Song[] {
    const renderers = this.collectRenderers(json, 'playlistPanelVideoRenderer');
    const fallbackContents =
      json?.contents?.singleColumnMusicWatchNextResultsRenderer?.tabbedRenderer?.watchNextTabbedResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.musicQueueRenderer?.content?.playlistPanelRenderer?.contents ||
      [];

    const allRenderers = renderers.length > 0
      ? renderers
      : fallbackContents.map((c: any) => c?.playlistPanelVideoRenderer).filter(Boolean);

    const songs: Song[] = [];
    const seen = new Set<string>();

    for (const r of allRenderers) {
      if (!r) continue;

      const videoId = r.videoId;
      if (!videoId || seen.has(videoId)) continue;

      const title =
        r.title?.runs?.map((run: any) => run.text || '').join('') ||
        r.title?.simpleText ||
        '';
      if (!title.trim()) continue;

      // The byline packs artist, album, views into runs before bullets •
      const bylineRuns: any[] = r.longBylineText?.runs || r.shortBylineText?.runs || [];
      const bylineTexts = bylineRuns.map((run: any) => run.text || '');
      let artist = '';
      for (const text of bylineTexts) {
        if (text.includes('•') || text.includes('·')) break;
        artist += text;
      }
      artist = artist.trim() || bylineTexts[0] || 'Unknown Artist';

      let artistId: string | null = null;
      let albumId: string | null = null;
      let albumName: string | null = null;

      for (const run of bylineRuns) {
        const browse = run.navigationEndpoint?.browseEndpoint;
        const pageType =
          browse?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType || '';
        if (pageType.includes('ARTIST') && !artistId) {
          artistId = browse?.browseId || null;
        }
        if (pageType.includes('ALBUM') && !albumId) {
          albumId = browse?.browseId || null;
          albumName = run.text || null;
        }
      }

      const durationText =
        r.lengthText?.runs?.map((run: any) => run.text || '').join('') ||
        r.lengthText?.simpleText ||
        null;

      const thumb =
        r.thumbnail?.thumbnails?.slice(-1)[0]?.url ||
        `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

      const isExplicit = Boolean(
        r.badges?.some((b: any) =>
          b.musicInlineBadgeRenderer?.accessibilityData?.accessibilityData?.label
            ?.toLowerCase()
            ?.includes('explicit')
        )
      );

      seen.add(videoId);
      songs.push({
        videoId,
        title,
        artist,
        thumbnailUrl: thumb,
        durationText,
        artistId,
        albumId,
        albumName,
        isExplicit,
        fromAutoplay: true,
      });
    }

    return songs;
  }

  /**
   * Account Menu: Signed-in profile (display name, email/handle and avatar)
   */
  public async getAccountMenu(): Promise<{ account: Account; channels: AccountChannel[] } | null> {
    try {
      const raw = await this.post('account/account_menu', {});
      const header = this.collectRenderers(raw, 'activeAccountHeaderRenderer')[0];
      let account: Account | null = null;
      if (header) {
        const name = header.accountName?.runs?.[0]?.text || header.accountName?.simpleText || '';
        const email =
          header.email?.runs?.[0]?.text ||
          header.email?.simpleText ||
          header.channelHandle?.runs?.[0]?.text ||
          header.channelHandle?.simpleText ||
          '';
        const thumb = header.accountPhoto?.thumbnails?.slice(-1)[0]?.url || null;
        if (name) {
          account = { name, email, thumbnailUrl: thumb };
        }
      }

      const channels = this.parseChannels(raw);
      if (account) {
        return { account, channels };
      }
      return null;
    } catch (err) {
      console.warn('getAccountMenu failed:', err);
      return null;
    }
  }

  /**
   * Account Channels: Channels available to act as
   */
  public async getAccountChannels(): Promise<AccountChannel[]> {
    try {
      const raw = await this.post('account/accounts_list', {});
      return this.parseChannels(raw);
    } catch {
      return [];
    }
  }

  /**
   * Library Feed: User's saved playlists, albums, and liked music
   */
  public async getLibrary(): Promise<LibraryPage> {
    const shelves: HomeShelf[] = [];
    let likedSongs: Song[] = [];

    // 1. If signed in via Google OAuth Access Token, fetch from YouTube Data API
    if (this.accessToken) {
      try {
        const [pRes, lRes] = await Promise.allSettled([
          fetch('/api/auth/oauth/playlists', {
            headers: { Authorization: `Bearer ${this.accessToken}` },
          }).then((r) => r.json()),
          fetch('/api/auth/oauth/liked', {
            headers: { Authorization: `Bearer ${this.accessToken}` },
          }).then((r) => r.json()),
        ]);

        if (pRes.status === 'fulfilled' && pRes.value?.items) {
          const items: ShelfItem[] = pRes.value.items.map((pl: any) => ({
            title: pl.snippet?.title || 'Playlist',
            subtitle: `${pl.contentDetails?.itemCount || 0} tracks`,
            browseId: `VL${pl.id}`,
            thumbnailUrl:
              pl.snippet?.thumbnails?.high?.url ||
              pl.snippet?.thumbnails?.medium?.url ||
              pl.snippet?.thumbnails?.default?.url ||
              null,
          }));
          if (items.length > 0) {
            shelves.push({
              title: 'Playlists',
              items,
              type: 'DEFAULT' as any,
            });
          }
        }

        if (lRes.status === 'fulfilled' && lRes.value?.items) {
          likedSongs = lRes.value.items.map((vid: any) => ({
            videoId: vid.id,
            title: vid.snippet?.title || 'Unknown Title',
            artist: vid.snippet?.channelTitle || 'Unknown Artist',
            thumbnailUrl:
              vid.snippet?.thumbnails?.high?.url ||
              vid.snippet?.thumbnails?.medium?.url ||
              vid.snippet?.thumbnails?.default?.url ||
              null,
          }));
        }
      } catch (oauthErr) {
        console.warn('OAuth library fetch warning:', oauthErr);
      }
    }

    // 2. Also fetch Innertube browse endpoints
    try {
      const [playlistsRaw, albumsRaw, likedRaw] = await Promise.allSettled([
        this.post('browse', { browseId: 'FEmusic_liked_playlists' }),
        this.post('browse', { browseId: 'FEmusic_liked_albums' }),
        this.post('browse', { browseId: 'VLLM' }),
      ]);

      if (playlistsRaw.status === 'fulfilled') {
        const pShelves = this.parseShelves(playlistsRaw.value);
        if (pShelves.length > 0) {
          shelves.push(...pShelves);
        }
      }

      if (albumsRaw.status === 'fulfilled') {
        const aShelves = this.parseShelves(albumsRaw.value);
        if (aShelves.length > 0) {
          shelves.push(...aShelves);
        }
      }

      if (likedRaw.status === 'fulfilled') {
        const detail = this.parseDetail('VLLM', likedRaw.value);
        if (detail.songs && detail.songs.length > 0) {
          const existingIds = new Set(likedSongs.map((s) => s.videoId));
          likedSongs = [...detail.songs, ...likedSongs.filter((s) => !existingIds.has(s.videoId))];
        }
      }
    } catch (innertubeErr) {
      console.warn('Innertube library fetch warning:', innertubeErr);
    }

    return {
      likedSongs,
      librarySongs: [],
      shelves,
    };
  }

  /**
   * Rate a song: LIKE, DISLIKE, or INDIFFERENT (removelike)
   * Directly updates user's authentic YouTube Music Liked Songs (VLLM)
   */
  public async rate(videoId: string, status: 'LIKE' | 'DISLIKE' | 'INDIFFERENT'): Promise<boolean> {
    try {
      const endpoint =
        status === 'LIKE' ? 'like/like' : status === 'DISLIKE' ? 'like/dislike' : 'like/removelike';
      await this.post(endpoint, {
        target: { videoId },
      });
      return true;
    } catch (e) {
      console.warn(`Failed to rate song ${videoId}:`, e);
      return false;
    }
  }

  /**
   * Save or remove an album / playlist to/from Library
   */
  public async ratePlaylist(playlistId: string, saved: boolean): Promise<boolean> {
    try {
      const endpoint = saved ? 'like/like' : 'like/removelike';
      const cleanId = playlistId.replace(/^VL/, '');
      await this.post(endpoint, {
        target: { playlistId: cleanId },
      });
      return true;
    } catch (e) {
      console.warn(`Failed to rate playlist ${playlistId}:`, e);
      return false;
    }
  }

  /**
   * Create a playlist on YouTube Music
   */
  public async createPlaylist(
    title: string,
    privacy: 'PRIVATE' | 'PUBLIC' | 'UNLISTED' = 'PRIVATE',
    description = '',
    videoIds: string[] = []
  ): Promise<string | null> {
    try {
      const body: Record<string, any> = {
        title,
        description,
        privacyStatus: privacy,
      };
      if (videoIds.length > 0) {
        body.videoIds = videoIds;
      }
      const res = await this.post('playlist/create', body);
      return res?.playlistId || null;
    } catch (e) {
      console.warn('Failed to create playlist on YouTube Music:', e);
      return null;
    }
  }

  /**
   * Add tracks to an existing playlist (or Watch Later 'WL')
   */
  public async addTracksToPlaylist(playlistId: string, videoIds: string[]): Promise<boolean> {
    try {
      const cleanId = playlistId.replace(/^VL/, '');
      const actions = videoIds.map((id) => ({
        action: 'ACTION_ADD_VIDEO',
        addedVideoId: id,
      }));
      await this.post('browse/edit_playlist', {
        playlistId: cleanId,
        actions,
      });
      return true;
    } catch (e) {
      console.warn(`Failed to add tracks to playlist ${playlistId}:`, e);
      return false;
    }
  }

  /**
   * Remove a track from a playlist
   */
  public async removeTrackFromPlaylist(playlistId: string, setVideoId: string): Promise<boolean> {
    try {
      const cleanId = playlistId.replace(/^VL/, '');
      await this.post('browse/edit_playlist', {
        playlistId: cleanId,
        actions: [
          {
            action: 'ACTION_REMOVE_VIDEO_BY_SET_VIDEO_ID',
            setVideoId,
          },
        ],
      });
      return true;
    } catch (e) {
      console.warn(`Failed to remove track from playlist ${playlistId}:`, e);
      return false;
    }
  }

  private parseChannels(json: any): AccountChannel[] {
    const items = this.collectRenderers(json, 'accountItem');
    const channels: AccountChannel[] = [];
    const seen = new Set<string>();

    for (const item of items) {
      const name = item.accountName?.runs?.[0]?.text || item.accountName?.simpleText || '';
      if (!name) continue;

      let pageId: string | null = null;
      let dataSyncId: string | null = null;

      const str = JSON.stringify(item);
      const pageIdMatch = str.match(/"pageId":"([^"]+)"/);
      if (pageIdMatch) pageId = pageIdMatch[1];
      const dataSyncMatch = str.match(/"datasyncIdToken":"([^"]+)"/);
      if (dataSyncMatch) dataSyncId = dataSyncMatch[1].split('||')[0];

      if (!pageId && !dataSyncId) continue;
      const key = `${name}-${pageId || ''}-${dataSyncId || ''}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const subtitle =
        item.channelHandle?.runs?.[0]?.text ||
        item.channelHandle?.simpleText ||
        item.accountByline?.runs?.[0]?.text ||
        '';
      const thumb = item.accountPhoto?.thumbnails?.slice(-1)[0]?.url || null;
      const activeOnWeb = item.isSelected === true;

      channels.push({
        name,
        subtitle,
        thumbnailUrl: thumb,
        pageId,
        dataSyncId,
        activeOnWeb,
      });
    }

    return channels;
  }

  private extractContinuationToken(json: any): string | null {
    const sectionList =
      json?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.continuations?.[0]?.nextContinuationData?.continuation ||
      json?.continuationContents?.sectionListContinuation?.continuations?.[0]?.nextContinuationData?.continuation ||
      null;
    return sectionList;
  }
}

export const innertubeService = new InnertubeService();

