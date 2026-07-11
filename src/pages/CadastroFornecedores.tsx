import { useEffect, useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Users,
  Trash2,
  Pencil,
  Plus,
  Loader2,
  X,
  Search,
  Building,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  MapPin,
  Calendar,
  ShieldCheck,
  ExternalLink,
  ShieldAlert,
  Globe2,
} from 'lucide-react';
import { toast } from 'sonner';

import { priceResearchEmailService, type Supplier } from '@/services/priceResearchEmail';
import { supplierComplianceService, type SupplierCertificate, CERTIFICATE_LABELS } from '@/services/supplierCompliance';

export default function CadastroFornecedoresPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Compliance state
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [selectedSupplierForCerts, setSelectedSupplierForCerts] = useState<Supplier | null>(null);
  const [certsList, setCertsList] = useState<SupplierCertificate[]>([]);
  const [isLoadingCerts, setIsLoadingCerts] = useState(false);
  const [isCertModalOpen, setIsCertModalOpen] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [editingId, setEditingId] = useState<string | undefined>();
  const [name, setName] = useState('');
  const [document, setDocument] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [contactName, setContactName] = useState('');
  const [notes, setNotes] = useState('');
  const [city, setCity] = useState('');
  const [uf, setUf] = useState('');

  // Load Data
  const loadSuppliers = async () => {
    setIsLoading(true);
    try {
      const list = await priceResearchEmailService.listGlobalSuppliers();
      setSuppliers(list);
    } catch (err) {
      console.error(err);
      toast.error('Falha ao carregar fornecedores.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadSuppliers();
  }, []);

  // Save Supplier
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Preencha o nome do fornecedor.');
      return;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error('Informe um e-mail de contato válido.');
      return;
    }

    setIsSaving(true);
    try {
      await priceResearchEmailService.saveGlobalSupplier(
        {
          name: name.trim(),
          document: document.trim() || undefined,
          email: email.trim(),
          phone: phone.trim() || undefined,
          contactName: contactName.trim() || undefined,
          notes: notes.trim() || undefined,
          city: city.trim() || undefined,
          uf: uf.trim().toUpperCase() || undefined,
          statusRegularidade: editingId 
            ? suppliers.find(s => s.id === editingId)?.statusRegularidade 
            : 'NAO_VALIDADO',
        },
        editingId
      );

      toast.success(
        editingId
          ? 'Fornecedor atualizado com sucesso!'
          : 'Fornecedor cadastrado com sucesso!'
      );

      setIsModalOpen(false);
      handleCancelEdit();
      await loadSuppliers();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar fornecedor. CNPJ/CPF duplicado?');
    } finally {
      setIsSaving(false);
    }
  };

  // Edit Supplier
  const handleStartEdit = (s: Supplier) => {
    setEditingId(s.id);
    setName(s.name);
    setDocument(s.document || '');
    setEmail(s.email);
    setPhone(s.phone || '');
    setContactName(s.contactName || '');
    setNotes(s.notes || '');
    setCity(s.city || '');
    setUf(s.uf || '');
    setIsModalOpen(true);
  };

  // Cancel Edit
  const handleCancelEdit = () => {
    setEditingId(undefined);
    setName('');
    setDocument('');
    setEmail('');
    setPhone('');
    setContactName('');
    setNotes('');
    setCity('');
    setUf('');
  };

  // Delete Supplier
  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente remover este fornecedor do cadastro global?')) {
      return;
    }

    setIsDeletingId(id);
    try {
      await priceResearchEmailService.deleteGlobalSupplier(id);
      toast.success('Fornecedor removido com sucesso!');
      await loadSuppliers();
    } catch (err) {
      console.error(err);
      toast.error('Falha ao remover fornecedor.');
    } finally {
      setIsDeletingId(null);
    }
  };

  // Run Compliance Verification
  const handleCheckCompliance = async (s: Supplier) => {
    if (!s.document) {
      toast.error('Fornecedor não possui CNPJ/CPF para realizar consulta.');
      return;
    }
    setVerifyingId(s.id);
    try {
      const result = await supplierComplianceService.checkCompliance(s.id, s.document);
      if (result.status === 'REGULAR') {
        toast.success(`Fornecedor ${s.name} está REGULAR nas bases federais!`);
      } else {
        toast.warning(`Fornecedor ${s.name} possui PENDÊNCIAS ou SANÇÕES ativas.`);
      }
      await loadSuppliers();
      // Immediately open details modal to show the checklist results
      await handleViewCertificates(s);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Falha ao verificar regularidade.');
    } finally {
      setVerifyingId(null);
    }
  };

  // View Certificates Details
  const handleViewCertificates = async (s: Supplier) => {
    setSelectedSupplierForCerts(s);
    setIsLoadingCerts(true);
    setIsCertModalOpen(true);
    try {
      const certs = await supplierComplianceService.getSupplierCertificates(s.id);
      setCertsList(certs);
    } catch (err) {
      console.error(err);
      toast.error('Falha ao buscar histórico de certidões.');
    } finally {
      setIsLoadingCerts(false);
    }
  };

  // Filtered list
  const filteredSuppliers = useMemo(() => {
    if (!searchTerm.trim()) return suppliers;
    const term = searchTerm.toLowerCase();
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        (s.document && s.document.toLowerCase().includes(term)) ||
        s.email.toLowerCase().includes(term) ||
        (s.city && s.city.toLowerCase().includes(term)) ||
        (s.uf && s.uf.toLowerCase().includes(term))
    );
  }, [suppliers, searchTerm]);

  // Dashboard Stats
  const stats = useMemo(() => {
    const total = suppliers.length;
    const regular = suppliers.filter(s => s.statusRegularidade === 'REGULAR').length;
    const irregular = suppliers.filter(s => s.statusRegularidade === 'IRREGULAR').length;
    const naoValidado = suppliers.filter(s => !s.statusRegularidade || s.statusRegularidade === 'NAO_VALIDADO').length;

    // Geographic distribution
    const ufCounts: Record<string, number> = {};
    suppliers.forEach(s => {
      if (s.uf) {
        const state = s.uf.toUpperCase();
        ufCounts[state] = (ufCounts[state] || 0) + 1;
      }
    });

    return {
      total,
      regular,
      irregular,
      naoValidado,
      ufCounts,
    };
  }, [suppliers]);

  return (
    <div className="space-y-6 pb-10">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-surface-card border border-border-subtle/70 rounded-radius-xl shadow-soft">
        <div className="space-y-1">
          <h3 className="text-xl font-bold text-sebrae-navy">Cadastro e Mapa de Fornecedores</h3>
          <p className="text-sm text-text-muted">
            Base integrada de fornecedores, controle de certidões negativas e consultas de idoneidade (TCU, CNJ, CEIS, CNEP).
          </p>
        </div>
        <Button
          type="button"
          onClick={() => {
            handleCancelEdit();
            setIsModalOpen(true);
          }}
          className="btn-primary gap-2 bg-sebrae-blue hover:bg-sebrae-navy text-white font-semibold text-sm h-10 px-4 rounded-radius-md transition-all shrink-0 flex items-center justify-center shadow-md shadow-primary/20"
        >
          <Plus className="h-4 w-4" />
          Cadastrar Fornecedor
        </Button>
      </div>

      {/* Supplier Map & Conformity Stats Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border border-border-default bg-surface-card shadow-sm">
          <CardContent className="pt-4 flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-radius-md">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-text-muted font-medium">Fornecedores Cadastrados</p>
              <h4 className="text-2xl font-bold text-foreground">{stats.total}</h4>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border-default bg-surface-card shadow-sm">
          <CardContent className="pt-4 flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-radius-md">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-text-muted font-medium">Regularizados (Bases Federais)</p>
              <h4 className="text-2xl font-bold text-foreground">
                {stats.regular} <span className="text-xs font-normal text-text-muted">({stats.total > 0 ? Math.round((stats.regular/stats.total)*100) : 0}%)</span>
              </h4>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border-default bg-surface-card shadow-sm">
          <CardContent className="pt-4 flex items-center gap-3">
            <div className="p-2.5 bg-red-50 text-red-600 rounded-radius-md">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-text-muted font-medium">Sanções ou Irregularidades</p>
              <h4 className="text-2xl font-bold text-foreground">
                {stats.irregular} <span className="text-xs font-normal text-text-muted">({stats.total > 0 ? Math.round((stats.irregular/stats.total)*100) : 0}%)</span>
              </h4>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border-default bg-surface-card shadow-sm">
          <CardHeader className="p-3 pb-0">
            <CardTitle className="text-xs font-medium text-text-muted flex items-center gap-1.5">
              <Globe2 className="h-3.5 w-3.5 text-sebrae-blue" />
              Distribuição Geográfica (Mapa)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-1 flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
            {Object.keys(stats.ufCounts).length === 0 ? (
              <p className="text-[10px] text-text-muted">Sem dados geográficos cadastrados.</p>
            ) : (
              Object.entries(stats.ufCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([state, count]) => (
                  <span
                    key={state}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800"
                  >
                    {state}: <span className="font-bold text-sebrae-blue">{count}</span>
                  </span>
                ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Main Table Panel */}
      <div className="space-y-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <Input
            type="text"
            placeholder="Buscar por nome, CNPJ, cidade ou UF..."
            className="pl-10 h-9 text-sm bg-surface-card border border-border-default focus-visible:ring-2 focus-visible:ring-primary"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <Card className="border border-border-default/80 shadow-sm bg-surface-card w-full">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="mt-4 text-sm">Carregando base de fornecedores...</p>
              </div>
            ) : filteredSuppliers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground p-6">
                <Building className="h-10 w-10 text-muted-foreground/50 mb-2" />
                <p className="text-sm font-semibold">Nenhum fornecedor localizado</p>
                <p className="text-xs">Clique no botão superior para cadastrar o primeiro fornecedor.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/10 hover:bg-muted/10">
                    <TableHead className="font-semibold text-xs text-text-muted">Razão Social</TableHead>
                    <TableHead className="font-semibold text-xs text-text-muted">CNPJ/CPF</TableHead>
                    <TableHead className="font-semibold text-xs text-text-muted">Contato / E-mail</TableHead>
                    <TableHead className="font-semibold text-xs text-text-muted">Localização</TableHead>
                    <TableHead className="font-semibold text-xs text-text-muted">Situação (TCU/CNJ/CEIS/CNEP)</TableHead>
                    <TableHead className="text-right w-44 font-semibold text-xs text-text-muted">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSuppliers.map((s) => (
                    <TableRow key={s.id} className="hover:bg-muted/5 transition-colors">
                      <TableCell className="py-2.5">
                        <p className="font-bold text-sm text-foreground">{s.name}</p>
                        {s.contactName && (
                          <p className="text-[10px] text-muted-foreground">Contato: {s.contactName}</p>
                        )}
                      </TableCell>
                      <TableCell className="py-2.5 font-mono text-xs text-muted-foreground">
                        {s.document || '—'}
                      </TableCell>
                      <TableCell className="py-2.5 text-xs text-foreground">
                        <div>{s.email}</div>
                        {s.phone && <div className="text-[10px] text-text-muted">{s.phone}</div>}
                      </TableCell>
                      <TableCell className="py-2.5 text-xs text-foreground">
                        {s.city || s.uf ? (
                          <div className="flex items-center gap-1 text-text-muted text-xs">
                            <MapPin className="h-3 w-3 text-sebrae-blue shrink-0" />
                            <span>
                              {s.city ? s.city : '—'}
                              {s.uf ? ` - ${s.uf.toUpperCase()}` : ''}
                            </span>
                          </div>
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </TableCell>
                      <TableCell className="py-2.5">
                        <button
                          type="button"
                          onClick={() => void handleViewCertificates(s)}
                          className="focus:outline-none focus:ring-2 focus:ring-primary/20 rounded-full transition-opacity hover:opacity-85"
                          title="Clique para ver os detalhes da validação"
                        >
                          {s.statusRegularidade === 'REGULAR' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Regularizado
                            </span>
                          ) : s.statusRegularidade === 'IRREGULAR' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              Irregularidades
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-50 text-slate-600 border border-slate-200">
                              <HelpCircle className="h-3.5 w-3.5" />
                              Não Validado
                            </span>
                          )}
                        </button>
                      </TableCell>
                      <TableCell className="py-2.5 text-right">
                        <div className="flex gap-1.5 justify-end items-center">
                          {/* Verify compliance button */}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 px-2.5 text-xs font-medium border-border-default hover:bg-muted text-foreground flex items-center gap-1"
                            onClick={() => void handleCheckCompliance(s)}
                            disabled={verifyingId === s.id || !s.document}
                            title="Consultar certidões em tempo real"
                          >
                            {verifyingId === s.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                            ) : (
                              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                            )}
                            Verificar
                          </Button>

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-primary hover:bg-muted rounded-full"
                            onClick={() => handleStartEdit(s)}
                            title="Editar Fornecedor"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-full"
                            onClick={() => void handleDelete(s.id)}
                            disabled={isDeletingId === s.id}
                            title="Excluir Fornecedor"
                          >
                            {isDeletingId === s.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal / Dialog Form */}
      <Dialog open={isModalOpen} onOpenChange={(open) => {
        setIsModalOpen(open);
        if (!open) handleCancelEdit();
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building className="w-5 h-5 text-primary" />
              {editingId ? 'Editar Fornecedor' : 'Novo Fornecedor'}
            </DialogTitle>
            <DialogDescription>
              {editingId ? 'Altere as informações do fornecedor.' : 'Adicione um novo fornecedor à base do sistema.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs font-semibold">Razão Social / Nome *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Distribuidora Sol Ltda"
                className="h-9 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="document" className="text-xs font-semibold">CNPJ / CPF (Para verificação de certidões)</Label>
              <Input
                id="document"
                value={document}
                onChange={(e) => setDocument(e.target.value)}
                placeholder="Ex: 00.000.000/0001-00"
                className="h-9 text-sm"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="city" className="text-xs font-semibold">Cidade</Label>
                <Input
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Ex: Natal"
                  className="h-9 text-sm"
                />
              </div>
              <div className="col-span-1 space-y-1.5">
                <Label htmlFor="uf" className="text-xs font-semibold">Estado (UF)</Label>
                <Input
                  id="uf"
                  value={uf}
                  onChange={(e) => setUf(e.target.value)}
                  placeholder="Ex: RN"
                  maxLength={2}
                  className="h-9 text-sm uppercase"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold">E-mail de Contato *</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Ex: vendas@distribuidora.com"
                className="h-9 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone" className="text-xs font-semibold">Telefone</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ex: (84) 99999-9999"
                className="h-9 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="contact" className="text-xs font-semibold">Pessoa de Contato</Label>
              <Input
                id="contact"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Ex: João Souza (Gerente)"
                className="h-9 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes" className="text-xs font-semibold">Observações</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Informações adicionais da empresa"
                rows={2}
                className="text-sm resize-none"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  handleCancelEdit();
                  setIsModalOpen(false);
                }}
                className="flex-1 text-xs gap-1.5"
              >
                <X className="w-3.5 h-3.5" />
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSaving}
                className="flex-1 text-xs gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
              >
                {isSaving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : editingId ? (
                  <Pencil className="w-3.5 h-3.5" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
                {editingId ? 'Salvar Alterações' : 'Cadastrar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Compliance / Certificates History Dialog */}
      <Dialog open={isCertModalOpen} onOpenChange={setIsCertModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sebrae-navy">
              <ShieldAlert className="w-5 h-5 text-sebrae-blue" />
              Regularidade & Histórico de Certidões
            </DialogTitle>
            <DialogDescription>
              Consulta unificada de idoneidade e emissão de CNDs para: <span className="font-bold text-foreground">{selectedSupplierForCerts?.name}</span> (CNPJ/CPF: {selectedSupplierForCerts?.document || '—'})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 max-h-[450px] overflow-y-auto pr-1">
            {isLoadingCerts ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="mt-3 text-sm">Carregando certidões da base...</p>
              </div>
            ) : certsList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground p-6">
                <ShieldCheck className="h-10 w-10 text-muted-foreground/30 mb-2" />
                <p className="text-sm font-semibold">Nenhuma certidão emitida ainda</p>
                <p className="text-xs max-w-sm mx-auto mt-1">
                  Clique no botão "Verificar" na tabela para disparar a primeira emissão de certidões federais em tempo real.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Painel Consolidado de Sanções (Portal da Transparência / CGU) */}
                <Card className="border border-border-default bg-surface-subtle/40 p-4">
                  <h4 className="font-bold text-sm text-foreground mb-3 flex items-center gap-1.5 border-b pb-2 border-border-default">
                    <ShieldAlert className="h-4.5 w-4.5 text-primary shrink-0" />
                    Situação Geral de Idoneidade (CGU / Portal da Transparência)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {[
                      {
                        id: 'CEIS',
                        label: 'Cadastro de Inidôneas/Suspensas (CEIS)',
                        cert: certsList.find(c => c.tipoCertidao === 'CEIS')
                      },
                      {
                        id: 'CNEP',
                        label: 'Empresas Punidas (CNEP)',
                        cert: certsList.find(c => c.tipoCertidao === 'CNEP')
                      },
                      {
                        id: 'CEPIM',
                        label: 'Entidades Impedidas (CEPIM)',
                        cert: certsList.find(c => c.tipoCertidao === 'CEPIM')
                      },
                      {
                        id: 'CEAF',
                        label: 'Servidores Expulsos (CEAF)',
                        cert: certsList.find(c => c.tipoCertidao === 'CEAF')
                      }
                    ].map(portal => {
                      const isSancionado = portal.cert?.situacao === 'IRREGULAR';
                      return (
                        <div key={portal.id} className="flex items-center justify-between p-2.5 rounded-radius-md border border-border-default bg-surface-card text-xs">
                          <div className="flex flex-col gap-0.5 pr-2">
                            <span className="font-semibold text-text-primary">{portal.label}</span>
                            {portal.cert?.numeroCertidao && (
                              <span className="text-[10px] text-text-muted font-mono">{portal.cert.numeroCertidao}</span>
                            )}
                          </div>
                          {isSancionado ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">
                              SANCIONADO
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              NADA CONSTA
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </div>
            )}
          </div>
          <div className="flex justify-end pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCertModalOpen(false)}
              className="text-xs"
            >
              Fechar Painel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
