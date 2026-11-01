/**
 * YZ Music Web - BitChord Listen Together Client
 * Sub-frame accurate party synchronization with server time anchoring
 * Exact protocol match with backend/app/main.py & backend/app/party.py
 */

import { BitChordMember, BitChordPartyState, Song } from '../types';
import { usePlayerStore } from '../stores/playerStore';

export class ListenTogetherService {
  private ws: WebSocket | null = null;
  private partyCode: string | null = null;
  private token: string | null = null;
  private memberId: string | null = null;
  private clockOffset: number = 0; // serverMs - deviceMs
  private pingInterval: any = null;

  private stateListeners: ((state: BitChordPartyState) => void)[] = [];
  private membersListeners: ((members: BitChordMember[]) => void)[] = [];

  private currentPartyState: BitChordPartyState = {
    code: '',
    song: null,
    isPlaying: false,
    positionMs: 0,
    anchorMs: 0,
    members: [],
  };

  public subscribe(cb: (state: BitChordPartyState) => void) {
    this.stateListeners.push(cb);
    cb(this.currentPartyState);
    return () => {
      this.stateListeners = this.stateListeners.filter((l) => l !== cb);
    };
  }

  public subscribeMembers(cb: (members: BitChordMember[]) => void) {
    this.membersListeners.push(cb);
    cb(this.currentPartyState.members);
    return () => {
      this.membersListeners = this.membersListeners.filter((l) => l !== cb);
    };
  }

