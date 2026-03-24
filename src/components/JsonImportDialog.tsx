import { useState, useRef } from 'react';
import { Upload, FileJson, AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
      .replace(/"/g, '')
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, '');
  };

  const parseCsvText = (text: string): Record<string, string>[] => {
    const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length < 2) {
      throw new Error('O CSV deve ter pelo menos um cabeçalho e uma linha de dados.');
    }

    const normalizedExpected = expectedFields.map(normalizeKey);
    let headerIndex = -1;
    let headers: string[] = [];
    let detectedSeparator = '';

    // Heurística: Tentar encontrar a linha que melhor combina com os campos esperados
    // Testando diferentes separadores e as primeiras 15 linhas
    const potentialSeparators = [';', '\t', ',', '|'];
    
    let bestMatch = { count: 0, index: -1, sep: '', headers: [] as string[] };

    for (let i = 0; i < Math.min(lines.length, 15); i++) {
        for (const sep of potentialSeparators) {
            const parts = lines[i].split(sep);
            if (parts.length < 2) continue;

            const normalized = parts.map(h => normalizeKey(h));
            const matchCount = normalizedExpected.filter(f => normalized.includes(f)).length;

            if (matchCount > bestMatch.count) {
                bestMatch = { count: matchCount, index: i, sep, headers: normalized };
            }
        }
    }

    if (bestMatch.count > 0) {
        headerIndex = bestMatch.index;
        detectedSeparator = bestMatch.sep;
        // Precisamos dos nomes originais das colunas (sem normalização agressiva) para o mapeamento
        headers = lines[headerIndex].split(detectedSeparator).map(h => h.replace(/"/g, '').trim());
    } else {
        // Fallback: Tenta descobrir se está usando o separador padrão na primeira linha
        detectedSeparator = csvSeparator || ';';
        headerIndex = 0;
        headers = lines[0].split(detectedSeparator).map(h => h.replace(/"/g, '').trim());
    }

    const data: Record<string, string>[] = [];
    const normalizedHeaders = headers.map(normalizeKey);

    for (let i = headerIndex + 1; i < lines.length; i++) {
      const values = lines[i].split(detectedSeparator);
      const row: Record<string, string> = {};
      normalizedHeaders.forEach((header, idx) => {
        row[header] = (values[idx] || '').replace(/"/g, '').trim();
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
    const foundKeys = Object.keys(sampleItem);

    const hasSomeValidField = normalizedExpected.some(
      (field) => foundKeys.includes(field)
    );

    if (!hasSomeValidField) {
      // Diagnóstico inteligente: verificar se parece com o outro arquivo conhecido
      const docsHabeisSample = ['documentohabil', 'dhcredor', 'dhsituacao'];
      const looksLikeDocsHabeis = docsHabeisSample.some(f => foundKeys.includes(f));
      
      const foundKeysStr = foundKeys.join(', ');
      let errorMsg = `Campos não identificados. Encontrado: ${foundKeysStr}. Esperado: ${expectedFields.join(', ')}`;
      
      if (looksLikeDocsHabeis && !normalizedExpected.includes('documentohabil')) {
          errorMsg = "Parece que você está tentando carregar um arquivo de 'Documentos Hábeis' neste campo de 'Liquidações'. Por favor, use a opção correta no menu Importar.";
      }

      setError(errorMsg);
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
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none shadow-2xl bg-white text-slate-900">
        <DialogHeader className="p-6 bg-slate-50/80 border-b border-slate-100 space-y-1 relative">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-600/70">Importação de Dados</span>
              <DialogTitle className="text-xl font-black tracking-tight text-slate-900">
                {title}
              </DialogTitle>
            </div>
          </div>
          <div className="absolute top-0 left-0 w-full h-1 bg-blue-500" />
          <DialogDescription className="text-xs text-slate-500 font-medium pt-1">
            Selecione um arquivo {fileTypeLabel} para importar novos registros.
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-6">
          {/* Expected fields info */}
          <div className="rounded-xl bg-slate-50 p-4 border border-slate-100 text-[11px]">
            <p className="font-black uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-2">
              <Info className="w-3 h-3" />
              Campos esperados no arquivo:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {expectedFields.map(field => (
                <Badge key={field} variant="outline" className="bg-white border-slate-200 text-slate-600 text-[9px] font-bold py-0.5 px-2">
                  {field}
                </Badge>
              ))}
            </div>
          </div>

          {/* File input */}
          {!file ? (
            <div
              className="group border-2 border-dashed border-slate-200 rounded-2xl p-10 flex flex-col items-center justify-center gap-4 hover:border-blue-400 hover:bg-blue-50/50 transition-all cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={acceptAttr}
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="p-4 bg-slate-50 rounded-full group-hover:scale-110 transition-transform">
                <Upload className="h-8 w-8 text-slate-400 group-hover:text-blue-500" />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-slate-700">Clique para selecionar</p>
                <p className="text-xs text-slate-400 font-medium mt-1">ou arraste e solte o arquivo aqui</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div className="p-2 bg-white rounded-lg shadow-sm">
                  <FileJson className="w-6 h-6 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">{file.name}</p>
                  <p className="text-[10px] text-slate-500 font-medium">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={resetState}
                  className="text-red-500 hover:text-red-600 hover:bg-red-50 text-[10px] font-bold"
                >
                  REMOVER
                </Button>
              </div>

              {/* Error message */}
              {error && (
                <Alert variant="destructive" className="bg-red-50 border-red-100 text-red-700 rounded-xl py-3 animate-in slide-in-from-top-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs font-bold ml-2">{error}</AlertDescription>
                </Alert>
              )}

              {/* Success message */}
              {success && parsedData.length > 0 && (
                <div className="flex items-center gap-3 p-4 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100 animate-in slide-in-from-top-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider">Arquivo Validado</p>
                    <p className="text-xs font-medium">{parsedData.length} registro(s) encontrado(s) para importação.</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="p-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-end gap-3">
          <Button 
            variant="secondary" 
            onClick={handleClose}
            className="bg-white border-slate-200 text-slate-600 hover:bg-slate-100 font-bold uppercase text-[10px] tracking-widest px-6 shadow-sm shadow-slate-200/50"
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleImport} 
            disabled={!success || parsedData.length === 0}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold uppercase text-[10px] tracking-widest px-8 shadow-md shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-50 disabled:shadow-none"
          >
            Importar {parsedData.length > 0 && `(${parsedData.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
