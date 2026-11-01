export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const queryString = req.url && req.url.includes('?') ? req.url.split('?')[1] : '';
    const targetUrl = `https://www.jiosaavn.com/api.php?${queryString}`;

    const saavnRes = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
        'Referer': 'https://www.jiosaavn.com/',
        'Accept': 'application/json, text/plain, */*',
      },
    });

    const data = await saavnRes.text();
    res.status(saavnRes.status);
    res.setHeader('Content-Type', saavnRes.headers.get('content-type') || 'application/json');
    return res.send(data);
  } catch (error) {
    console.error('JioSaavn proxy error:', error);
    return res.status(500).json({ error: error.message || 'Internal proxy error' });
  }
}

