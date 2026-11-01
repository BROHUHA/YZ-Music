export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, x-yt-cookie, x-goog-cookie, X-Goog-PageId, X-Goog-Visitor-Id'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const rawPath = req.query.path;
    let endpoint = Array.isArray(rawPath) ? rawPath.join('/') : (rawPath || '');
    if (!endpoint && req.url) {
      const cleanUrl = req.url.split('?')[0];
      endpoint = cleanUrl.replace(/^\/api\/innertube\/?/, '');
    }
    const targetUrl = `https://music.youtube.com/youtubei/v1/${endpoint}`;

    const authHeader = req.headers['authorization'];
    const ytCookie = req.headers['x-yt-cookie'] || req.headers['x-goog-cookie'] || req.headers['cookie'];
    const pageId = req.headers['x-goog-pageid'];
    const visitorId = req.headers['x-goog-visitor-id'];

    const isTvClient = authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ');

    const forwardHeaders = {
      'Content-Type': 'application/json',
      'Origin': 'https://music.youtube.com',
      'Referer': 'https://music.youtube.com/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
      'X-YouTube-Client-Name': isTvClient ? '31' : '67',
      'X-YouTube-Client-Version': isTvClient ? '7.20260707.07.00' : '1.20250101.01.00',
    };

    if (authHeader) forwardHeaders['Authorization'] = authHeader;
    if (ytCookie) forwardHeaders['Cookie'] = ytCookie;
    if (pageId) forwardHeaders['X-Goog-PageId'] = pageId;
    if (visitorId) forwardHeaders['X-Goog-Visitor-Id'] = visitorId;

    const ytRes = await fetch(targetUrl, {
      method: req.method || 'POST',
      headers: forwardHeaders,
      body: req.method !== 'GET' && req.method !== 'HEAD'
        ? (typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {}))
        : undefined,
    });

    const data = await ytRes.text();
    res.status(ytRes.status);
    res.setHeader('Content-Type', ytRes.headers.get('content-type') || 'application/json');
    return res.send(data);
  } catch (error) {
    console.error('Innertube proxy error:', error);
    return res.status(500).json({ error: error.message || 'Internal proxy error' });
  }
}

