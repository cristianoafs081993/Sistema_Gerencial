import { useState, useEffect } from 'react';
import { Atividade, DIMENSOES, TipoAtividade } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Pencil, Plus, Activity } from 'lucide-react';
import { toast } from 'sonner';
import { atividadesService } from '@/services/atividades';

interface AtividadeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  atividade: Atividade | null;
  defaultTipoAtividade: TipoAtividade;
  onSuccess: () => void;
}

export function AtividadeDialog({
  open,
  onOpenChange,
  atividade,
  defaultTipoAtividade,
  onSuccess,
}: AtividadeDialogProps) {
  const [formData, setFormData] = useState<Partial<Atividade>>({});
  const [loading, setLoading] = useState(false);
  const basePayload = (): Omit<Atividade, 'id' | 'createdAt' | 'updatedAt'> => ({
    dimensao: formData.dimensao || '',
    dimensaoId: formData.dimensaoId,
    componenteFuncional: formData.componenteFuncional || '',
    componenteFuncionalId: formData.componenteFuncionalId,
    processo: formData.processo || '',
    tipoAtividade: formData.tipoAtividade || defaultTipoAtividade,
    atividade: formData.atividade || '',
    descricao: formData.descricao || '',
    valorTotal: formData.valorTotal || 0,
    origemRecurso: formData.origemRecurso || '',
    origemRecursoId: formData.origemRecursoId,
    naturezaDespesa: formData.naturezaDespesa || '',
    naturezaDespesaId: formData.naturezaDespesaId,
    planoInterno: formData.planoInterno || '',
  });

  useEffect(() => {
    if (open) {
      setFormData(atividade || {
        dimensao: '',
        componenteFuncional: '',
        tipoAtividade: defaultTipoAtividade,
        atividade: '',
        descricao: '',
        valorTotal: 0,
        origemRecurso: '',
        naturezaDespesa: '',
        planoInterno: ''
      });
    }
  }, [open, atividade, defaultTipoAtividade]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const toastId = toast.loading(atividade ? 'Atualizando...' : 'Criando...');

    try {
      if (atividade) {
        await atividadesService.update(atividade.id, formData);
        toast.success('Atividade atualizada!', { id: toastId });
      } else {
        await atividadesService.create(basePayload());
        toast.success('Atividade criada!', { id: toastId });
      }
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar', { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden border-none shadow-2xl bg-white">
        <DialogHeader className="p-6 bg-slate-50/80 border-b border-slate-100 relative">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
              {atividade ? <Pencil className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-600/70">Gestão de Atividades</span>
              <DialogTitle className="text-xl font-black tracking-tight text-slate-900">
                {atividade ? 'Editar Atividade' : 'Nova Atividade'}
              </DialogTitle>
            </div>
          </div>
          <div className="absolute top-0 left-0 w-full h-1 bg-blue-500" />
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto bg-white">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Dimensão</Label>
                <Select 
                  value={formData.dimensao} 
                  onValueChange={(val) => setFormData({ ...formData, dimensao: val })}
                >
                  <SelectTrigger className="h-10 border-slate-200 bg-slate-50/50 focus:ring-blue-500/20 focus:border-blue-500 transition-all">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {DIMENSOES.map(d => (
                      <SelectItem key={d.codigo} value={d.codigo}>{d.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Componente Funcional</Label>
                <Input 
                  value={formData.componenteFuncional || ''} 
                  onChange={e => setFormData({ ...formData, componenteFuncional: e.target.value })}
                  placeholder="Ex: Contratos"
                  className="h-10 border-slate-200 bg-slate-50/50 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Atividade</Label>
              <Input 
                value={formData.atividade || ''} 
                onChange={e => setFormData({ ...formData, atividade: e.target.value })}
                placeholder="Título da atividade"
                className="h-10 border-slate-200 bg-slate-50/50 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Descrição</Label>
              <Textarea 
                value={formData.descricao || ''} 
                onChange={e => setFormData({ ...formData, descricao: e.target.value })}
                placeholder="Detalhes adicionais da atividade..."
                className="min-h-[100px] border-slate-200 bg-slate-50/50 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Plano Interno (PI)</Label>
                <Input 
                  value={formData.planoInterno || ''} 
                  onChange={e => setFormData({ ...formData, planoInterno: e.target.value })}
                  placeholder="Ex: L20RLP01ADN"
                  className="h-10 border-slate-200 bg-slate-50/50 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Valor Total</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">R$</span>
                  <Input 
                    type="number"
                    step="0.01"
                    value={formData.valorTotal || 0} 
                    onChange={e => setFormData({ ...formData, valorTotal: parseFloat(e.target.value) })}
                    className="h-10 pl-9 border-slate-200 bg-slate-50/50 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-bold"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Origem de Recurso (PTRES)</Label>
                <Input 
                  value={formData.origemRecurso || ''} 
                  onChange={e => setFormData({ ...formData, origemRecurso: e.target.value })}
                  placeholder="Ex: 231796"
                  className="h-10 border-slate-200 bg-slate-50/50 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Natureza de Despesa</Label>
                <Input 
                  value={formData.naturezaDespesa || ''} 
                  onChange={e => setFormData({ ...formData, naturezaDespesa: e.target.value })}
                  placeholder="Ex: 339030"
                  className="h-10 border-slate-200 bg-slate-50/50 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono text-sm"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="p-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-end gap-3">
            <Button 
              type="button" 
              variant="secondary" 
              onClick={() => onOpenChange(false)} 
              disabled={loading}
              className="bg-white border-slate-200 text-slate-600 hover:bg-slate-100 font-bold uppercase text-[10px] tracking-widest px-6 shadow-sm"
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={loading} 
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold uppercase text-[10px] tracking-widest px-8 shadow-md shadow-blue-500/20 transition-all active:scale-95"
            >
              {loading ? 'Salvando...' : 'Salvar Atividade'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
