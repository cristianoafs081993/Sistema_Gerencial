import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  Search,
  Landmark,
  ArrowRight,
  Receipt,
  Calendar,
  X,
  Sparkles,
} from 'lucide-react';

import type { Empenho, Descentralizacao, Atividade } from '@/types';
import { formatCurrency, cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { EmpenhoDialog } from '@/components/modals/EmpenhoDialog';

const STORAGE_KEY = 'siages-notifications-last-read';
const MAX_EVENTS = 20;

export interface NotificationCenterProps {
  empenhos?: Empenho[];
  descentralizacoes?: Descentralizacao[];
  atividades?: Atividade[];
  onSaveEmpenho?: (id: string, data: Partial<Empenho>) => void;
  className?: string;
}

export type NotificationItem =
  | {
      id: string;
      type: 'empenho';
      date: Date;
      title: string;
      subtitle: string;
      description: string;
      valor: number;
      dimensao?: string;
      status?: string;
      raw: Empenho;
    }
  | {
      id: string;
      type: 'descentralizacao';
      date: Date;
      title: string;
      subtitle: string;
      description: string;
      valor: number;
      dimensao?: string;
      origem?: string;
      raw: Descentralizacao;
    };

function parseDate(value: Date | string | undefined | null): Date {
  if (!value) return new Date(0);
  if (value instanceof Date) return isNaN(value.getTime()) ? new Date(0) : value;
  const d = new Date(value);
  return isNaN(d.getTime()) ? new Date(0) : d;
}

function formatNotificationDate(date: Date): string {
  if (!date || isNaN(date.getTime()) || date.getTime() === 0) return '-';
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return 'Hoje';
  }
  if (diffDays === 1) {
    return 'Ontem';
  }
  if (diffDays > 1 && diffDays < 7) {
    return `Há ${diffDays} dias`;
  }
  return date.toLocaleDateString('pt-BR');
}

const statusBadgeVariantMap: Record<string, 'warning' | 'info' | 'success' | 'destructive' | 'default'> = {
  pendente: 'warning',
  liquidado: 'info',
  pago: 'success',
  cancelado: 'destructive',
};

const statusLabelMap: Record<string, string> = {
  pendente: 'Pendente',
  liquidado: 'Liquidado',
  pago: 'Pago',
  cancelado: 'Cancelado',
};

