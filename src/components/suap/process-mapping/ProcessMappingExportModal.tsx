import React, { useState } from 'react';
import {
  Check,
  Copy,
  Download,
  FileJson,
  Printer,
  Upload,
  X,
} from 'lucide-react';
import type { ProcessMappingRecord } from '@/types/processMapping';

interface ProcessMappingExportModalProps {
  isOpen: boolean;
  activeProcess: ProcessMappingRecord;
  onClose: () => void;
  onImportProcess: (imported: ProcessMappingRecord) => void;
}

export const ProcessMappingExportModal: React.FC<ProcessMappingExportModalProps> = ({
  isOpen,
  activeProcess,
  onClose,
  onImportProcess,
}) => {
  const [copied, setCopied] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [importError, setImportError] = useState('');

  if (!isOpen) return null;

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(activeProcess, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(activeProcess, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute(
      'download',
      `${activeProcess.code || 'processo'}_${activeProcess.title.toLowerCase().replace(/\s+/g, '_')}.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handlePrint = () => {
    window.print();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        if (parsed.id && parsed.title && Array.isArray(parsed.nodes)) {
          onImportProcess(parsed);
          onClose();
        } else {
          setImportError('Formato JSON inválido: certifique-se de que contém id, title e nodes.');
        }
      } catch {
        setImportError('Erro ao decodificar JSON do arquivo.');
      }
    };
    reader.readAsText(file);
  };

  const handlePasteImport = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const parsed = JSON.parse(importJsonText);
      if (parsed.id && parsed.title && Array.isArray(parsed.nodes)) {
        onImportProcess(parsed);
        onClose();
      } else {
        setImportError('Formato JSON inválido: certifique-se de que contém id, title e nodes.');
      }
    } catch {
      setImportError('Erro ao validar JSON digitado.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center p-4 font-ui">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 max-w-xl w-full">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Exportar & Importar Processo</h3>
              <p className="text-xs text-slate-500">{activeProcess.title}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-5 pt-4 text-xs">
          {/* Quick Export Actions */}
          <div className="grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={handleDownload}
              className="flex flex-col items-center justify-center p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-emerald-50 hover:border-emerald-300 transition-all text-slate-700 hover:text-emerald-900 group"
            >
              <FileJson className="w-5 h-5 mb-1.5 text-slate-500 group-hover:text-emerald-600" />
              <span className="font-bold">Baixar JSON</span>
              <span className="text-[10px] text-slate-400">Arquivo completo</span>
            </button>

            <button
              type="button"
              onClick={handleCopyJson}
              className="flex flex-col items-center justify-center p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-blue-50 hover:border-blue-300 transition-all text-slate-700 hover:text-blue-900 group"
            >
              {copied ? (
                <Check className="w-5 h-5 mb-1.5 text-emerald-600" />
              ) : (
                <Copy className="w-5 h-5 mb-1.5 text-slate-500 group-hover:text-blue-600" />
              )}
              <span className="font-bold">{copied ? 'Copiado!' : 'Copiar JSON'}</span>
              <span className="text-[10px] text-slate-400">Área de transferência</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="flex flex-col items-center justify-center p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-purple-50 hover:border-purple-300 transition-all text-slate-700 hover:text-purple-900 group"
            >
              <Printer className="w-5 h-5 mb-1.5 text-slate-500 group-hover:text-purple-600" />
              <span className="font-bold">Imprimir / PDF</span>
              <span className="text-[10px] text-slate-400">Layout do navegador</span>
            </button>
          </div>

          {/* Import JSON Section */}
          <div className="border-t border-slate-200 pt-4 space-y-3">
            <div className="flex items-center gap-2">
              <Upload className="w-4 h-4 text-emerald-600" />
              <h4 className="font-bold text-slate-800">Importar Mapeamento Externo</h4>
            </div>

            {importError && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                {importError}
              </div>
            )}

            <div>
              <label className="block text-slate-500 mb-1 font-semibold">
                Carregar de arquivo local (.json):
              </label>
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="w-full text-slate-600 text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
              />
            </div>

            <form onSubmit={handlePasteImport} className="space-y-2 pt-2">
              <label className="block text-slate-500 font-semibold">
                Ou cole o conteúdo JSON aqui:
              </label>
              <textarea
                rows={3}
                placeholder="Cole o código JSON do processo..."
                value={importJsonText}
                onChange={(e) => {
                  setImportJsonText(e.target.value);
                  setImportError('');
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono text-[11px] focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <button
                type="submit"
                disabled={!importJsonText.trim()}
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold rounded-lg transition-colors"
              >
                Carregar Processo Colado
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