  /**
   * Create a new BitChord Party Room
   */
  public async createParty(displayName: string = 'Web Listener'): Promise<string> {
    const userId = localStorage.getItem('yz_user_id') || `user_${Math.random().toString(36).substring(2, 9)}`;
    const deviceId = localStorage.getItem('yz_device_id') || `web_${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem('yz_user_id', userId);
    localStorage.setItem('yz_device_id', deviceId);

    const res = await fetch('/api/parties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        deviceId,
        displayName,
        avatarUrl: null,
      }),
    });

    if (!res.ok) {
      throw new Error(`Failed to create party: ${res.status}`);
    }

    const data = await res.json();
    this.partyCode = data.code;
    this.token = data.token;
    this.memberId = data.you.memberId;

    this.connectWebSocket(data.code, data.token);
    return data.code;
  }

  /**
   * Join an existing BitChord Party Room
   */
  public async joinParty(code: string, displayName: string = 'Web Listener'): Promise<void> {
    const cleanCode = code.trim().toUpperCase();
    const userId = localStorage.getItem('yz_user_id') || `user_${Math.random().toString(36).substring(2, 9)}`;
    const deviceId = localStorage.getItem('yz_device_id') || `web_${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem('yz_user_id', userId);
    localStorage.setItem('yz_device_id', deviceId);

    const res = await fetch(`/api/parties/${cleanCode}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        deviceId,
        displayName,
        avatarUrl: null,
      }),
    });

    if (!res.ok) {
      throw new Error(`Failed to join party ${cleanCode}: ${res.status}`);
    }

    const data = await res.json();
    this.partyCode = data.code;
    this.token = data.token;
    this.memberId = data.you.memberId;

    this.connectWebSocket(data.code, data.token);
  }

  /**
   * Leave the active BitChord party
   */
  public async leaveParty(): Promise<void> {
    if (this.partyCode && this.token) {
      try {
        await fetch(`/api/parties/${this.partyCode}/leave`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.token}`,
          },
        });
      } catch (e) {
        console.warn('Leave party request error', e);
      }
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    this.partyCode = null;
    this.token = null;
    this.memberId = null;

    this.currentPartyState = {
      code: '',
      song: null,
      isPlaying: false,
      positionMs: 0,
      anchorMs: 0,
      members: [],
    };
    this.notifyState();
  }

  private connectWebSocket(code: string, token: string) {
    if (this.ws) {
      this.ws.close();
    }

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${proto}//${window.location.host}/ws/parties/${code}?token=${token}`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.info(`[BitChord] WebSocket connected to party ${code}`);
      this.startClockSync();
    };

    this.ws.onmessage = (event) => {
      try {
        const frame = JSON.parse(event.data);
        this.handleFrame(frame);
      } catch (e) {
        console.error('[BitChord] Error parsing socket frame', e);
      }
    };

    this.ws.onclose = () => {
      console.info(`[BitChord] WebSocket closed for party ${code}`);
    };

    this.ws.onerror = (err) => {
      console.error('[BitChord] WebSocket error', err);
    };
  }

  private startClockSync() {
    if (this.pingInterval) clearInterval(this.pingInterval);
    // Ping immediately
    this.sendPing();
    // Then every 5s
    this.pingInterval = setInterval(() => this.sendPing(), 5000);
  }

  private sendPing() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'ping', clientMs: Date.now() }));
    }
  }

  private handleFrame(frame: any) {
    switch (frame.type) {
      case 'pong': {
        const t1 = Date.now();
        const t0 = frame.clientMs;
        const serverMs = frame.serverMs;
        // NTP offset calculation
        this.clockOffset = serverMs - (t0 + t1) / 2;
        break;
      }

      case 'state': {
        const playback = frame.playback;
        if (!playback) return;

        const serverNow = Date.now() + this.clockOffset;
        const isPlaying = playback.isPlaying;
        const anchorMs = playback.anchorMs || 0;
        const positionMs = playback.positionMs || 0;

        let playhead = positionMs;
        if (isPlaying && anchorMs > 0) {
          playhead = positionMs + Math.max(0, serverNow - anchorMs);
        }

        const track = playback.track;
        const song: Song | null = track
          ? {
              videoId: track.videoId,
              title: track.title,
              artist: track.artist,
              thumbnailUrl: track.thumbnailUrl || null,
              albumName: track.album || null,
            }
          : null;

        this.currentPartyState = {
          ...this.currentPartyState,
          code: this.partyCode || '',
          song,
          isPlaying,
          positionMs,
          anchorMs,
        };
        this.notifyState();

        // Synchronize local player
        const player = usePlayerStore.getState();
        if (song && (!player.currentSong || player.currentSong.videoId !== song.videoId)) {
          player.playSong(song);
          player.seek(playhead / 1000);
        } else if (song) {
          const driftSec = Math.abs(player.currentTime - playhead / 1000);
          if (driftSec > 1.5) {
            player.seek(playhead / 1000);
          }
          if (isPlaying && !player.isPlaying) {
            player.togglePlay();
          } else if (!isPlaying && player.isPlaying) {
            player.togglePlay();
          }
        }
        break;
      }

      case 'members': {
        const members: BitChordMember[] = (frame.members || []).map((m: any) => ({
          memberId: m.memberId,
          userId: m.userId,
          deviceId: m.deviceId,
          displayName: m.displayName,
          avatarUrl: m.avatarUrl || null,
          isHost: !!m.isHost,
          lastSeenMs: m.lastSeenMs || Date.now(),
        }));
        this.currentPartyState.members = members;
        this.membersListeners.forEach((cb) => cb(members));
        break;
      }

      case 'bye': {
        this.leaveParty();
        break;
      }
    }
  }

  // ---- Control Dispatchers ----

  public sendControl(action: string, payload: Record<string, any> = {}) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'control',
          action,
          ...payload,
        })
      );
    }
  }

  public sendPlay() {
    this.sendControl('play');
  }

  public sendPause() {
    this.sendControl('pause');
  }

  public sendSeek(positionMs: number) {
    this.sendControl('seek', { positionMs });
  }

  public sendTrack(song: Song) {
    this.sendControl('setTrack', {
      track: {
        videoId: song.videoId,
        title: song.title,
        artist: song.artist,
        thumbnailUrl: song.thumbnailUrl,
        album: song.albumName,
      },
    });
  }

  private notifyState() {
    this.stateListeners.forEach((cb) => cb(this.currentPartyState));
  }

  public get isConnected(): boolean {
    return !!(this.ws && this.ws.readyState === WebSocket.OPEN);
  }

  public get currentMemberId(): string | null {
    return this.memberId;
  }
}

export const listenTogetherService = new ListenTogetherService();