export function NotificationCenter({
  empenhos = [],
  descentralizacoes = [],
  atividades = [],
  onSaveEmpenho,
  className,
}: NotificationCenterProps) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmpenho, setSelectedEmpenho] = useState<Empenho | null>(null);
  const [isEmpenhoDialogOpen, setIsEmpenhoDialogOpen] = useState(false);

  const [lastReadTimestamp, setLastReadTimestamp] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });

  // Consolidar empenhos e descentralizações juntos na mesma lista, ordenados por data decrescente (máx. 20 eventos)
  const allNotifications = useMemo<NotificationItem[]>(() => {
    const empenhoItems: NotificationItem[] = empenhos.map((e) => ({
      id: `emp-${e.id || e.numero}`,
      type: 'empenho',
      date: parseDate(e.dataEmpenho || e.createdAt),
      title: `Empenho ${e.numero}`,
      subtitle: e.favorecidoNome || 'Favorecido não informado',
      description: e.descricao || '',
      valor: Number(e.valor) || 0,
      dimensao: e.dimensao,
      status: e.status || 'pendente',
      raw: e,
    }));

    const descItems: NotificationItem[] = descentralizacoes.map((d) => ({
      id: `desc-${d.id || d.notaCredito || Math.random().toString()}`,
      type: 'descentralizacao',
      date: parseDate(d.dataEmissao || d.createdAt),
      title: d.notaCredito ? `Descentralização ${d.notaCredito}` : 'Descentralização de Crédito',
      subtitle: d.origemRecurso ? `Origem: ${d.origemRecurso}` : 'Origem não informada',
      description: d.descricao || (d.planoInterno ? `PI: ${d.planoInterno}` : ''),
      valor: Number(d.valor) || 0,
      dimensao: d.dimensao,
      origem: d.origemRecurso,
      raw: d,
    }));

    return [...empenhoItems, ...descItems]
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, MAX_EVENTS);
  }, [empenhos, descentralizacoes]);

  // Contagem de itens não lidos dentre os últimos eventos
  const unreadCount = useMemo(() => {
    if (lastReadTimestamp === 0) return Math.min(allNotifications.length, MAX_EVENTS);
    return allNotifications.filter((item) => item.date.getTime() > lastReadTimestamp).length;
  }, [allNotifications, lastReadTimestamp]);

  const hasUnread = unreadCount > 0;

  const markAllAsRead = () => {
    const now = Date.now();
    setLastReadTimestamp(now);
    try {
      localStorage.setItem(STORAGE_KEY, now.toString());
    } catch {
      // Ignorar falha de storage local
    }
  };

  // Filtragem conforme busca
  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) {
      return allNotifications;
    }

    const term = searchTerm.toLowerCase();
    return allNotifications.filter(
      (n) =>
        n.title.toLowerCase().includes(term) ||
        n.subtitle.toLowerCase().includes(term) ||
        n.description.toLowerCase().includes(term) ||
        (n.dimensao && n.dimensao.toLowerCase().includes(term)),
    );
  }, [allNotifications, searchTerm]);

  const handleEmpenhoClick = (empenho: Empenho) => {
    setSelectedEmpenho(empenho);
    setIsEmpenhoDialogOpen(true);
    setIsOpen(false);
  };

  const handleDescentralizacaoClick = () => {
    setIsOpen(false);
    navigate('/descentralizacoes');
  };

  return (
    <>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              'p-1.5 hover:bg-muted rounded-full text-muted-foreground hover:text-foreground transition-colors relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
              isOpen && 'bg-muted text-foreground',
              className,
            )}
            title="Central de Notificações"
            aria-label="Abrir central de notificações"
          >
            <Bell className="w-4 h-4 md:w-4.5 md:h-4.5" />
            {hasUnread && (
              <span
                data-testid="notification-unread-dot"
                className="absolute top-1 right-1 w-2 h-2 bg-emerald-500 rounded-full border border-card animate-pulse"
                title={`${unreadCount} novidade(s)`}
              />
            )}
          </button>
        </PopoverTrigger>

        <PopoverContent
          align="end"
          sideOffset={8}
          className="w-[380px] sm:w-[420px] max-w-[95vw] p-0 shadow-2xl rounded-2xl border-border bg-card overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-muted/40">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-bold text-foreground">Notificações</h3>
                  {hasUnread && (
                    <Badge variant="brand" className="text-[10px] px-1.5 py-0 h-4 font-bold">
                      {unreadCount} nova{unreadCount > 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">Últimos {MAX_EVENTS} eventos orçamentários</p>
              </div>
            </div>

            {hasUnread && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground gap-1"
                title="Marcar todas como lidas"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-[11px]">Marcar como lidas</span>
              </Button>
            )}
          </div>

          {/* Busca rápida */}
          <div className="p-3 pb-2 border-b border-border/40">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Buscar por número, credor, descrição..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-8 pl-8 pr-8 text-xs bg-muted/30 focus-visible:ring-1"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Lista Unificada de Notificações (Empenhos + Descentralizações) */}
          <ScrollArea className="max-h-[360px] overflow-y-auto px-2 py-2">
            {filteredItems.length === 0 ? (
              <div className="py-8 text-center px-4 space-y-2">
                <div className="w-10 h-10 rounded-full bg-muted/60 flex items-center justify-center mx-auto text-muted-foreground">
                  <Sparkles className="w-5 h-5 opacity-60" />
                </div>
                <p className="text-xs font-semibold text-foreground">Nenhum evento encontrado</p>
                <p className="text-[11px] text-muted-foreground">
                  {searchTerm
                    ? 'Nenhum evento corresponde ao termo pesquisado.'
                    : 'Não há movimentações orçamentárias recentes para exibir.'}
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {filteredItems.map((item) => {
                  const isUnread = lastReadTimestamp === 0 || item.date.getTime() > lastReadTimestamp;

                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        if (item.type === 'empenho') {
                          handleEmpenhoClick(item.raw);
                        } else {
                          handleDescentralizacaoClick();
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          if (item.type === 'empenho') {
                            handleEmpenhoClick(item.raw);
                          } else {
                            handleDescentralizacaoClick();
                          }
                        }
                      }}
                      className={cn(
                        'group relative flex items-start gap-3 p-2.5 rounded-xl border border-transparent transition-all text-left cursor-pointer hover:bg-muted/60 hover:border-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                        isUnread ? 'bg-primary/[0.03] border-primary/10' : 'bg-transparent',
                      )}
                    >
                      {/* Ícone de Tipo */}
                      <div
                        className={cn(
                          'p-2 rounded-lg shrink-0 mt-0.5 transition-colors',
                          item.type === 'empenho'
                            ? 'bg-blue-500/10 text-blue-600 group-hover:bg-blue-500/20'
                            : 'bg-emerald-500/10 text-emerald-600 group-hover:bg-emerald-500/20',
                        )}
                      >
                        {item.type === 'empenho' ? (
                          <Receipt className="w-4 h-4" />
                        ) : (
                          <Landmark className="w-4 h-4" />
                        )}
                      </div>

                      {/* Conteúdo */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors">
                              {item.title}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {item.type === 'empenho' && item.status && (
                              <Badge
                                variant={statusBadgeVariantMap[item.status] || 'default'}
                                className="text-[9px] px-1.5 py-0 h-4 uppercase tracking-wider"
                              >
                                {statusLabelMap[item.status] || item.status}
                              </Badge>
                            )}
                            {item.type === 'descentralizacao' && (
                              <Badge variant="success" className="text-[9px] px-1.5 py-0 h-4 font-semibold">
                                Descentralização
                              </Badge>
                            )}
                          </div>
                        </div>

                        <p className="text-[11px] text-foreground/80 font-medium truncate">
                          {item.subtitle}
                        </p>

                        {item.description && (
                          <p className="text-[10px] text-muted-foreground line-clamp-1">
                            {item.description}
                          </p>
                        )}

                        <div className="flex items-center justify-between pt-0.5 text-[10px] text-muted-foreground">
                          <span className="font-bold text-xs text-foreground font-ui">
                            {formatCurrency(item.valor)}
                          </span>

                          <div className="flex items-center gap-2">
                            {item.dimensao && (
                              <span className="px-1.5 py-0.2 rounded bg-muted text-[10px] font-medium">
                                {item.dimensao.split(' - ')[0] || item.dimensao}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 opacity-60" />
                              {formatNotificationDate(item.date)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Ponto indicador de não lido na linha */}
                      {isUnread && (
                        <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 self-center" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {/* Footer de Atalhos */}
          <div className="p-2 border-t border-border/60 bg-muted/30 grid grid-cols-2 gap-2 text-center text-xs">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsOpen(false);
                navigate('/empenhos');
              }}
              className="h-8 text-[11px] text-muted-foreground hover:text-foreground justify-center gap-1 font-medium"
            >
              <span>Todos Empenhos</span>
              <ArrowRight className="w-3 h-3" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsOpen(false);
                navigate('/descentralizacoes');
              }}
              className="h-8 text-[11px] text-muted-foreground hover:text-foreground justify-center gap-1 font-medium"
            >
              <span>Descentralizações</span>
              <ArrowRight className="w-3 h-3" />
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Modal para inspeção direta de empenho */}
      {selectedEmpenho && (
        <EmpenhoDialog
          open={isEmpenhoDialogOpen}
          onOpenChange={setIsEmpenhoDialogOpen}
          empenho={selectedEmpenho}
          atividades={atividades}
          onSave={onSaveEmpenho ? (id, data) => onSaveEmpenho(id, data) : () => {}}
        />
      )}
    </>
  );
}
