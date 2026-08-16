import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  ExternalLink,
  GraduationCap,
  Loader2,
  Pencil,
  PlayCircle,
  Plus,
  Trash2,
  Video,
} from 'lucide-react';
import { toast } from 'sonner';

import { HeaderSubtitle } from '@/components/HeaderParts';
import { SectionPanel } from '@/components/design-system/SectionPanel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { getYouTubeEmbedUrl, parseYouTubeEmbed } from '@/lib/youtube';
import {
  priceResearchEadService,
  type PriceResearchEadVideo,
  type PriceResearchEadVideoInput,
} from '@/services/priceResearchEad';

const EMPTY_FORM: PriceResearchEadVideoInput = {
  title: '',
  description: '',
  youtubeUrl: '',
  sortOrder: 0,
  isActive: true,
};

export default function PriceResearchEad() {
  const { isSuperAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState<PriceResearchEadVideo | null>(null);
  const [form, setForm] = useState<PriceResearchEadVideoInput>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const videosQuery = useQuery({
    queryKey: ['price-research-ead-videos', isSuperAdmin],
    queryFn: () => priceResearchEadService.list({ includeInactive: isSuperAdmin }),
  });

  const videos = videosQuery.data ?? [];
  const activeVideos = useMemo(() => videos.filter((video) => video.isActive), [videos]);
  const selectedVideo = useMemo(() => {
    if (videos.length === 0) return null;
    return videos.find((video) => video.id === selectedVideoId) || activeVideos[0] || videos[0];
  }, [activeVideos, selectedVideoId, videos]);

  const selectedEmbedUrl = selectedVideo ? getYouTubeEmbedUrl(selectedVideo.youtubeVideoId) : null;
  const formEmbed = parseYouTubeEmbed(form.youtubeUrl);

  useEffect(() => {
    if (!selectedVideoId && selectedVideo) {
      setSelectedVideoId(selectedVideo.id);
    }
  }, [selectedVideo, selectedVideoId]);

  const resetDialog = () => {
    setEditingVideo(null);
    setForm(EMPTY_FORM);
    setIsDialogOpen(false);
  };

  const openCreateDialog = () => {
    setEditingVideo(null);
    setForm({
      ...EMPTY_FORM,
      sortOrder: videos.length + 1,
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (video: PriceResearchEadVideo) => {
    setEditingVideo(video);
    setForm({
      title: video.title,
      description: video.description,
      youtubeUrl: video.youtubeUrl,
      sortOrder: video.sortOrder,
      isActive: video.isActive,
    });
    setIsDialogOpen(true);
  };

  const refreshVideos = async () => {
    await queryClient.invalidateQueries({ queryKey: ['price-research-ead-videos'] });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const saved = await priceResearchEadService.save(form, editingVideo?.id);
      setSelectedVideoId(saved.id);
      await refreshVideos();
      toast.success(editingVideo ? 'Aula atualizada.' : 'Aula cadastrada.');
      resetDialog();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel salvar a aula.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (video: PriceResearchEadVideo) => {
    if (!confirm(`Remover a aula "${video.title}"?`)) return;

    setDeletingId(video.id);
    try {
      await priceResearchEadService.delete(video.id);
      if (selectedVideoId === video.id) setSelectedVideoId(null);
      await refreshVideos();
      toast.success('Aula removida.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel remover a aula.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <HeaderSubtitle>Capacitação EAD em pesquisa de preços</HeaderSubtitle>

      <div className="flex flex-col gap-4 rounded-radius-xl border border-border-subtle/70 bg-surface-card p-6 shadow-soft md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            <h3 className="text-xl font-bold text-foreground">Capacitação EAD</h3>
          </div>
          <p className="max-w-3xl text-sm text-text-muted">
            Aulas em vídeo para orientar a equipe no uso do módulo de pesquisa de preços e na condução da cotação.
          </p>
        </div>

        {isSuperAdmin ? (
          <Button type="button" className="gap-2" onClick={openCreateDialog}>
            <Plus className="h-4 w-4" />
            Cadastrar aula
          </Button>
        ) : null}
      </div>

      <div className="rounded-radius-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-medium text-amber-900 shadow-soft" role="status">
        Hoje, 13/07/2026, às 22h serão adicionadas novas aulas nesta capacitação.
      </div>

      {videosQuery.isLoading ? (
        <SectionPanel>
          <div className="flex min-h-[320px] flex-col items-center justify-center text-center text-text-muted">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="mt-3 text-sm font-medium">Carregando aulas...</p>
          </div>
        </SectionPanel>
      ) : videosQuery.isError ? (
        <SectionPanel title="Não foi possível carregar as aulas">
          <div role="alert" className="rounded-radius-md border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
            {videosQuery.error instanceof Error ? videosQuery.error.message : 'Falha ao carregar o catálogo EAD.'}
          </div>
        </SectionPanel>
      ) : videos.length === 0 || (!isSuperAdmin && activeVideos.length === 0) ? (
        <SectionPanel title="Nenhuma aula cadastrada" description="O catálogo EAD ainda não possui vídeos ativos.">
          <div className="flex min-h-[300px] flex-col items-center justify-center rounded-radius-lg border border-dashed border-border-default bg-surface-subtle/45 p-8 text-center">
            <Video className="h-10 w-10 text-text-muted" />
            <p className="mt-3 max-w-md text-sm text-text-muted">
              Quando o superadministrador cadastrar os links do YouTube, as aulas aparecerão aqui para os usuários do módulo.
            </p>
            {isSuperAdmin ? (
              <Button type="button" className="mt-5 gap-2" onClick={openCreateDialog}>
                <Plus className="h-4 w-4" />
                Cadastrar primeira aula
              </Button>
            ) : null}
          </div>
        </SectionPanel>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <SectionPanel
            title={selectedVideo?.title || 'Aula EAD'}
            description={selectedVideo?.description || 'Selecione uma aula para assistir.'}
            actions={
              selectedVideo ? (
                <a
                  href={selectedVideo.youtubeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-xs font-semibold text-foreground shadow-xs transition-colors hover:bg-muted"
                >
                  <ExternalLink className="h-4 w-4" />
                  Abrir no YouTube
                </a>
              ) : null
            }
          >
            {selectedVideo && selectedEmbedUrl ? (
              <div className="overflow-hidden rounded-radius-xl border border-border-default bg-black shadow-soft">
                <iframe
                  title={`Aula EAD: ${selectedVideo.title}`}
                  src={selectedEmbedUrl}
                  className="aspect-video w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            ) : (
              <div className="flex aspect-video items-center justify-center rounded-radius-xl border border-dashed border-border-default bg-surface-subtle text-sm text-text-muted">
                Selecione uma aula para iniciar.
              </div>
            )}
          </SectionPanel>

          <SectionPanel title="Aulas disponíveis" description="Conteúdos do catálogo de capacitação.">
            <div className="space-y-2">
              {videos.map((video) => (
                <button
                  key={video.id}
                  type="button"
                  onClick={() => setSelectedVideoId(video.id)}
                  className={`w-full rounded-radius-lg border p-3 text-left transition-colors ${
                    selectedVideo?.id === video.id
                      ? 'border-primary/40 bg-primary/[0.04]'
                      : 'border-border-default bg-white hover:bg-surface-subtle/60'
                  } ${!video.isActive ? 'opacity-70' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <PlayCircle className={`mt-0.5 h-5 w-5 shrink-0 ${selectedVideo?.id === video.id ? 'text-primary' : 'text-text-muted'}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="line-clamp-2 text-sm font-bold text-text-primary">{video.title}</p>
                        {!video.isActive ? <Badge variant="outline">Inativa</Badge> : null}
                      </div>
                      {video.description ? (
                        <p className="mt-1 line-clamp-2 text-xs text-text-muted">{video.description}</p>
                      ) : null}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </SectionPanel>
        </div>
      )}

      {isSuperAdmin ? (
        <SectionPanel
          title="Gestão do EAD"
          description="Cadastro visível apenas para superadministrador."
          actions={
            <Button type="button" variant="outline" size="sm" className="gap-2" onClick={openCreateDialog}>
              <Plus className="h-4 w-4" />
              Nova aula
            </Button>
          }
        >
          {videos.length === 0 ? (
            <div className="rounded-radius-lg border border-dashed border-border-default bg-surface-subtle/45 px-4 py-6 text-center text-sm text-text-muted">
              Nenhuma aula cadastrada.
            </div>
          ) : (
            <div className="space-y-2">
              {videos.map((video) => (
                <div key={video.id} className="flex flex-col gap-3 rounded-radius-lg border border-border-default bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-ui text-sm font-bold text-text-primary">{video.title}</p>
                      {video.isActive ? (
                        <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
                          <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                          Ativa
                        </Badge>
                      ) : (
                        <Badge variant="outline">Inativa</Badge>
                      )}
                      <span className="font-mono text-[11px] text-text-muted">Ordem {video.sortOrder}</span>
                    </div>
                    <p className="mt-1 truncate font-mono text-[11px] text-text-muted">{video.youtubeUrl}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button type="button" variant="outline" size="icon-sm" onClick={() => openEditDialog(video)} title="Editar aula">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => void handleDelete(video)}
                      disabled={deletingId === video.id}
                      title="Remover aula"
                    >
                      {deletingId === video.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionPanel>
      ) : null}

      <Dialog open={isDialogOpen} onOpenChange={(open) => (open ? setIsDialogOpen(true) : resetDialog())}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingVideo ? 'Editar aula EAD' : 'Cadastrar aula EAD'}</DialogTitle>
            <DialogDescription>
              Cole o link do YouTube. O sistema salva o ID do vídeo e exibe a aula por iframe seguro.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ead-title">Título</Label>
              <Input
                id="ead-title"
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Ex.: Como iniciar uma pesquisa de preços"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ead-url">URL do YouTube</Label>
              <Input
                id="ead-url"
                value={form.youtubeUrl}
                onChange={(event) => setForm((current) => ({ ...current, youtubeUrl: event.target.value }))}
                placeholder="https://www.youtube.com/watch?v=..."
              />
              {form.youtubeUrl ? (
                <p className={`text-xs font-medium ${formEmbed ? 'text-emerald-700' : 'text-destructive'}`}>
                  {formEmbed ? `Vídeo identificado: ${formEmbed.videoId}` : 'URL do YouTube inválida.'}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="ead-description">Descrição</Label>
              <Textarea
                id="ead-description"
                rows={3}
                value={form.description || ''}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="Resumo curto da aula."
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
              <div className="space-y-2">
                <Label htmlFor="ead-order">Ordem</Label>
                <Input
                  id="ead-order"
                  type="number"
                  value={form.sortOrder ?? 0}
                  onChange={(event) => setForm((current) => ({ ...current, sortOrder: Number(event.target.value) }))}
                />
              </div>

              <label className="flex items-center gap-3 rounded-radius-md border border-border-default bg-surface-subtle/45 px-3 py-2 text-sm font-medium text-text-primary">
                <Checkbox
                  checked={form.isActive !== false}
                  onCheckedChange={(checked) => setForm((current) => ({ ...current, isActive: checked === true }))}
                />
                Aula ativa para usuários
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={resetDialog} disabled={isSaving}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void handleSave()} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Salvar aula
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
