import { describe, expect, it } from 'vitest';

import { extractYouTubeVideoId, getYouTubeEmbedUrl, parseYouTubeEmbed } from '@/lib/youtube';

describe('youtube helpers', () => {
  it('extrai IDs de URLs comuns do YouTube', () => {
    expect(extractYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(extractYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ?t=43')).toBe('dQw4w9WgXcQ');
    expect(extractYouTubeVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ?feature=share')).toBe('dQw4w9WgXcQ');
    expect(extractYouTubeVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('gera URL de embed pelo dominio youtube-nocookie', () => {
    expect(getYouTubeEmbedUrl('dQw4w9WgXcQ')).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    expect(parseYouTubeEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toEqual({
      videoId: 'dQw4w9WgXcQ',
      embedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    });
  });

  it('rejeita URLs que nao apontam para um video valido', () => {
    expect(extractYouTubeVideoId('https://example.com/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(extractYouTubeVideoId('https://www.youtube.com/watch?v=curto')).toBeNull();
    expect(parseYouTubeEmbed('nao e uma url')).toBeNull();
  });
});
