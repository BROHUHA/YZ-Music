import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import os from 'os';

// Google OAuth 2.0 Device Flow & Auth Relay Plugin
function autoAuthPlugin(): Plugin {
  let capturedCookie: string | null = null;

  return {
    name: 'auto-auth-receiver',
    configureServer(server) {
      // 1. Google / YouTube Device Flow: Request User Code
      server.middlewares.use('/api/auth/device/code', async (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
          res.statusCode = 200;
          return res.end();
        }

        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', async () => {
          try {
            const parsed = JSON.parse(body || '{}');
            const clientId = parsed.client_id?.trim() || '861556708454-d6dlm3lh05idd8npek18k6be8ba3oc68.apps.googleusercontent.com';

            const bodyParams = new URLSearchParams({
              client_id: clientId,
              scope: 'https://www.googleapis.com/auth/youtube https://www.googleapis.com/auth/youtube-paid-content https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
            });

            const googleRes = await fetch('https://oauth2.googleapis.com/device/code', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: bodyParams.toString(),
            });

            const data = await googleRes.json();
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify(data));
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: err.message }));
          }
        });
      });

      // 2. Google / YouTube Device Flow: Exchange Device Code for OAuth Access Token
      server.middlewares.use('/api/auth/device/token', async (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
          res.statusCode = 200;
          return res.end();
        }

        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', async () => {
          try {
            const parsed = JSON.parse(body || '{}');
            const deviceCode = parsed.device_code;
            if (!deviceCode) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ error: 'Missing device_code' }));
            }

            const clientId = parsed.client_id?.trim() || '861556708454-d6dlm3lh05idd8npek18k6be8ba3oc68.apps.googleusercontent.com';
            const clientSecret = parsed.client_secret?.trim() || 'SboVhoG9s0rNafixCSGGKXAT';

            const tokenParams = new URLSearchParams({
              client_id: clientId,
              client_secret: clientSecret,
              device_code: deviceCode,
              grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
            });

            const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: tokenParams.toString(),
            });

            const tokenData = await tokenRes.json();

            if (tokenData.error) {
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ status: 'pending', error: tokenData.error }));
            }

            // Successfully authenticated!
            const accessToken = tokenData.access_token;
            let accountInfo = {
              name: 'YouTube Music Listener',
              email: '',
              thumbnailUrl: null as string | null,
            };

            try {
              // 1. Fetch userinfo from Google OAuth (name, email, picture)
              const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${accessToken}` },
              });
              if (userRes.ok) {
                const userData = await userRes.json();
                accountInfo = {
                  name: userData.name || userData.email?.split('@')[0] || 'YouTube Music Listener',
                  email: userData.email || '',
                  thumbnailUrl: userData.picture || null,
                };
              }
            } catch (uErr) {
              console.warn('UserInfo fetch warning:', uErr);
            }

            // 2. If thumbnail is still missing, try YouTube Data API channels endpoint
            if (!accountInfo.thumbnailUrl) {
              try {
                const chanRes = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
                  headers: { Authorization: `Bearer ${accessToken}` },
                });
                if (chanRes.ok) {
                  const chanData = await chanRes.json();
                  const snippet = chanData.items?.[0]?.snippet;
                  if (snippet) {
                    accountInfo.name = snippet.title || accountInfo.name;
                    accountInfo.thumbnailUrl = snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url || accountInfo.thumbnailUrl;
                  }
                }
              } catch (cErr) {
                console.warn('Channel fetch warning:', cErr);
              }
            }

            res.setHeader('Content-Type', 'application/json');
            return res.end(
              JSON.stringify({
                status: 'success',
                accessToken,
                refreshToken: tokenData.refresh_token,
                expiresIn: tokenData.expires_in,
                account: accountInfo,
              })
            );
          } catch (e: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: e.message }));
          }
        });
      });

      // 3. YouTube Data API Playlists Endpoint (OAuth Bearer)
      server.middlewares.use('/api/auth/oauth/playlists', async (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        if (req.method === 'OPTIONS') {
          res.statusCode = 200;
          return res.end();
        }

        const authHeader = req.headers['authorization'];
        if (!authHeader) {
          res.statusCode = 401;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'Missing Authorization header' }));
        }

        try {
          const ytRes = await fetch('https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&mine=true&maxResults=50', {
            headers: { Authorization: authHeader as string },
          });
          const ytData = await ytRes.json();
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify(ytData));
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: err.message }));
        }
      });

      // 4. YouTube Data API Liked Songs Endpoint (OAuth Bearer)
      server.middlewares.use('/api/auth/oauth/liked', async (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        if (req.method === 'OPTIONS') {
          res.statusCode = 200;
          return res.end();
        }

        const authHeader = req.headers['authorization'];
        if (!authHeader) {
          res.statusCode = 401;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'Missing Authorization header' }));
        }

        try {
          const ytRes = await fetch('https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&myRating=like&maxResults=50', {
            headers: { Authorization: authHeader as string },
          });
          const ytData = await ytRes.json();
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify(ytData));
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: err.message }));
        }
      });

      // 5. Fallback Auto-Session Capture from music.youtube.com
      server.middlewares.use('/api/auth/auto-session', (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
          res.statusCode = 200;
          return res.end();
        }

        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => (body += chunk));
          req.on('end', () => {
            try {
              const data = JSON.parse(body || '{}');
              if (data.cookie && typeof data.cookie === 'string') {
                capturedCookie = data.cookie;
                res.setHeader('Content-Type', 'application/json');
                return res.end(JSON.stringify({ success: true, message: 'Session captured' }));
              }
            } catch (e) {
              console.warn('Auto auth parse error:', e);
            }
            res.statusCode = 400;
            return res.end(JSON.stringify({ error: 'Invalid payload' }));
          });
          return;
        }

        if (req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          const result = capturedCookie;
          capturedCookie = null;
          return res.end(JSON.stringify({ cookie: result }));
        }
      });

      // 6. Safe Image / Avatar Proxy for Google CDN thumbnails
      server.middlewares.use('/api/avatar', async (req, res) => {
        const reqUrl = req.url || '';
        const match = reqUrl.match(/[?&]url=([^&]+)/);
        if (!match || !match[1]) {
          res.statusCode = 400;
          return res.end('Missing url parameter');
        }
        const targetUrl = decodeURIComponent(match[1]);
        if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
          res.statusCode = 400;
          return res.end('Invalid url');
        }

        try {
          const imgRes = await fetch(targetUrl, {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
              'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
            },
          });
          if (!imgRes.ok) {
            res.statusCode = imgRes.status;
            return res.end();
          }
          const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Content-Type', contentType);
          res.setHeader('Cache-Control', 'public, max-age=86400');
          const buffer = await imgRes.arrayBuffer();
          return res.end(Buffer.from(buffer));
        } catch (e) {
          res.statusCode = 502;
          return res.end();
        }
      });

      // 7. Direct Audio File Downloader Proxy
      server.middlewares.use('/api/download', async (req, res) => {
        const reqUrl = new URL(req.url || '', 'http://localhost');
        const targetUrl = reqUrl.searchParams.get('url');
        const filename = reqUrl.searchParams.get('filename') || 'track.m4a';

        if (!targetUrl || (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://'))) {
          res.statusCode = 400;
          return res.end('Invalid or missing url parameter');
        }

        try {
          const fileRes = await fetch(targetUrl, {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
            },
          });

          if (!fileRes.ok) {
            res.statusCode = fileRes.status;
            return res.end();
          }

          const contentType = fileRes.headers.get('content-type') || 'audio/mp4';
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Content-Type', contentType);
          res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
          const buffer = await fileRes.arrayBuffer();
          return res.end(Buffer.from(buffer));
        } catch (e: any) {
          res.statusCode = 502;
          return res.end(e.message || 'Download failed');
        }
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), autoAuthPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    host: true,
    proxy: {
      // Innertube YouTube Music API Proxy
      '/api/innertube': {
        target: 'https://music.youtube.com/youtubei/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/innertube/, ''),
        headers: {
          'Origin': 'https://music.youtube.com',
          'Referer': 'https://music.youtube.com/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'X-YouTube-Client-Name': '67',
          'X-YouTube-Client-Version': '1.20250101.01.00',
        },
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            const ytCookie = req.headers['x-yt-cookie'] || req.headers['x-goog-cookie'];
            if (ytCookie && typeof ytCookie === 'string') {
              proxyReq.setHeader('Cookie', ytCookie);
            }
            const authHeader = req.headers['authorization'];
            if (authHeader && typeof authHeader === 'string') {
              proxyReq.setHeader('Authorization', authHeader);
              if (authHeader.startsWith('Bearer ')) {
                // TV / Device OAuth token: keep TVHTML5 client identity
                proxyReq.setHeader('X-YouTube-Client-Name', '31');
                proxyReq.setHeader('X-YouTube-Client-Version', '7.20260707.07.00');
              } else {
                // SAPISIDHASH session token: official WEB_REMIX YouTube Music client
                proxyReq.setHeader('X-YouTube-Client-Name', '67');
                proxyReq.setHeader('X-YouTube-Client-Version', '1.20250101.01.00');
              }
            }
          });
        },
      },
      // BitChord Party WebSocket & REST API Proxy
      '/api/parties': {
        target: 'https://yz-music-party.onrender.com',
        changeOrigin: true,
      },
      '/ws/parties': {
        target: 'wss://yz-music-party.onrender.com',
        ws: true,
        changeOrigin: true,
      },
      // JioSaavn High-Quality Audio API Proxy
      '/api/jiosaavn': {
        target: 'https://www.jiosaavn.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/jiosaavn/, '/api.php'),
        headers: {
          'Origin': 'https://www.jiosaavn.com',
          'Referer': 'https://www.jiosaavn.com/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'X-Forwarded-For': '49.36.0.1',
          'X-Real-IP': '49.36.0.1',
          'Cookie': 'explicit_content=1',
        },
      },
      // LRCLib lyrics API proxy
      '/api/lrclib': {
        target: 'https://lrclib.net/api',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/lrclib/, ''),
        headers: {
          'User-Agent': 'YZMusicWeb/1.6.2 (https://github.com/abin/yz-music-web)',
        },
      },
    },
  },
});

