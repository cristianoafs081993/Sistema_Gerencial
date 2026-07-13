const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export type YouTubeVideoEmbed = {
  videoId: string;
  embedUrl: string;
};

function normalizeHost(hostname: string) {
  return hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '');
}

function normalizeVideoId(value: string | null | undefined) {
  const candidate = (value || '').trim();
  if (!candidate) return null;
  const id = candidate.split(/[?&#/]/)[0];
  return YOUTUBE_VIDEO_ID_PATTERN.test(id) ? id : null;
}

export function extractYouTubeVideoId(input: string) {
  const value = input.trim();
  if (!value) return null;

  const rawId = normalizeVideoId(value);
  if (rawId) return rawId;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  const host = normalizeHost(url.hostname);
  if (host === 'youtu.be') {
    return normalizeVideoId(url.pathname.split('/').filter(Boolean)[0]);
  }

  if (host !== 'youtube.com' && host !== 'youtube-nocookie.com') {
    return null;
  }

  const pathParts = url.pathname.split('/').filter(Boolean);
  if (pathParts[0] === 'watch') {
    return normalizeVideoId(url.searchParams.get('v'));
  }

  if (['shorts', 'embed', 'live'].includes(pathParts[0])) {
    return normalizeVideoId(pathParts[1]);
  }

  return normalizeVideoId(url.searchParams.get('v'));
}

export function getYouTubeEmbedUrl(videoId: string) {
  const safeVideoId = normalizeVideoId(videoId);
  if (!safeVideoId) return null;
  return `https://www.youtube-nocookie.com/embed/${safeVideoId}`;
}

export function parseYouTubeEmbed(input: string): YouTubeVideoEmbed | null {
  const videoId = extractYouTubeVideoId(input);
  if (!videoId) return null;
  const embedUrl = getYouTubeEmbedUrl(videoId);
  if (!embedUrl) return null;
  return { videoId, embedUrl };
}
