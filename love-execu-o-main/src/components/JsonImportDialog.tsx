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
  acceptCsv?: boolean;
  csvSeparator?: string;
}

export function JsonImportDialog({
  open,
  onOpenChange,
  onImport,
  title,
  expectedFields,
  acceptCsv = false,
  csvSeparator = ';',
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

  const parseCsvText = (text: string): Record<string, string>[] => {
    const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length < 2) {
      throw new Error('O CSV deve ter pelo menos um cabeçalho e uma linha de dados.');
    }

    const headers = lines[0].split(csvSeparator).map(h => normalizeKey(h));
    const data: Record<string, string>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(csvSeparator);
      const row: Record<string, string> = {};
      headers.forEach((header, idx) => {
        row[header] = (values[idx] || '').trim();
      });
      data.push(row);
    }

    return data;
  };

  const processFileText = (text: string, isCsv: boolean) => {
    // Remove Byte Order Mark (BOM) if present, common in Windows files
    if (text.charCodeAt(0) === 0xFEFF) {
      text = text.slice(1);
    }

    let normalizedData: Record<string, string>[];

    if (isCsv) {
      // Parse CSV
      normalizedData = parseCsvText(text);
    } else {
      // Parse JSON
      // SANITIZATION: Replace invalid JSON values like NaN with "0"
      text = text.replace(/:\s*NaN\b/g, ': "0"');

      let json;
      try {
        json = JSON.parse(text);
      } catch (e) {
        throw new Error('Sintaxe JSON inválida. Verifique vírgulas, aspas e formato.');
      }

      const dataArray: Record<string, unknown>[] = Array.isArray(json) ? json : [json];

      if (dataArray.length === 0) {
        setError('O arquivo JSON está vazio.');
        return;
      }

      normalizedData = dataArray.map((item) => {
        const normalized: Record<string, string> = {};
        for (const [key, value] of Object.entries(item)) {
          normalized[normalizeKey(key)] = String(value ?? '');
        }
        return normalized;
      });
    }

    // Check for expected fields (using normalized versions)
    const normalizedExpected = expectedFields.map(normalizeKey);
    const sampleItem = normalizedData[0];

    const hasSomeValidField = normalizedExpected.some(
      (field) => field in sampleItem
    );

    if (!hasSomeValidField) {
      const foundKeys = Object.keys(sampleItem).join(', ');
      setError(`Campos não identificados. Encontrado: ${foundKeys}. Esperado: ${expectedFields.join(', ')}`)
      return;
    }

    setParsedData(normalizedData);
    setSuccess(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const isJson = selectedFile.name.endsWith('.json');
    const isCsv = selectedFile.name.endsWith('.csv');

    if (!isJson && !(acceptCsv && isCsv)) {
      setError(acceptCsv
        ? 'Por favor, selecione um arquivo JSON ou CSV.'
        : 'Por favor, selecione um arquivo JSON.');
      return;
    }

    setFile(selectedFile);
    setError(null);
    setSuccess(false);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;

        // Check if UTF-8 produced replacement characters (U+FFFD)
        // This means the file is likely encoded in Windows-1252/Latin-1
        if (text.includes('\uFFFD')) {
          // Re-read with Windows-1252 encoding
          const fallbackReader = new FileReader();
          fallbackReader.onload = (fallbackEvent) => {
            try {
              const fallbackText = fallbackEvent.target?.result as string;
              processFileText(fallbackText, isCsv);
            } catch (err) {
              const msg = err instanceof Error ? err.message : 'Erro desconhecido';
              setError(`Erro ao processar arquivo: ${msg}`);
            }
          };
          fallbackReader.readAsText(selectedFile, 'windows-1252');
          return;
        }

        processFileText(text, isCsv);
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

  const acceptAttr = acceptCsv ? '.json,.csv' : '.json';
  const fileTypeLabel = acceptCsv ? 'JSON ou CSV' : 'JSON';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileJson className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>
            Importe dados de um arquivo {fileTypeLabel}
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
              accept={acceptAttr}
              onChange={handleFileChange}
              className="hidden"
            />
            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            {file ? (
              <p className="text-sm font-medium">{file.name}</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Clique para selecionar um arquivo {fileTypeLabel}
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
