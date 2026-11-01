/**
 * YZ Music Web - Smart Thumbnail Optimization & Aspect Ratio Normalizer
 * Ensures high-definition, uncropped artwork matching the native Android app
 * Eliminates YouTube baked-in letterbox bars and provides instant clean fallbacks
 */

export function cleanThumbnailUrl(url?: string | null, videoId?: string | null): string {
  if (!url && videoId) {
    return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
  }
  if (!url) return '/logo.svg';

  // 1. Google User Content / YouTube Music Album Artwork (ensure crisp 544x544 square)
  if (url.includes('googleusercontent.com') || url.includes('ggpht.com')) {
    const cleanUrl = url.split('?')[0];
    if (/=w\d+-h\d+/.test(cleanUrl)) {
      return cleanUrl.replace(/=w\d+-h\d+[^&]*/, '=w544-h544-l90-rj');
    }
    if (/=s\d+/.test(cleanUrl)) {
      return cleanUrl.replace(/=s\d+[^&]*/, '=s544-l90-rj');
    }
    return `${cleanUrl}=w544-h544-l90-rj`;
  }

  // 2. JioSaavn CDN Album Art (upgrade to crisp 500x500 square)
  if (url.includes('saavncdn.com')) {
    return url.replace('150x150', '500x500').replace(/^http:\/\//i, 'https://');
  }

  // 3. YouTube video CDN: replace hqdefault (which contains baked-in black bars)
  // with mqdefault (320x180 true 16:9 with ZERO black bars)
  if (url.includes('ytimg.com')) {
    // Fix known broken IDs or casing
    let fixedUrl = url
      .replace('VAdGW7QDJUI', 'Wy59JHkWx_A')
      .replace('VAdGW7QDJiU', 'Wy59JHkWx_A')
      .replace('V9PVRfjEBTI', 'LK7-_dgAVQE');

    if (fixedUrl.includes('hqdefault.jpg')) {
      return fixedUrl.replace('hqdefault.jpg', 'mqdefault.jpg');
    }
    return fixedUrl;
  }

  return url;
}

