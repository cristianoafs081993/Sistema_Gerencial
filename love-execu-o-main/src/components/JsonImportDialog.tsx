import { useState, useRef } from 'react';
import { Upload, FileJson, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface JsonImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (data: Record<string, string>[]) => void;
  title: string;
  expectedFields: string[];
}

export function JsonImportDialog({
  open,
  onOpenChange,
  onImport,
  title,
  expectedFields,
}: JsonImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<Record<string, string>[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setFile(null);
    setParsedData([]);
    setError(null);
    setSuccess(false);
  };

  const normalizeKey = (key: string): string => {
    return key
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, '');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.json')) {
      setError('Por favor, selecione um arquivo JSON.');
      return;
    }

    setFile(selectedFile);
    setError(null);
    setSuccess(false);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        let text = event.target?.result as string;

        // Remove Byte Order Mark (BOM) if present, common in Windows files
        if (text.charCodeAt(0) === 0xFEFF) {
          text = text.slice(1);
        }

        // SANITIZATION: Replace invalid JSON values like NaN with "0"
        // This handles cases where values are unquoted NaN which is invalid in JSON but common in some exports
        text = text.replace(/:\s*NaN\b/g, ': "0"');

        let json;
        try {
          json = JSON.parse(text);
        } catch (e) {
          throw new Error('Sintaxe JSON inválida. Verifique vírgulas, aspas e formato.');
        }

        // Handle both array and single object
        const dataArray: Record<string, unknown>[] = Array.isArray(json) ? json : [json];

        if (dataArray.length === 0) {
          setError('O arquivo JSON está vazio.');
          return;
        }

        // Normalize keys for each object
        const normalizedData: Record<string, string>[] = dataArray.map((item) => {
          const normalized: Record<string, string> = {};
          for (const [key, value] of Object.entries(item)) {
            normalized[normalizeKey(key)] = String(value ?? '');
          }
          return normalized;
        });

        // Check for expected fields (using normalized versions)
        const normalizedExpected = expectedFields.map(normalizeKey);
        // Check first item to validate structure
        const sampleItem = normalizedData[0];

        // Relaxed validation: Check if AT LEAST ONE of the expected fields exists
        // This prevents blocking imports just because one optional field is missing
        const hasSomeValidField = normalizedExpected.some(
          (field) => field in sampleItem
        );

        if (!hasSomeValidField) {
          // If strict matching fails, try to show what IS there to help user
          const foundKeys = Object.keys(sampleItem).join(', ');
          setError(`Campos não identificados. Encontrado: ${foundKeys}. Esperado: ${expectedFields.join(', ')}`);
          return;
        }

        setParsedData(normalizedData);
        setSuccess(true);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro desconhecido';
        setError(`Erro ao processar arquivo: ${msg}`);
      }
    };
    reader.readAsText(selectedFile, 'UTF-8');
  };

  const handleImport = () => {
    if (parsedData.length > 0) {
      onImport(parsedData);
      onOpenChange(false);
      resetState();
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    resetState();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileJson className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>
            Importe dados de um arquivo JSON
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Expected fields info */}
          <div className="rounded-lg bg-muted p-3 text-sm">
            <p className="font-medium mb-1">Campos esperados:</p>
            <p className="text-muted-foreground text-xs">
              {expectedFields.join(', ')}
            </p>
          </div>

          {/* File input */}
          <div
            className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileChange}
              className="hidden"
            />
            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            {file ? (
              <p className="text-sm font-medium">{file.name}</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Clique para selecionar um arquivo JSON
              </p>
            )}
          </div>

          {/* Error message */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Success message */}
          {success && parsedData.length > 0 && (
            <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700 dark:text-green-300">
                {parsedData.length} registro(s) encontrado(s) e pronto(s) para importação.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button onClick={handleImport} disabled={!success || parsedData.length === 0}>
            Importar {parsedData.length > 0 && `(${parsedData.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
