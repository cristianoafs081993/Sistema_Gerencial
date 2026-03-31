import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { RefreshCw, FileSpreadsheet, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { contratosService } from '@/services/contratos';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SyncLog {
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseDate(raw: unknown): string | null {
  if (raw == null || raw === '') return null;
  const str = String(raw).trim();

  // Excel serial number
  if (/^\d{4,6}$/.test(str)) {
    const d = XLSX.SSF.parse_date_code(Number(str));
    if (d) {
      const y = d.y;
      const m = String(d.m).padStart(2, '0');
      const dy = String(d.d).padStart(2, '0');
      return `${y}-${m}-${dy}`;
    }
  }

  // dd/mm/yyyy
  const dmyMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // Extract LAST date from text (e.g. "Prorrogado xxx para 31/12/2026")
  const allDates = str.match(/\d{2}\/\d{2}\/\d{4}/g);
  if (allDates) {
    const last = allDates[allDates.length - 1].split('/');
    return `${last[2]}-${last[1]}-${last[0]}`;
  }

  // yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);

  return null;
}

function normalizeNumero(raw: unknown): string {
  return String(raw ?? '').trim();
}

// ─── Main component ───────────────────────────────────────────────────────────

interface ContratosSyncDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSyncComplete: () => void;
}

export function ContratosSyncDialog({
  open,
  onOpenChange,
  onSyncComplete,
}: ContratosSyncDialogProps) {
  const relatorio4Ref = useRef<HTMLInputElement>(null);
  const relatorio3Ref = useRef<HTMLInputElement>(null);

  const [file4, setFile4] = useState<File | null>(null);
  const [file3, setFile3] = useState<File | null>(null);
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [done, setDone] = useState(false);

  const addLog = (type: SyncLog['type'], message: string) => {
    setLogs((prev) => [...prev, { type, message }]);
  };

  const readXlsx = (file: File): Promise<Record<string, unknown>[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target!.result as ArrayBuffer, { type: 'array' });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
            defval: '',
          });
          resolve(rows);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  const handleSync = async () => {
    if (!file4 || !file3) return;

    setRunning(true);
    setLogs([]);
    setDone(false);

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // ── 1. Relatorio (4): contratos ativos ───────────────────────────────
      addLog('info', `Lendo ${file4.name}...`);
      const rows4 = await readXlsx(file4);

      const activeContracts: Record<string, string | null>[] = [];
      let skippedExpired = 0;

      for (const row of rows4) {
        const numero = normalizeNumero(
          row['Número'] ?? row['Numero'] ?? row['número'] ?? row['numero'] ?? ''
        );
        if (!numero || numero === 'nan') continue;

        const dtInicio = parseDate(row['Data de Início'] ?? row['Data de Inicio'] ?? row['data_inicio'] ?? '');
        const dtTermino = parseDate(row['Data de Término'] ?? row['Data de Termino'] ?? row['data_termino'] ?? '');

        if (dtTermino) {
          const termDate = new Date(dtTermino + 'T00:00:00');
          if (termDate < today) {
            skippedExpired++;
            addLog('warning', `Ignorado (expirado): ${numero} (término: ${dtTermino})`);
            continue;
          }
        }

        activeContracts.push({
          numero,
          contratada: String(row['Contratada'] ?? row['contratada'] ?? '').trim(),
          data_inicio: dtInicio,
          data_termino: dtTermino,
        });
      }

      addLog('info', `${activeContracts.length} contratos ativos | ${skippedExpired} expirados ignorados`);

      // ── 2. Buscar contratos atuais no DB para detectar remoções ──────────
      addLog('info', 'Consultando banco de dados...');
      const dbContratos = await contratosService.getContratos();
      const dbNumeros = dbContratos.map((c) => c.numero);
      const activeNumeros = activeContracts.map((c) => c.numero);
      const toDelete = dbNumeros.filter((n) => !activeNumeros.includes(n));

      if (toDelete.length > 0) {
        addLog('warning', `Removendo ${toDelete.length} contrato(s) não mais ativos: ${toDelete.join(', ')}`);
        await contratosService.deleteByNumeros(toDelete);
      }

      // ── 3. Upsert contratos ativos ────────────────────────────────────────
      addLog('info', `Salvando ${activeContracts.length} contratos ativos...`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await contratosService.upsertBatch(activeContracts as any);

      // ── 4. Relatorio (3): vínculos empenho‑contrato + valores ────────────
      addLog('info', `Lendo ${file3.name}...`);
      const rows3 = await readXlsx(file3);

      // Buscar mapa de contratos e empenhos do DB
      const dbContratosUpdated = await contratosService.getContratos();
      const contractMap = new Map(dbContratosUpdated.map((c) => [c.numero, c.id]));

      const empenhos = await contratosService.getEmpenhos();
      const empenhoByNumero = new Map(empenhos.map((e) => [e.numero.trim().toUpperCase(), e.id]));

      addLog('info', `${empenhos.length} empenhos no banco | ${dbContratosUpdated.length} contratos`);

      const linksToUpsert: { contrato_id: string; empenho_id: string }[] = [];
      const contractValues: Map<string, number> = new Map();
      let unmatchedLinks = 0;

      for (const row of rows3) {
        const cNum = normalizeNumero(
          row['Contrato'] ?? row['contrato'] ?? row['Número do Contrato'] ?? ''
        );
        // "Número do empenho" - column may have encoding issues rendered as "NÃºmero" etc.
        const eNumFull = normalizeNumero(
          row['Número do empenho'] ??
          row['Numero do empenho'] ??
          row['NÃºmero do empenho'] ??
          row['N\xfamero do empenho'] ??
          // Fallback: find any key that looks like "empenho"
          Object.entries(row).find(([k]) => /empenho/i.test(k))?.[1] ??
          ''
        );

        const valorRaw = row['Valor (R$)'] ?? row['Valor'] ?? row['valor'] ?? 0;
        const valor = typeof valorRaw === 'number' ? valorRaw : parseFloat(String(valorRaw).replace(',', '.')) || 0;

        // Track highest value per contract
        if (cNum && (!contractValues.has(cNum) || valor > contractValues.get(cNum)!)) {
          contractValues.set(cNum, valor);
        }

        const contratoId = contractMap.get(cNum);
        if (!contratoId) continue; // contract not active, skip

        // Try last 12 chars of empenho number (as Python script does)
        const eNumSuffix = eNumFull.length >= 12 ? eNumFull.slice(-12).toUpperCase() : eNumFull.toUpperCase();
        const empenhoId = empenhoByNumero.get(eNumSuffix) ?? empenhoByNumero.get(eNumFull.toUpperCase());

        if (!empenhoId) {
          unmatchedLinks++;
          continue;
        }

        linksToUpsert.push({ contrato_id: contratoId, empenho_id: empenhoId });
      }

      // ── 5. Atualizar valores dos contratos ────────────────────────────────
      addLog('info', 'Atualizando valores dos contratos...');
      const valueUpdates = Array.from(contractValues.entries())
        .filter(([num]) => contractMap.has(num))
        .map(([num, valor]) => ({ numero: num, valor }));

      if (valueUpdates.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await contratosService.upsertBatch(valueUpdates as any);
      }

      // ── 6. Upsert links ───────────────────────────────────────────────────
      addLog('info', `Salvando ${linksToUpsert.length} vínculos...`);
      if (linksToUpsert.length > 0) {
        await contratosService.upsertLinks(linksToUpsert);
      }

      if (unmatchedLinks > 0) {
        addLog('warning', `${unmatchedLinks} linha(s) do Relatório (3) sem empenho correspondente no banco.`);
      }

      addLog('success', `Sincronização concluída! ${activeContracts.length} contratos | ${linksToUpsert.length} vínculos salvos.`);
      setDone(true);
      onSyncComplete();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      addLog('error', `Erro: ${message}`);
      console.error(err);
    } finally {
      setRunning(false);
    }
  };

  const handleClose = () => {
    if (!running) {
      setFile4(null);
      setFile3(null);
      setLogs([]);
      setDone(false);
      onOpenChange(false);
    }
  };

  const logColor: Record<SyncLog['type'], string> = {
    info: 'text-slate-600',
    success: 'text-emerald-700 font-semibold',
    warning: 'text-amber-600',
    error: 'text-red-600 font-semibold',
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-action-primary" />
            Sincronizar Contratos e Vínculos
          </DialogTitle>
          <DialogDescription>
            Selecione os dois relatórios XLSX para atualizar contratos ativos e vínculos com empenhos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* File picker: Relatorio 4 */}
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Relatório (4) — Contratos Ativos
            </label>
            <div
              className="flex items-center gap-3 border border-dashed border-border-default rounded-lg p-3 cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => relatorio4Ref.current?.click()}
            >
              <FileSpreadsheet className={`h-8 w-8 shrink-0 ${file4 ? 'text-emerald-600' : 'text-slate-400'}`} />
              <div className="min-w-0">
                {file4 ? (
                  <p className="text-sm font-medium text-emerald-700 truncate">{file4.name}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Clique para selecionar <span className="font-mono">Relatorio (4).xlsx</span></p>
                )}
              </div>
              {file4 && <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 ml-auto" />}
            </div>
            <input
              ref={relatorio4Ref}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => setFile4(e.target.files?.[0] ?? null)}
            />
          </div>

          {/* File picker: Relatorio 3 */}
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Relatório (3) — Vínculos e Valores
            </label>
            <div
              className="flex items-center gap-3 border border-dashed border-border-default rounded-lg p-3 cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => relatorio3Ref.current?.click()}
            >
              <FileSpreadsheet className={`h-8 w-8 shrink-0 ${file3 ? 'text-emerald-600' : 'text-slate-400'}`} />
              <div className="min-w-0">
                {file3 ? (
                  <p className="text-sm font-medium text-emerald-700 truncate">{file3.name}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Clique para selecionar <span className="font-mono">Relatorio (3).xlsx</span></p>
                )}
              </div>
              {file3 && <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 ml-auto" />}
            </div>
            <input
              ref={relatorio3Ref}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => setFile3(e.target.files?.[0] ?? null)}
            />
          </div>

          {/* Log area */}
          {logs.length > 0 && (
            <div className="max-h-48 overflow-y-auto rounded-lg bg-slate-950 p-3 space-y-0.5 text-xs font-mono">
              {logs.map((log, i) => (
                <p key={i} className={logColor[log.type]}>
                  {log.type === 'success' ? '✓ ' : log.type === 'error' ? '✗ ' : log.type === 'warning' ? '⚠ ' : '› '}
                  {log.message}
                </p>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={running}>
            {done ? 'Fechar' : 'Cancelar'}
          </Button>
          <Button
            onClick={handleSync}
            disabled={!file4 || !file3 || running || done}
            className="gap-2"
          >
            {running ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sincronizando...
              </>
            ) : done ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Concluído
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Sincronizar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
