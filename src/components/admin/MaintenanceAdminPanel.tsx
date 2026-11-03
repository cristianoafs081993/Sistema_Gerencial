import { useState, useEffect } from 'react';
import {
  Wrench,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Save,
  RotateCcw,
  KeyRound,
  ShieldAlert,
  Loader2,
  Clock,
} from 'lucide-react';
import { useMaintenance } from '@/contexts/MaintenanceContext';
import { SectionPanel } from '@/components/design-system/SectionPanel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export function MaintenanceAdminPanel() {
  const { settings, toggleMaintenance, updateSettings, isLoading, refreshSettings } = useMaintenance();

  const [isToggling, setIsToggling] = useState(false);
  const [isSavingTexts, setIsSavingTexts] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  // Form states
  const [title, setTitle] = useState(settings.title);
  const [subtitle, setSubtitle] = useState(settings.subtitle);
  const [description, setDescription] = useState(settings.description);
  const [estimatedReturn, setEstimatedReturn] = useState(settings.estimatedReturn);
  const [bypassSecret, setBypassSecret] = useState(settings.bypassSecret);

  // Update local state when remote settings change
  useEffect(() => {
    setTitle(settings.title);
    setSubtitle(settings.subtitle);
    setDescription(settings.description);
    setEstimatedReturn(settings.estimatedReturn);
    setBypassSecret(settings.bypassSecret);
  }, [settings]);

  const handleToggle = async (checked: boolean) => {
    setIsToggling(true);
    try {
      await toggleMaintenance(checked);
    } catch (err) {
      // toast already handled in context, refresh to ensure consistent display
      try {
        await refreshSettings();
      } catch {
        // Ignore
      }
    } finally {
      setIsToggling(false);
    }
  };

  const handleSaveTexts = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingTexts(true);
    try {
      await updateSettings({
        title: title.trim(),
        subtitle: subtitle.trim(),
        description: description.trim(),
        estimatedReturn: estimatedReturn.trim(),
        bypassSecret: bypassSecret.trim() || 'siages',
      });
      setShowConfig(false);
    } catch (err) {
      // toast handled
    } finally {
      setIsSavingTexts(false);
    }
  };

  const formatDate = (isoStr?: string) => {
    if (!isoStr) return null;
    try {
      return new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'medium',
      }).format(new Date(isoStr));
    } catch {
      return isoStr;
    }
  };

  return (
    <SectionPanel
      title="Modo de Manutenção do Sistema"
      description="Controle global de indisponibilidade programada para manutenção no SIAGES."
    >
      <div className="space-y-5">
        {/* Main Status & Toggle Card */}
        <div
          className={`p-5 rounded-xl border transition-all ${
            settings.enabled
              ? 'bg-amber-50/60 border-amber-200 dark:border-amber-900/50'
              : 'bg-white border-[#DDE6F0]'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                  settings.enabled
                    ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                    : 'bg-[#EEF3F9] text-[#5B6B7B]'
                }`}
              >
                <Wrench className={`w-5 h-5 ${settings.enabled ? 'animate-bounce' : ''}`} />
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-base text-[#0B2945]">
                    Status: {settings.enabled ? 'Em Manutenção' : 'Sistema Online'}
                  </h3>
                  {settings.enabled ? (
                    <Badge className="bg-amber-600 hover:bg-amber-600 text-white font-semibold text-[11px] px-2.5 py-0.5">
                      Bloqueio ativo para usuários
                    </Badge>
                  ) : (
                    <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white font-semibold text-[11px] px-2.5 py-0.5">
                      Acesso liberado
                    </Badge>
                  )}
                </div>

                <p className="text-xs text-[#5B6B7B] max-w-2xl leading-relaxed">
                  {settings.enabled
                    ? 'O sistema está bloqueado para visitantes e usuários normais. Apenas Superadministradores conseguem acessar e navegar nos módulos.'
                    : 'Todos os usuários autenticados têm acesso normal às telas e recursos atribuídos aos seus perfis.'}
                </p>

                {settings.updatedAt && (
                  <div className="flex items-center gap-2 pt-1 text-[11px] text-[#5B6B7B]">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Última alteração: {formatDate(settings.updatedAt)}</span>
                    {settings.updatedBy && (
                      <>
                        <span>•</span>
                        <span>por {settings.updatedBy}</span>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => void refreshSettings()}
                      className="ml-1 text-slate-400 hover:text-primary transition-colors p-0.5 rounded cursor-pointer"
                      title="Recarregar status do banco de dados"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Toggle Switch */}
            <div className="flex items-center gap-3 self-end sm:self-center shrink-0 pt-2 sm:pt-0">
              <div className="flex items-center gap-3 bg-white px-4 py-2.5 rounded-lg border border-[#DDE6F0] shadow-xs">
                {isToggling ? (
                  <div className="flex items-center gap-1.5 text-xs text-primary font-medium">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Salvando...</span>
                  </div>
                ) : (
                  <Label
                    htmlFor="maintenance-switch"
                    className="text-xs font-semibold cursor-pointer select-none"
                  >
                    {settings.enabled ? 'Desativar Manutenção' : 'Ativar Manutenção'}
                  </Label>
                )}
                <Switch
                  id="maintenance-switch"
                  checked={settings.enabled}
                  onCheckedChange={handleToggle}
                  disabled={isToggling || isLoading}
                />
              </div>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="mt-4 pt-4 border-t border-[#DDE6F0]/80 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                asChild
                className="text-xs border-[#DDE6F0] text-[#1B2B3A] hover:bg-[#EEF3F9]"
              >
                <a href="/manutencao-sistema" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                  Visualizar Página de Manutenção
                </a>
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowConfig(!showConfig)}
                className="text-xs text-[#1976D2] hover:text-[#1565C0] hover:bg-blue-50"
              >
                {showConfig ? 'Ocultar personalização de mensagens' : 'Personalizar mensagens da página'}
              </Button>
            </div>

            {settings.enabled && (
              <span className="text-xs text-amber-800 font-medium bg-amber-100/70 px-2.5 py-1 rounded-md border border-amber-200">
                Chave de bypass técnico: <code className="font-mono font-bold">{settings.bypassSecret}</code>
              </span>
            )}
          </div>
        </div>

        {/* Collapsible Customization Form */}
        {showConfig && (
          <form
            onSubmit={handleSaveTexts}
            className="p-5 rounded-xl border border-[#DDE6F0] bg-[#F6F9FD] space-y-4 animate-in fade-in-50 duration-200"
          >
            <div className="border-b border-[#DDE6F0] pb-2">
              <h4 className="font-bold text-sm text-[#0B2945]">
                Configuração dos Textos Exibidos na Página de Manutenção
              </h4>
              <p className="text-xs text-[#5B6B7B]">
                Personalize o título, a mensagem explicativa e o prazo informado aos usuários.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="maint-title" className="text-xs font-semibold text-[#1B2B3A]">
                  Título Principal
                </Label>
                <Input
                  id="maint-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Sistema em Manutenção"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="maint-return" className="text-xs font-semibold text-[#1B2B3A]">
                  Previsão de Retorno
                </Label>
                <Input
                  id="maint-return"
                  value={estimatedReturn}
                  onChange={(e) => setEstimatedReturn(e.target.value)}
                  placeholder="Ex: Previsão de retorno às 14:00"
                  required
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="maint-subtitle" className="text-xs font-semibold text-[#1B2B3A]">
                  Subtítulo / Destaque
                </Label>
                <Input
                  id="maint-subtitle"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="Ex: Estamos realizando melhorias programadas..."
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="maint-desc" className="text-xs font-semibold text-[#1B2B3A]">
                  Descrição Detalhada
                </Label>
                <Textarea
                  id="maint-desc"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Explique o motivo da manutenção e orientações para o usuário..."
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="maint-bypass" className="text-xs font-semibold text-[#1B2B3A] flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                  Chave Secreta de Bypass Técnico
                </Label>
                <Input
                  id="maint-bypass"
                  value={bypassSecret}
                  onChange={(e) => setBypassSecret(e.target.value)}
                  placeholder="siages"
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  Permite acessar o sistema passando <code className="bg-slate-100 px-1 py-0.5 rounded">?bypass={bypassSecret || 'chave'}</code> na URL.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowConfig(false)}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSavingTexts}
                className="text-xs bg-[#1976D2] hover:bg-[#1565C0] text-white"
              >
                {isSavingTexts ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5 mr-1.5" />
                    Salvar Mensagens
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
    </SectionPanel>
  );
}
