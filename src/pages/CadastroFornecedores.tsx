import { useEffect, useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
} from 'lucide-react';
import { toast } from 'sonner';

import { priceResearchEmailService, type Supplier } from '@/services/priceResearchEmail';

export default function CadastroFornecedoresPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

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
        },
        editingId
      );

      toast.success(
        editingId
          ? 'Fornecedor atualizado com sucesso!'
          : 'Fornecedor cadastrado com sucesso!'
      );

      // Close modal & reset form
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

  // Filtered list
  const filteredSuppliers = useMemo(() => {
    if (!searchTerm.trim()) return suppliers;
    const term = searchTerm.toLowerCase();
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        (s.document && s.document.toLowerCase().includes(term)) ||
        s.email.toLowerCase().includes(term)
    );
  }, [suppliers, searchTerm]);

  return (
    <div className="space-y-6 pb-10">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-surface-card border border-border-subtle/70 rounded-radius-xl shadow-soft">
        <div className="space-y-1">
          <h3 className="text-xl font-bold text-sebrae-navy">Cadastro de Fornecedores</h3>
          <p className="text-sm text-text-muted">
            Base global de fornecedores para envio e disparo automático de cotações por e-mail.
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

      {/* Main Table Panel */}
      <div className="space-y-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <Input
            type="text"
            placeholder="Buscar por nome, CNPJ ou e-mail..."
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
                    <TableHead className="font-semibold text-xs text-text-muted">E-mail</TableHead>
                    <TableHead className="font-semibold text-xs text-text-muted">Telefone</TableHead>
                    <TableHead className="text-right w-20 font-semibold text-xs text-text-muted">Ações</TableHead>
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
                        {s.email}
                      </TableCell>
                      <TableCell className="py-2.5 text-xs text-foreground whitespace-nowrap">
                        {s.phone || '—'}
                      </TableCell>
                      <TableCell className="py-2.5 text-right">
                        <div className="flex gap-1 justify-end items-center">
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
              <Label htmlFor="document" className="text-xs font-semibold">CNPJ / CPF</Label>
              <Input
                id="document"
                value={document}
                onChange={(e) => setDocument(e.target.value)}
                placeholder="Ex: 00.000.000/0001-00"
                className="h-9 text-sm"
              />
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
                rows={3}
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
    </div>
  );
}
