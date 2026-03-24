import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { importPFs } from '@/services/pfImportService';
import { Upload, FileSpreadsheet, History, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface PFImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function PFImportDialog({ open, onOpenChange, onSuccess }: PFImportDialogProps) {
  const [fileSolicitacoes, setFileSolicitacoes] = useState<File | null>(null);
  const [fileAprovacoes, setFileAprovacoes] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const handleImport = async () => {
    if (!fileSolicitacoes || !fileAprovacoes) {
      toast.error('Selecione ambos os arquivos para importação.');
      return;
    }

    try {
      setIsImporting(true);
      await importPFs(fileSolicitacoes, fileAprovacoes);
      toast.success('Importação concluída com sucesso!');
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao importar arquivos: ' + (error as Error).message);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none shadow-2xl bg-white text-slate-900">
        <DialogHeader className="p-6 bg-slate-50/80 border-b border-slate-100 space-y-1 relative">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-600/70">Processamento de Planilhas</span>
              <DialogTitle className="text-xl font-black tracking-tight text-slate-900">
                Importar PFs
              </DialogTitle>
            </div>
          </div>
          <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500" />
          <DialogDescription className="text-xs text-slate-500 font-medium pt-1">
            Selecione as planilhas de Solicitações e Aprovações para atualizar o sistema.
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-6">
          <div className="rounded-xl bg-blue-50 p-4 border border-blue-100 text-[11px] flex gap-3">
            <div className="p-2 bg-blue-100 rounded-lg h-fit text-blue-600">
              <Info className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <p className="font-bold text-blue-900 uppercase tracking-wider">Atenção ao formato</p>
              <p className="text-blue-700 leading-relaxed">
                Certifique-se de que os arquivos estão no formato <span className="font-bold">.xlsx ou .xls</span>. O sistema irá correlacionar as solicitações do Campus com as aprovações da Reitoria através do número do PPF.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Planilha Solicitações (Campus)
              </Label>
              <div className="relative group">
                <Input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => setFileSolicitacoes(e.target.files?.[0] || null)}
                  className="hidden"
                  id="campus-file"
                />
                <label 
                  htmlFor="campus-file"
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 border-dashed transition-all cursor-pointer ${
                    fileSolicitacoes 
                      ? 'border-emerald-200 bg-emerald-50/50' 
                      : 'border-slate-200 hover:border-blue-400 hover:bg-slate-50'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${fileSolicitacoes ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400 group-hover:text-blue-500 group-hover:bg-blue-100'}`}>
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold truncate ${fileSolicitacoes ? 'text-emerald-900' : 'text-slate-500 group-hover:text-blue-900'}`}>
                      {fileSolicitacoes ? fileSolicitacoes.name : 'Selecionar arquivo do Campus'}
                    </p>
                    <p className="text-[10px] text-slate-400 font-medium">Arquivos .xlsx, .xls</p>
                  </div>
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Planilha Aprovações (Reitoria)
              </Label>
              <div className="relative group">
                <Input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => setFileAprovacoes(e.target.files?.[0] || null)}
                  className="hidden"
                  id="reitoria-file"
                />
                <label 
                  htmlFor="reitoria-file"
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 border-dashed transition-all cursor-pointer ${
                    fileAprovacoes 
                      ? 'border-emerald-200 bg-emerald-50/50' 
                      : 'border-slate-200 hover:border-blue-400 hover:bg-slate-50'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${fileAprovacoes ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400 group-hover:text-blue-500 group-hover:bg-blue-100'}`}>
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold truncate ${fileAprovacoes ? 'text-emerald-900' : 'text-slate-500 group-hover:text-blue-900'}`}>
                      {fileAprovacoes ? fileAprovacoes.name : 'Selecionar arquivo da Reitoria'}
                    </p>
                    <p className="text-[10px] text-slate-400 font-medium">Arquivos .xlsx, .xls</p>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="p-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-end gap-3">
          <Button 
            variant="secondary" 
            onClick={() => onOpenChange(false)}
            className="bg-white border-slate-200 text-slate-600 hover:bg-slate-100 font-bold uppercase text-[10px] tracking-widest px-6 shadow-sm shadow-slate-200/50"
            disabled={isImporting}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleImport}
            disabled={!fileSolicitacoes || !fileAprovacoes || isImporting}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold uppercase text-[10px] tracking-widest px-8 shadow-md shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-50 disabled:shadow-none"
          >
            {isImporting ? (
              <span className="flex items-center gap-2">
                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Processando...
              </span>
            ) : 'Iniciar Importação'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
