import { supabase } from '@/lib/supabase';
import { parseYouTubeEmbed } from '@/lib/youtube';

export type PriceResearchEadVideo = {
  id: string;
  title: string;
  description: string;
  youtubeUrl: string;
  youtubeVideoId: string;
  sortOrder: number;
  isActive: boolean;
  createdBy: string | null;
  createdByEmail: string;
  createdAt: string;
  updatedAt: string;
};

export type PriceResearchEadVideoInput = {
  title: string;
  description?: string;
  youtubeUrl: string;
  sortOrder?: number;
  isActive?: boolean;
};

type DbPriceResearchEadVideoRow = {
  id: string;
  title: string;
  description: string | null;
  youtube_url: string;
  youtube_video_id: string;
  sort_order: number | null;
  is_active: boolean | null;
  created_by: string | null;
  created_by_email: string | null;
  created_at: string;
  updated_at: string;
};

const EAD_VIDEO_SELECT = [
  'id',
  'title',
  'description',
  'youtube_url',
  'youtube_video_id',
  'sort_order',
  'is_active',
  'created_by',
  'created_by_email',
  'created_at',
  'updated_at',
].join(',');

function mapEadVideoRow(row: DbPriceResearchEadVideoRow): PriceResearchEadVideo {
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    youtubeUrl: row.youtube_url,
    youtubeVideoId: row.youtube_video_id,
    sortOrder: Number(row.sort_order ?? 0),
    isActive: row.is_active !== false,
    createdBy: row.created_by,
    createdByEmail: row.created_by_email || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function buildEadVideoPayload(input: PriceResearchEadVideoInput) {
  const title = input.title.trim();
  if (!title) {
    throw new Error('Informe o titulo da aula.');
  }

  const embed = parseYouTubeEmbed(input.youtubeUrl);
  if (!embed) {
    throw new Error('Informe uma URL valida do YouTube.');
  }

  return {
    title,
    description: input.description?.trim() || null,
    youtube_url: input.youtubeUrl.trim(),
    youtube_video_id: embed.videoId,
    sort_order: Number.isFinite(Number(input.sortOrder)) ? Number(input.sortOrder) : 0,
    is_active: input.isActive !== false,
  };
}

export const priceResearchEadService = {
  async list(options: { includeInactive?: boolean } = {}): Promise<PriceResearchEadVideo[]> {
    let query = supabase
      .from('price_research_ead_videos')
      .select(EAD_VIDEO_SELECT)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (!options.includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map((row) => mapEadVideoRow(row as DbPriceResearchEadVideoRow));
  },

  async save(input: PriceResearchEadVideoInput, id?: string): Promise<PriceResearchEadVideo> {
    const payload = buildEadVideoPayload(input);

    if (id) {
      const { data, error } = await supabase
        .from('price_research_ead_videos')
        .update(payload)
        .eq('id', id)
        .select(EAD_VIDEO_SELECT)
        .single();
      if (error) throw error;
      return mapEadVideoRow(data as DbPriceResearchEadVideoRow);
    }

    const { data, error } = await supabase
      .from('price_research_ead_videos')
      .insert(payload)
      .select(EAD_VIDEO_SELECT)
      .single();
    if (error) throw error;
    return mapEadVideoRow(data as DbPriceResearchEadVideoRow);
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('price_research_ead_videos').delete().eq('id', id);
    if (error) throw error;
  },
};
