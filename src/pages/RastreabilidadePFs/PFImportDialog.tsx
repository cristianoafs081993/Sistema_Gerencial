import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { importPFs } from '@/services/pfImportService';

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
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Importar PFs</DialogTitle>
          <DialogDescription>
            Selecione as planilhas de Solicitações (Campus) e Aprovações/Liberações (Reitoria).
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="planilha-solicitacoes">Planilha Solicitações (Campus)</Label>
            <Input
              id="planilha-solicitacoes"
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => setFileSolicitacoes(e.target.files?.[0] || null)}
            />
          </div>
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="planilha-aprovacoes">Planilha Aprovações (Reitoria)</Label>
            <Input
              id="planilha-aprovacoes"
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => setFileAprovacoes(e.target.files?.[0] || null)}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isImporting}>
            Cancelar
          </Button>
          <Button onClick={handleImport} disabled={!fileSolicitacoes || !fileAprovacoes || isImporting}>
            {isImporting ? 'Importando...' : 'Importar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
