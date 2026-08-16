import { useState, useEffect, useCallback } from 'react';
import {
  Mail,
  Zap,
  Users,
  Sliders,
  Send,
  Plus,
  Trash2,
  ChevronRight,
  ChevronLeft,
  Loader2,
  CheckCircle2,
  XCircle,
  Eye,
  UserPlus,
  Download,
  Clock,
  Info,
  ListChecks,
  ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

import {
  priceResearchEmailService,
  MODALITY_LABELS,
  MODALITY_DESCRIPTIONS,
  type QuotationModality,
  type PriceResearchSupplier,
  type SendQuotationResult,
  type Supplier,
} from '@/services/priceResearchEmail';
import type { PriceResearchItem } from '@/lib/priceResearch';
import { SupplierEmailHistory } from './SupplierEmailHistory';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RecipientDraft = {
  key: string;          // internal key for React
  supplierId?: string;
  name: string;
  email: string;
  customMessage: string;
  selected: boolean;
  itemNumbers?: string[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  researchId: string;
  objectDescription: string;
  processNumber?: string;
  responsibleName: string;
  items: PriceResearchItem[];
  onSent?: () => void;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STEPS = ['Modalidade', 'Fornecedores', 'Dados', 'Confirmar', 'Resultado'];
const MODALITIES: QuotationModality[] = ['direct', 'express', 'batch', 'custom', 'manual'];

const DEFAULT_EMAIL_INSTRUCTIONS = [
  'Enviar proposta em papel timbrado da empresa, com CNPJ, preços unitários e totais;',
  'Incluir validade mínima da proposta de 60 (sessenta) dias;',
  'Informar marca e/ou modelo dos produtos, quando aplicável;',
  'Encaminhar a proposta para o e-mail indicado no campo Reply-To;',
  'Identificar o e-mail com o assunto da cotação.',
].join('\n');

const MODALITY_ICONS: Record<QuotationModality, React.ReactNode> = {
  direct:   <Send className="w-5 h-5" />,
  express:  <Zap className="w-5 h-5" />,
  batch:    <Users className="w-5 h-5" />,
  custom:   <Sliders className="w-5 h-5" />,
  manual:   <Mail className="w-5 h-5" />,
};

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function getSavedEmailField(key: string, legacyDefault: string) {
  const saved = localStorage.getItem(key);
  const migrationKey = `${key}_legacy_default_cleared`;
  if (saved === legacyDefault && !localStorage.getItem(migrationKey)) {
    localStorage.removeItem(key);
    localStorage.setItem(migrationKey, '1');
    return '';
  }
  return saved || '';
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SupplierEmailDialog({
  open,
  onClose,
  researchId,
  objectDescription,
  processNumber,
  responsibleName,
  items,
  onSent,
}: Props) {
  const [step, setStep] = useState(0);
  const [modality, setModality] = useState<QuotationModality>('batch');
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);

  // Suppliers from DB
  const [dbSuppliers, setDbSuppliers] = useState<PriceResearchSupplier[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);

  // Recipients draft list
  const [recipients, setRecipients] = useState<RecipientDraft[]>([]);

  // New supplier form
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newDoc, setNewDoc] = useState('');
  const [newContact, setNewContact] = useState('');
  const [isSavingSupplier, setIsSavingSupplier] = useState(false);

  // Autocomplete suggestions
  const [suggestions, setSuggestions] = useState<Supplier[]>([]);
  const [selectedGlobalSupplier, setSelectedGlobalSupplier] = useState<Supplier | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Message
  const [deadlineDate, setDeadlineDate] = useState('');
  const [deadlineBusinessDays, setDeadlineBusinessDays] = useState<number | ''>('');
  const [additionalMessage, setAdditionalMessage] = useState('');
  const [instructions, setInstructions] = useState(() => localStorage.getItem('price_research_email_instructions') || DEFAULT_EMAIL_INSTRUCTIONS);
  const [replyTo, setReplyTo] = useState('');
  const [previewHtml, setPreviewHtml] = useState('');

  const [agencyName, setAgencyName] = useState(() => getSavedEmailField('price_research_email_agency_name', 'Instituto Federal do Rio Grande do Norte'));
  const [agencySub, setAgencySub] = useState(() => getSavedEmailField('price_research_email_agency_sub', 'Campus Currais Novos'));
  const [agencySector, setAgencySector] = useState(() => getSavedEmailField('price_research_email_agency_sector', 'Setor de Licitações e Contratos'));

  useEffect(() => {
    localStorage.setItem('price_research_email_agency_name', agencyName);
  }, [agencyName]);

  useEffect(() => {
    localStorage.setItem('price_research_email_agency_sub', agencySub);
  }, [agencySub]);

  useEffect(() => {
    localStorage.setItem('price_research_email_agency_sector', agencySector);
  }, [agencySector]);

  useEffect(() => {
    localStorage.setItem('price_research_email_instructions', instructions);
  }, [instructions]);

  // Send state
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<SendQuotationResult | null>(null);
  const [expandedRecipients, setExpandedRecipients] = useState<Record<string, boolean>>({});

  // ---------------------------------------------------------------------------
  // Load saved suppliers on open
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!open) return;
    setStep(0);
    setSendResult(null);
    setExpandedRecipients({});
    setLoadingSuppliers(true);
    priceResearchEmailService
      .listSuppliers(researchId)
      .then((list) => {
        setDbSuppliers(list);
        // Pre-populate recipients from existing suppliers
        setRecipients(
          list.map((s) => ({
            key: s.id,
            supplierId: s.id,
            name: s.name,
            email: s.email,
            customMessage: '',
            selected: true,
          })),
        );
      })
      .catch(console.error)
      .finally(() => setLoadingSuppliers(false));
  }, [open, researchId]);

  // ---------------------------------------------------------------------------
  // Autocomplete Suggestions logic
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!newName.trim() || newName.length < 2) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const results = await priceResearchEmailService.searchGlobalSuppliers(newName);
        // Filter out suppliers already linked to this research
        const linkedIds = new Set(dbSuppliers.map((s) => s.id));
        const filtered = results.filter((r) => !linkedIds.has(r.id));
        setSuggestions(filtered);
      } catch (err) {
        console.error(err);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [newName, dbSuppliers]);

  // Clear selection if name input changes from original selected name
  useEffect(() => {
    if (selectedGlobalSupplier && newName !== selectedGlobalSupplier.name) {
      setSelectedGlobalSupplier(null);
    }
  }, [newName, selectedGlobalSupplier]);

  const handleSelectSuggestion = (s: Supplier) => {
    setNewName(s.name);
    setNewEmail(s.email);
    setNewDoc(s.document || '');
    setNewContact(s.contactName || '');
    setSelectedGlobalSupplier(s);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  // ---------------------------------------------------------------------------
  // Add/Link supplier
  // ---------------------------------------------------------------------------
  const handleAddSupplier = useCallback(async () => {
    if (!newName.trim()) { toast.error('Informe o nome do fornecedor.'); return; }
    if (!isValidEmail(newEmail)) { toast.error('Informe um e-mail válido.'); return; }

    setIsSavingSupplier(true);
    try {
      let saved: PriceResearchSupplier;
      if (selectedGlobalSupplier) {
        await priceResearchEmailService.linkSupplierToResearch(researchId, selectedGlobalSupplier.id);
        saved = {
          ...selectedGlobalSupplier,
          researchId,
        };
      } else {
        saved = await priceResearchEmailService.saveSupplier(researchId, {
          name: newName.trim(),
          email: newEmail.trim(),
          document: newDoc.trim() || undefined,
          contactName: newContact.trim() || undefined,
        });
      }
      setDbSuppliers((prev) => [...prev, saved]);
      setRecipients((prev) => [
        ...prev,
        {
          key: saved.id,
          supplierId: saved.id,
          name: saved.name,
          email: saved.email,
          customMessage: '',
          selected: true,
        },
      ]);
      setNewName(''); setNewEmail(''); setNewDoc(''); setNewContact('');
      setSelectedGlobalSupplier(null);
      toast.success(selectedGlobalSupplier ? 'Fornecedor vinculado com sucesso!' : 'Fornecedor cadastrado e vinculado!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar/vincular fornecedor.');
    } finally {
      setIsSavingSupplier(false);
    }
  }, [researchId, newName, newEmail, newDoc, newContact, selectedGlobalSupplier]);

  // Delete/Unlink supplier
  const handleDeleteSupplier = useCallback(async (supplierId: string) => {
    try {
      await priceResearchEmailService.deleteSupplier(researchId, supplierId);
      setDbSuppliers((prev) => prev.filter((s) => s.id !== supplierId));
      setRecipients((prev) => prev.filter((r) => r.supplierId !== supplierId));
      toast.success('Fornecedor desvinculado da pesquisa.');
    } catch (err) {
      toast.error('Erro ao remover vínculo do fornecedor.');
    }
  }, [researchId]);

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------
  const selectedRecipients = recipients.filter((r) => r.selected);
  const activeItems = items.map((item) => ({
    itemNumber: item.itemNumber,
    description: item.description,
    unit: item.unit,
    quantity: item.quantity,
  }));

  const canGoNext = () => {
    if (step === 0) return true; // modality always selected
    if (step === 1) return selectedRecipients.length > 0;
    if (step === 2) return agencyName.trim().length > 0;
    if (step === 3) return selectedRecipients.length > 0 && activeItems.length > 0;
    return false;
  };

  const goNext = () => {
    if (!canGoNext()) return;
    if (step === 2) {
      // Build preview for first recipient
      const first = selectedRecipients[0];
      if (first) {
        // Simple preview text
        setPreviewHtml(
          `<p><strong>Para:</strong> ${first.name} &lt;${first.email}&gt;</p>` +
          `<p><strong>Objeto:</strong> ${objectDescription}</p>` +
          `<p><strong>Itens:</strong> ${activeItems.length} item(ns)</p>` +
          `<p><strong>Prazo:</strong> ${deadlineDate || (deadlineBusinessDays ? `${deadlineBusinessDays} dias úteis` : '3 dias úteis')}</p>`,
        );
      }
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  // ---------------------------------------------------------------------------
  // Send
  // ---------------------------------------------------------------------------
  const handleSend = async () => {
    if (selectedRecipients.length === 0) { toast.error('Selecione ao menos um destinatário.'); return; }
    if (activeItems.length === 0) { toast.error('A pesquisa não possui itens.'); return; }
    if (!agencyName.trim()) { toast.error('Informe o órgão/instituição antes de enviar.'); return; }

    setIsSending(true);
    try {
      const result = await priceResearchEmailService.sendQuotation({
        researchId,
        modality,
        recipients: selectedRecipients.map((r) => {
          let recipientItems = undefined;
          if (modality === 'direct' && r.supplierId) {
            const dbSup = dbSuppliers.find((s) => s.id === r.supplierId);
            if (dbSup) {
              const matchedItems = items.filter((item) => {
                return (item.candidates || []).some((c) => {
                  const docMatch = dbSup.document && c.supplierDocument && c.supplierDocument.replace(/\D/g, '') === dbSup.document.replace(/\D/g, '');
                  const nameMatch = c.supplierName && c.supplierName.toLowerCase().includes(dbSup.name.toLowerCase());
                  return docMatch || nameMatch;
                });
              });
              if (matchedItems.length > 0) {
                recipientItems = matchedItems.map((item) => ({
                  itemNumber: item.itemNumber,
                  description: item.description,
                  unit: item.unit,
                  quantity: item.quantity,
                }));
              }
            }
          }
          return {
            supplierId: r.supplierId,
            name: r.name,
            email: r.email,
            customMessage: modality === 'custom' ? r.customMessage : undefined,
            items: recipientItems,
          };
        }),
        items: activeItems,
        objectDescription,
        processNumber,
        responsibleName,
        deadlineDate: deadlineDate || undefined,
        deadlineBusinessDays: deadlineBusinessDays ? Number(deadlineBusinessDays) : undefined,
        additionalMessage: additionalMessage || undefined,
        instructions: instructions || undefined,
        replyTo: replyTo || undefined,
        agencyName: agencyName.trim(),
        agencySub: agencySub.trim(),
        agencySector: agencySector.trim(),
      });
      setSendResult(result);
      setStep(4);
      if (result.summary.failed === 0) {
        toast.success(`${result.summary.sent} e-mail(s) enviado(s) com sucesso!`);
      } else {
        toast.warning(`${result.summary.sent} enviado(s), ${result.summary.failed} falha(s).`);
      }
      onSent?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar e-mails.');
    } finally {
      setIsSending(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render steps
  // ---------------------------------------------------------------------------

  const renderStep = () => {
    // STEP 0 — Modalidade
    if (step === 0) {
      return (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Selecione o tipo de cotação que será enviada aos fornecedores.
          </p>
          <div className="grid grid-cols-1 gap-2">
            {MODALITIES.map((m) => (
              <button
                key={m}
                onClick={() => setModality(m)}
                className={`flex items-start gap-4 p-4 rounded-lg border-2 text-left transition-all ${
                  modality === m
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/40 hover:bg-muted/50'
                }`}
              >
                <span className={`mt-0.5 ${modality === m ? 'text-primary' : 'text-muted-foreground'}`}>
                  {MODALITY_ICONS[m]}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`font-semibold text-sm ${modality === m ? 'text-primary' : 'text-foreground'}`}>
                    {MODALITY_LABELS[m]}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    {MODALITY_DESCRIPTIONS[m]}
                  </p>
                </div>
                {modality === m && <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      );
    }

    // STEP 1 — Fornecedores
    if (step === 1) {
      return (
        <div className="space-y-4">
          {/* Existing suppliers list */}
          {loadingSuppliers ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando fornecedores…
            </div>
          ) : recipients.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">
                Selecione os fornecedores que receberão o e-mail:
              </p>
              {recipients.map((r) => {
                const isExpanded = expandedRecipients[r.key] ?? false;
                const selectedCount = r.itemNumbers ? r.itemNumbers.length : activeItems.length;

                return (
                  <div
                    className={`flex flex-col gap-2.5 p-3 rounded-lg border transition-all ${
                      r.selected ? 'border-primary/30 bg-primary/5' : 'border-border bg-background'
                    }`}
                    key={r.key}
                  >
                    <div className="flex items-center gap-3 w-full">
                      <Checkbox
                        id={`supplier-${r.key}`}
                        checked={r.selected}
                        onCheckedChange={(checked) =>
                          setRecipients((prev) =>
                            prev.map((p) => p.key === r.key ? { ...p, selected: !!checked } : p),
                          )
                        }
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{r.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{r.email}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        {r.selected && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setExpandedRecipients((prev) => ({
                                ...prev,
                                [r.key]: !prev[r.key],
                              }))
                            }
                            className="h-7 px-2 text-[10px] gap-1 hover:bg-muted font-semibold text-primary"
                          >
                            <ListChecks className="w-3.5 h-3.5" />
                            Itens ({selectedCount}/{activeItems.length})
                            <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </Button>
                        )}

                        {modality === 'custom' && r.selected && (
                          <Input
                            placeholder="Mensagem personalizada…"
                            value={r.customMessage}
                            onChange={(e) =>
                              setRecipients((prev) =>
                                prev.map((p) => p.key === r.key ? { ...p, customMessage: e.target.value } : p),
                              )
                            }
                            className="w-48 h-8 text-xs"
                          />
                        )}
                        {r.supplierId && (
                          <button
                            onClick={() => handleDeleteSupplier(r.supplierId!)}
                            className="text-muted-foreground hover:text-destructive transition-colors p-1"
                            type="button"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Collapsible checklist of items */}
                    {r.selected && isExpanded && (
                      <div className="pl-7 border-t pt-2 space-y-2">
                        <p className="text-[11px] font-semibold text-muted-foreground">Itens inclusos para este fornecedor:</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto p-2 border rounded bg-background shadow-inner">
                          {activeItems.map((item) => {
                            const isItemChecked = !r.itemNumbers || r.itemNumbers.includes(item.itemNumber);
                            return (
                              <label
                                key={item.itemNumber}
                                className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/40 p-1.5 rounded transition-colors"
                              >
                                <Checkbox
                                  checked={isItemChecked}
                                  onCheckedChange={(checked) => {
                                    setRecipients((prev) =>
                                      prev.map((p) => {
                                        if (p.key !== r.key) return p;
                                        const currentItems = p.itemNumbers || activeItems.map((ai) => ai.itemNumber);
                                        let nextItems: string[];
                                        if (checked) {
                                          nextItems = [...currentItems, item.itemNumber];
                                        } else {
                                          nextItems = currentItems.filter((num) => num !== item.itemNumber);
                                        }
                                        return { ...p, itemNumbers: nextItems };
                                      })
                                    );
                                  }}
                                />
                                <span className="font-mono text-primary font-bold">{item.itemNumber}</span>
                                <span className="truncate text-foreground max-w-[200px]" title={item.description}>{item.description}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
              <Users className="w-8 h-8" />
              <p className="text-sm">Nenhum fornecedor vinculado a esta pesquisa.</p>
              <p className="text-xs">Utilize o campo abaixo para buscar ou criar.</p>
            </div>
          )}

          {/* Add new supplier form */}
          <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
            <div className="flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-primary" />
              <p className="text-sm font-semibold text-foreground">Adicionar ou Vincular Fornecedor</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1 relative">
                <Label htmlFor="sup-name" className="text-xs">Nome / Razão Social *</Label>
                <Input
                  id="sup-name"
                  placeholder="Ex: Papelaria Central Ltda"
                  value={newName}
                  onChange={(e) => { setNewName(e.target.value); setShowSuggestions(true); }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  className="h-8 text-sm"
                  autoComplete="off"
                />
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-popover text-popover-foreground border rounded-md shadow-md max-h-48 overflow-y-auto">
                    {suggestions.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => handleSelectSuggestion(s)}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-accent hover:text-accent-foreground transition-colors border-b last:border-b-0"
                      >
                        <p className="font-semibold">{s.name}</p>
                        <p className="text-muted-foreground">{s.email} {s.document ? `· ${s.document}` : ''}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="sup-email" className="text-xs">E-mail *</Label>
                <Input
                  id="sup-email"
                  type="email"
                  placeholder="contato@empresa.com.br"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sup-doc" className="text-xs">CNPJ (opcional)</Label>
                <Input
                  id="sup-doc"
                  placeholder="00.000.000/0001-00"
                  value={newDoc}
                  onChange={(e) => setNewDoc(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sup-contact" className="text-xs">Contato (opcional)</Label>
                <Input
                  id="sup-contact"
                  placeholder="Nome do contato"
                  value={newContact}
                  onChange={(e) => setNewContact(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <Button
              variant={selectedGlobalSupplier ? "default" : "outline"}
              size="sm"
              className={`w-full gap-2 ${selectedGlobalSupplier ? 'bg-green-600 hover:bg-green-700 text-white' : ''}`}
              onClick={handleAddSupplier}
              disabled={isSavingSupplier || !newName.trim() || !newEmail.trim()}
              type="button"
            >
              {isSavingSupplier ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : selectedGlobalSupplier ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              {selectedGlobalSupplier ? 'Vincular Fornecedor Existente' : 'Cadastrar e Vincular'}
            </Button>
          </div>

          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <Info className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700 leading-relaxed">
              Digite o nome para buscar fornecedores já cadastrados no sistema. Se não for encontrado,
              o fornecedor será cadastrado globalmente e vinculado à pesquisa atual.
            </p>
          </div>
        </div>
      );
    }

    // STEP 2 — Mensagem
    if (step === 2) {
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="agency-name" className="text-xs font-medium">
                Órgão / Instituição *
              </Label>
              <Input
                id="agency-name"
                value={agencyName}
                onChange={(e) => setAgencyName(e.target.value)}
                placeholder="Ex: Instituto Federal do Rio Grande do Norte"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="agency-sub" className="text-xs font-medium">
                Unidade / Campus (opcional)
              </Label>
              <Input
                id="agency-sub"
                value={agencySub}
                onChange={(e) => setAgencySub(e.target.value)}
                placeholder="Ex: Campus Currais Novos"
                className="h-9 text-sm"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="agency-sector" className="text-xs font-medium">
              Setor responsável
            </Label>
            <Input
              id="agency-sector"
              value={agencySector}
              onChange={(e) => setAgencySector(e.target.value)}
              placeholder="Ex: Setor de Licitações e Contratos"
              className="h-9 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="deadline-date" className="text-xs font-medium">
                Prazo — data específica
              </Label>
              <Input
                id="deadline-date"
                type="date"
                value={deadlineDate}
                onChange={(e) => { setDeadlineDate(e.target.value); setDeadlineBusinessDays(''); }}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="deadline-days" className="text-xs font-medium">
                Prazo — dias úteis
              </Label>
              <Input
                id="deadline-days"
                type="number"
                min={1}
                max={30}
                placeholder="Ex: 3"
                value={deadlineBusinessDays}
                onChange={(e) => { setDeadlineBusinessDays(e.target.value ? Number(e.target.value) : ''); setDeadlineDate(''); }}
                className="h-9 text-sm"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="reply-to" className="text-xs font-medium">
              E-mail de resposta (Reply-To)
            </Label>
            <Input
              id="reply-to"
              type="email"
              placeholder="Ex: licitacoes@ifrn.edu.br (padrão: EMAIL_FROM)"
              value={replyTo}
              onChange={(e) => setReplyTo(e.target.value)}
              className="h-9 text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Os fornecedores enviarão a proposta para este endereço.
            </p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="instructions" className="text-xs font-medium">
              Instruções para envio da proposta
            </Label>
            <Textarea
              id="instructions"
              placeholder="Uma instrução por linha"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={5}
              className="text-sm resize-none"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="add-msg" className="text-xs font-medium">
              Observações adicionais (opcional)
            </Label>
            <Textarea
              id="add-msg"
              placeholder="Informe requisitos específicos, condições de entrega, etc."
              value={additionalMessage}
              onChange={(e) => setAdditionalMessage(e.target.value)}
              rows={4}
              className="text-sm resize-none"
            />
          </div>

        </div>
      );
    }

    // STEP 3 — Confirmar
    if (step === 3) {
      return (
        <div className="space-y-4">
          <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg space-y-2">
            <p className="text-xs font-semibold text-foreground flex items-center gap-2">
              <Mail className="w-4 h-4 text-primary" /> Confirme as informações gerais
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <p><strong className="text-foreground">Modalidade:</strong> {MODALITY_LABELS[modality]}</p>
              <p><strong className="text-foreground">Responsável:</strong> {responsibleName}</p>
              <p><strong className="text-foreground">Setor:</strong> {agencySector || 'Setor de Licitações e Contratos'}</p>
              <p><strong className="text-foreground">Destinatários:</strong> {selectedRecipients.length} fornecedor(es)</p>
              <p>
                <strong className="text-foreground">Prazo:</strong>{' '}
                {deadlineDate
                  ? new Date(`${deadlineDate}T12:00:00`).toLocaleDateString('pt-BR')
                  : deadlineBusinessDays
                  ? `${deadlineBusinessDays} dia(s) útil(eis)`
                  : modality === 'express'
                  ? '1 dia útil (padrão urgente)'
                  : '3 dias úteis (padrão)'}
              </p>
            </div>
          </div>

          {/* Email Body Preview */}
          <div className="space-y-1.5">
            <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-primary" />
              Pré-visualização do E-mail (Exemplo para {selectedRecipients[0]?.name || 'destinatário'}):
            </p>
            <div className="border rounded-lg overflow-hidden bg-slate-50 text-[13px] max-h-72 overflow-y-auto font-sans shadow-inner border-border-default/80">
              {/* Header */}
              <div className={`p-4 text-white ${modality === 'express' ? 'bg-red-700' : 'bg-primary'}`}>
                <p className="text-[9px] uppercase tracking-wider opacity-70">{agencyName}</p>
                <p className="font-bold text-sm">Solicitação de Cotação de Preços</p>
                <p className="text-[10px] opacity-80">{MODALITY_LABELS[modality]} · {new Date().toLocaleDateString('pt-BR')}</p>
              </div>
              {/* Body */}
              <div className="p-4 bg-white space-y-3 leading-relaxed text-slate-700">
                <p>Prezado(a) <strong>{selectedRecipients[0]?.name || '[Nome Fornecedor]'}</strong>,</p>
                <p>
                  O <strong>{agencyName}{agencySub ? ` — ${agencySub}` : ''}</strong> solicita a gentileza de encaminhar proposta de preços
                  para os itens abaixo relacionados, visando à pesquisa de preços para futura aquisição, em conformidade
                  com o art. 23 da Lei nº 14.133/2021 e a Instrução Normativa SEGES/ME nº 65/2021.
                </p>
                
                {/* Meta data box */}
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-md text-xs text-blue-900 space-y-1">
                  {processNumber && <p><strong>Processo:</strong> {processNumber}</p>}
                  <p><strong>Objeto:</strong> {objectDescription}</p>
                  <p><strong>Responsável:</strong> {responsibleName}</p>
                  <p className="text-red-700">
                    <strong>Prazo para resposta:</strong>{' '}
                    {deadlineDate
                      ? new Date(`${deadlineDate}T12:00:00`).toLocaleDateString('pt-BR')
                      : deadlineBusinessDays
                      ? `${deadlineBusinessDays} dia(s) útil(eis) após o recebimento`
                      : modality === 'express'
                      ? '1 (um) dia útil (URGENTE)'
                      : '3 (três) dias úteis'}
                  </p>
                </div>

                {/* Items table */}
                <div className="border rounded overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 border-b text-slate-800">
                        <th className="p-2 w-8 text-center font-bold">Nº</th>
                        <th className="p-2 font-bold">Descrição</th>
                        <th className="p-2 w-12 text-center font-bold">Unid.</th>
                        <th className="p-2 w-12 text-center font-bold">Qtd.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedRecipients[0]?.itemNumbers 
                        ? activeItems.filter((i) => selectedRecipients[0].itemNumbers!.includes(i.itemNumber))
                        : activeItems
                      ).map((item) => (
                        <tr key={item.itemNumber} className="border-b last:border-b-0 hover:bg-slate-50">
                          <td className="p-2 text-center text-slate-500">{item.itemNumber}</td>
                          <td className="p-2 font-medium text-slate-900 truncate max-w-[280px]">{item.description}</td>
                          <td className="p-2 text-center">{item.unit}</td>
                          <td className="p-2 text-center">{item.quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Additional message / custom */}
                {(selectedRecipients[0]?.customMessage || additionalMessage) && (
                  <div className="p-3 bg-amber-50 border-l-4 border-amber-500 rounded text-amber-900 text-xs">
                    <p className="font-bold">Observações:</p>
                    <p className="mt-1 whitespace-pre-line">{selectedRecipients[0]?.customMessage || additionalMessage}</p>
                  </div>
                )}

                {/* Instructions */}
                <div className="p-3 bg-slate-50 border rounded text-xs text-slate-600 space-y-1">
                  <p className="font-bold text-slate-800 uppercase tracking-wide text-[10px]">Instruções para envio:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    {(instructions || DEFAULT_EMAIL_INSTRUCTIONS).split(/\r?\n/).filter(Boolean).map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>

                <div className="pt-2 text-xs text-slate-500">
                  <p className="font-semibold text-slate-700">{responsibleName}</p>
                  <p>{agencySector || 'Setor de Licitações e Contratos'}</p>
                  <p>{agencyName}{agencySub ? ` — ${agencySub}` : ''}</p>
                  <p>Este e-mail foi gerado automaticamente pelo SIAGES - Sistema Integrado de Administração e Gestão Estratégica.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // STEP 4 — Resultado
    if (step === 4 && sendResult) {
      return (
        <div className="space-y-4">
          {/* Summary badges */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col items-center gap-1 p-4 rounded-lg bg-green-50 border border-green-200">
              <p className="text-3xl font-bold text-green-700">{sendResult.summary.sent}</p>
              <p className="text-xs text-green-600 font-medium">Enviado(s) com sucesso</p>
            </div>
            <div className="flex flex-col items-center gap-1 p-4 rounded-lg bg-red-50 border border-red-200">
              <p className="text-3xl font-bold text-red-700">{sendResult.summary.failed}</p>
              <p className="text-xs text-red-600 font-medium">Com falha</p>
            </div>
          </div>

          {/* Per-recipient detail */}
          <div className="space-y-2">
            {sendResult.results.map((r, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-3 p-3 rounded-lg border text-sm ${
                  r.status === 'sent'
                    ? 'border-green-200 bg-green-50'
                    : 'border-red-200 bg-red-50'
                }`}
              >
                {r.status === 'sent' ? (
                  <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-600 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className={`font-medium truncate ${r.status === 'sent' ? 'text-green-800' : 'text-red-800'}`}>
                    {r.name}
                  </p>
                  <p className={`text-xs truncate ${r.status === 'sent' ? 'text-green-600' : 'text-red-600'}`}>
                    {r.email}
                  </p>
                  {r.errorMessage && (
                    <p className="text-xs text-red-500 mt-0.5 truncate">{r.errorMessage}</p>
                  )}
                </div>
                {r.sentAt && (
                  <p className="text-xs text-muted-foreground shrink-0">
                    {new Date(r.sentAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      );
    }

    return null;
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const handleClose = () => {
    setIsHistoryDialogOpen(false);
    onClose();
  };

  return (
    <>
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="flex w-[calc(100vw-2rem)] max-w-4xl max-h-[90vh] flex-col gap-0 overflow-hidden border border-border-default bg-surface-card p-0 text-text-primary shadow-xl sm:rounded-radius-xl">
        <DialogHeader className="border-b border-border-default bg-surface-subtle/45 px-6 py-4 pr-12">
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-text-primary">
            <Mail className="h-5 w-5 text-primary" />
            Solicitar Cotação por E-mail
          </DialogTitle>
          <DialogDescription className="text-xs text-text-secondary">
            Envie e-mails de cotação diretamente para fornecedores a partir desta pesquisa de preços.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
          {/* Step indicator */}
          <div className="flex items-center gap-1 px-1">
          {STEPS.map((label, idx) => (
            <div className="flex min-w-0 flex-1 items-center gap-1" key={label}>
              <div
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all ${
                  idx < step
                    ? 'bg-primary text-primary-foreground'
                    : idx === step
                    ? 'bg-primary/20 text-primary ring-2 ring-primary'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {idx < step ? <CheckCircle2 className="h-3.5 w-3.5" /> : idx + 1}
              </div>
              <span
                className={`hidden truncate text-xs sm:block ${
                  idx === step ? 'font-medium text-primary' : 'text-muted-foreground'
                }`}
              >
                {label}
              </span>
              {idx < STEPS.length - 1 && (
                <div
                  className={`mx-1 h-0.5 flex-1 rounded-full transition-all ${
                    idx < step ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              )}
            </div>
          ))}
          </div>

          {/* Step content */}
          <div className="min-h-0 flex-1">
            {renderStep()}
          </div>
        </div>

        {/* Footer navigation */}
        <div className="flex items-center justify-between border-t border-border-default bg-surface-subtle/45 px-6 py-3.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={step === 4 ? onClose : goBack}
            disabled={step === 0 || isSending}
            className="gap-1.5"
            type="button"
          >
            {step === 4 ? null : <ChevronLeft className="w-4 h-4" />}
            {step === 4 ? 'Fechar' : step === 0 ? '' : 'Voltar'}
          </Button>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsHistoryDialogOpen(true)}
              disabled={!researchId}
              className="gap-1.5"
              title={researchId ? 'Abrir histórico de e-mails' : 'Salve a pesquisa para consultar o histórico de e-mails'}
              type="button"
            >
              <Clock className="h-4 w-4" />
              Histórico de e-mails
            </Button>

            {step < 3 && (
              <Button
                size="sm"
                onClick={goNext}
                disabled={!canGoNext()}
                className="gap-1.5"
                type="button"
              >
                {step === 3 ? 'Confirmar' : 'Próximo'}
                <ChevronRight className="w-4 h-4" />
              </Button>
            )}

            {step === 3 && (
              <Button
                size="sm"
                onClick={handleSend}
                disabled={isSending || selectedRecipients.length === 0}
                className="gap-2 bg-primary hover:bg-primary/90"
                type="button"
              >
                {isSending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Enviando…</>
                ) : (
                  <><Send className="w-4 h-4" /> Enviar {selectedRecipients.length} cotação(ões)</>
                )}
              </Button>
            )}

            {step === 4 && (
              <Button size="sm" variant="default" onClick={onClose} className="gap-1.5" type="button">
                Concluir
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
      <DialogContent className="flex w-[calc(100vw-2rem)] max-w-3xl max-h-[85vh] flex-col gap-0 overflow-hidden border border-border-default bg-surface-card p-0 text-text-primary shadow-xl sm:rounded-radius-xl">
        <DialogHeader className="border-b border-border-default bg-surface-subtle/45 px-6 py-4 pr-12">
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-text-primary">
            <Clock className="h-5 w-5 text-primary" />
            Histórico de e-mails
          </DialogTitle>
          <DialogDescription className="text-xs text-text-secondary">
            Consulte os envios de solicitação de cotação registrados para esta pesquisa.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <SupplierEmailHistory researchId={researchId} defaultExpanded showEmptyState />
        </div>
        <DialogFooter className="border-t border-border-default bg-surface-subtle/45 px-6 py-3.5">
          <Button size="sm" variant="outline" onClick={() => setIsHistoryDialogOpen(false)} type="button">
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
