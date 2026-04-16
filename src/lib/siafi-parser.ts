import { parseCurrency, formatarDocumento } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

export interface SiafiEmpenhoData {
    numeroCompleto: string;
    numeroResumido: string;
    processo: string;
    favorecidoNome: string;
    favorecidoDocumento: string;
    descricao: string;
    naturezaDespesa: string;
    planoInterno: string;
    ptres: string;
    isRap: boolean;
    valorLiquidadoOficial: number;
    valorPagoOficial: number;
    valorEmpenhado: number;
    rapInscrito: number;
    rapALiquidar: number;
    rapLiquidado: number;
    rapPago: number;
    rapAPagar: number;
    valorLiquidadoAPagar: number;
    saldoRapOficial?: number;
    rapSaldoOnly?: boolean;
}

type EmpenhoStatus = 'pendente' | 'liquidado' | 'pago' | 'cancelado';

const normalizeSiafiHeader = (value: string) =>
    value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');

const findSiafiColumn = (headers: string[], ...keywords: string[]) => {
    for (const keyword of keywords) {
        const normalizedKeyword = normalizeSiafiHeader(keyword);
        const index = headers.findIndex(header => normalizeSiafiHeader(header).includes(normalizedKeyword));
        if (index !== -1) return index;
    }

    return -1;
};

const getRapSaldoAjustado = (rapAPagar: number, valorLiquidadoAPagar: number) =>
    Math.max(0, rapAPagar - valorLiquidadoAPagar);

const getImportedRapSaldo = (item: Pick<SiafiEmpenhoData, 'saldoRapOficial' | 'rapAPagar' | 'valorLiquidadoAPagar'>) =>
    item.saldoRapOficial != null
        ? Math.max(0, item.saldoRapOficial)
        : getRapSaldoAjustado(item.rapAPagar, item.valorLiquidadoAPagar);

const getRapStatus = (
    item: Pick<SiafiEmpenhoData, 'rapSaldoOnly' | 'saldoRapOficial' | 'rapAPagar' | 'rapPago' | 'valorLiquidadoAPagar'>,
    existingStatus?: string | null,
): 'pendente' | 'liquidado' | 'pago' => {
    if (item.rapSaldoOnly) {
        const saldoAtual = getImportedRapSaldo(item);
        if (saldoAtual <= 0) return 'pago';
        if (existingStatus === 'liquidado') return 'liquidado';
        return 'pendente';
    }

    const saldoAjustado = getImportedRapSaldo(item);
    const houvePagamento = item.rapPago > 0;
    const houveLiquidacao = houvePagamento || item.valorLiquidadoAPagar > 0;

    if (saldoAjustado <= 0 && houvePagamento) return 'pago';
    if (houveLiquidacao) return 'liquidado';
    return 'pendente';
};

const detectDelimiter = (line: string) => (line.includes(';') ? ';' : (line.includes('\t') ? '\t' : ','));

const isRapSaldoHeader = (line: string) => {
    const normalized = normalizeSiafiHeader(line);
    return normalized.includes('NECCOR') && normalized.includes('METRICA') && !normalized.includes('DESPESASEMPENHADASCONTROLEEMPENHO');
};

function parseCsvLine(line: string, delimiter: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === delimiter && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }

    result.push(current);

    return result.map(segment => {
        let value = segment.trim();
        if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
            value = value.substring(1, value.length - 1);
        }
        return value.replace(/""/g, '"');
    });
}

function decodeCsvBytes(bytes: Uint8Array) {
    if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
        return new TextDecoder('utf-16le').decode(bytes);
    }

    if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
        return new TextDecoder('utf-16be').decode(bytes);
    }

    const utf8 = new TextDecoder('utf-8').decode(bytes);
    if (utf8.includes('\ufffd')) {
        return new TextDecoder('iso-8859-1').decode(bytes);
    }

    return utf8;
}
const parseRapSaldoCsvText = (text: string): SiafiEmpenhoData[] => {
    const lines = text.split(/\r?\n/);
    let headerIndex = -1;
    let delimiter = ';';

    for (let i = 0; i < Math.min(15, lines.length); i++) {
        if (isRapSaldoHeader(lines[i])) {
            headerIndex = i;
            delimiter = detectDelimiter(lines[i]);
            break;
        }
    }

    if (headerIndex === -1) {
        throw new Error('Colunas do CSV de saldo de RAP nao encontradas. Verifique o cabecalho com "NE CCor" e "Metrica".');
    }

    const headers = parseCsvLine(lines[headerIndex], delimiter);
    const colNE = headers.findIndex(header => normalizeSiafiHeader(header) === 'NECCOR');
    const colMetrica = findSiafiColumn(headers, 'Metrica');
    const colValor = findSiafiColumn(headers, 'Valor', 'Saldo', 'Saldo - Moeda Origem');

    if (colNE === -1 || colMetrica === -1) {
        throw new Error('Colunas "NE CCor" e "Metrica" sao obrigatorias no CSV de saldo de RAP.');
    }

    const data: SiafiEmpenhoData[] = [];

    for (let i = headerIndex + 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const cols = parseCsvLine(line, delimiter);
        const numeroCompleto = String(cols[colNE] || '').trim();
        if (!numeroCompleto || !numeroCompleto.includes('NE')) continue;

        const metrica = String(cols[colMetrica] || '').trim();
        if (metrica && !normalizeSiafiHeader(metrica).includes('SALDO')) continue;

        const fallbackValue = cols.find((value, index) => index !== colNE && index !== colMetrica && String(value || '').trim());
        const saldoRapOficial = parseCurrency(colValor >= 0 ? cols[colValor] : fallbackValue || '');
        const numeroResumido = numeroCompleto.match(/(\d{4}NE\d+)/)?.[1] || numeroCompleto;

        data.push({
            numeroCompleto,
            numeroResumido,
            processo: '',
            favorecidoNome: '',
            favorecidoDocumento: '',
            descricao: '',
            naturezaDespesa: '',
            planoInterno: '',
            ptres: '',
            isRap: true,
            valorLiquidadoOficial: 0,
            valorPagoOficial: 0,
            valorEmpenhado: 0,
            rapInscrito: 0,
            rapALiquidar: 0,
            rapLiquidado: 0,
            rapPago: 0,
            rapAPagar: saldoRapOficial,
            valorLiquidadoAPagar: 0,
            saldoRapOficial,
            rapSaldoOnly: true,
        });
    }

    return data;
};

export function parseSiafiCsvText(text: string): SiafiEmpenhoData[] {
    const lines = text.split(/\r?\n/);

    if (lines.length < 2) {
        throw new Error('Arquivo vazio ou com formato invalido.');
    }

    if (lines.slice(0, 15).some(isRapSaldoHeader)) {
        return parseRapSaldoCsvText(text);
    }

    let headerIndex = -1;
    let delimiter = ';';

    for (let i = 0; i < Math.min(15, lines.length); i++) {
        if (normalizeSiafiHeader(lines[i]).includes('NECCOR')) {
            headerIndex = i;
            delimiter = detectDelimiter(lines[i]);
            break;
        }
    }

    if (headerIndex === -1) {
        throw new Error('Coluna "NE CCor" nao encontrada nas primeiras linhas do arquivo. Verifique o padrao do CSV.');
    }

    const headers = parseCsvLine(lines[headerIndex], delimiter);
    console.log('[SIAFI Parser] Headers encontrados:', headers.join(' | '));

    const colNE = headers.findIndex(header => normalizeSiafiHeader(header) === 'NECCOR');
    const colProcesso = findSiafiColumn(headers, 'Num. Processo');
    const colFavorecidoNome = findSiafiColumn(headers, 'Favorecido Nome');
    const colFavorecidoNumero = findSiafiColumn(headers, 'Favorecido Numero');
    const colDescricao = findSiafiColumn(headers, 'Descricao', 'Observacao', 'Historico');
    const colNatureza = findSiafiColumn(headers, 'Natureza Despesa');
    const colPlanoInterno = findSiafiColumn(headers, 'PI Codigo', 'Plano Interno');
    const colPtres = findSiafiColumn(headers, 'PTRES');
    const colEmpenhadas = findSiafiColumn(headers, 'DESPESAS EMPENHADAS (CONTROLE EMPENHO)');
    const colLiquidadas = findSiafiColumn(headers, 'DESPESAS LIQUIDADAS (CONTROLE EMPENHO)');
    const colPagas = findSiafiColumn(headers, 'DESPESAS PAGAS (CONTROLE EMPENHO)');
    const colLiquidadasAPagar = findSiafiColumn(headers, 'DESPESAS LIQUIDADAS A PAGAR (CONTROLE EMPENHO)');
    const colRapInscritos = findSiafiColumn(headers, 'RESTOS A PAGAR INSCRITOS');
    const colRapALiquidar = findSiafiColumn(
        headers,
        'RESTOS A PAGAR NAO PROCESSADOS A LIQUIDAR',
        'RESTOS A PAGAR NAO PROCESSADOS REINSCRITOS',
    );
    const colRapLiquidadoAPagar = findSiafiColumn(
        headers,
        'RESTOS A PAGAR NAO PROCES. LIQUIDADOS A PAGAR',
        'RESTOS A PAGAR NAO PROCESSADOS LIQUIDADOS A PAGAR',
    );
    const colRapPagos = findSiafiColumn(headers, 'RESTOS A PAGAR PAGOS');
    const colRapAPagar = findSiafiColumn(headers, 'RESTOS A PAGAR A PAGAR');

    if (colNE === -1) {
        throw new Error('Coluna "NE CCor" nao encontrada. Verifique o padrao do CSV.');
    }

    console.log('[SIAFI Parser] Column indices:', {
        colNE,
        colProcesso,
        colFavorecidoNome,
        colFavorecidoNumero,
        colDescricao,
        colNatureza,
        colPlanoInterno,
        colPtres,
    });

    let maxAnoEmpenho = 0;
    for (let i = headerIndex + 1; i < lines.length; i++) {
        const matchAno = lines[i].match(/(\d{4})NE\d+/);
        if (!matchAno) continue;

        const ano = parseInt(matchAno[1], 10);
        if (ano > maxAnoEmpenho) maxAnoEmpenho = ano;
    }

    const currentYear = maxAnoEmpenho > 0 ? maxAnoEmpenho : new Date().getFullYear();
    const data: SiafiEmpenhoData[] = [];

    for (let i = headerIndex + 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const cols = parseCsvLine(line, delimiter);
        if (cols.length < 3) continue;

        const numeroCompleto = String(cols[colNE] || '').trim();
        if (!numeroCompleto || !numeroCompleto.includes('NE')) continue;

        const numeroResumido = numeroCompleto.match(/(\d{4}NE\d+)/)?.[1] || numeroCompleto;
        const anoEmpenho = parseInt(numeroResumido.substring(0, 4), 10);
        const isRap = anoEmpenho < currentYear;
        const safeCol = (idx: number) => (idx >= 0 && idx < cols.length ? cols[idx] : '');

        let favorecidoDocumento = safeCol(colFavorecidoNumero);
        if (favorecidoDocumento) {
            favorecidoDocumento = formatarDocumento(favorecidoDocumento);
        }

        const valorEmpenhado = parseCurrency(safeCol(colEmpenhadas));
        const valorLiquidadoOficial = parseCurrency(safeCol(colLiquidadas));
        const valorPagoOficial = parseCurrency(safeCol(colPagas));

        let valorLiquidadoAPagar = 0;
        if (isRap) {
            valorLiquidadoAPagar = parseCurrency(safeCol(colRapLiquidadoAPagar));
        } else {
            valorLiquidadoAPagar = parseCurrency(safeCol(colLiquidadasAPagar));
            if (colLiquidadasAPagar === -1) {
                valorLiquidadoAPagar = valorLiquidadoOficial - valorPagoOficial;
            }
        }

        const rapInscrito = parseCurrency(safeCol(colRapInscritos));
        const rapALiquidar = parseCurrency(safeCol(colRapALiquidar));
        const rapPago = parseCurrency(safeCol(colRapPagos));
        const rapAPagar = parseCurrency(safeCol(colRapAPagar));
        const rapLiquidado = Math.max(0, rapInscrito - rapALiquidar);

        data.push({
            numeroCompleto,
            numeroResumido,
            processo: safeCol(colProcesso),
            favorecidoNome: safeCol(colFavorecidoNome),
            favorecidoDocumento,
            descricao: safeCol(colDescricao),
            naturezaDespesa: safeCol(colNatureza),
            planoInterno: safeCol(colPlanoInterno),
            ptres: colPtres !== -1 ? safeCol(colPtres) : '',
            isRap,
            valorLiquidadoOficial,
            valorPagoOficial,
            valorLiquidadoAPagar,
            valorEmpenhado,
            rapInscrito,
            rapALiquidar,
            rapLiquidado,
            rapPago,
            rapAPagar,
        });
    }

    return data;
}

export async function parseSiafiCsv(file: File): Promise<SiafiEmpenhoData[]> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (event) => {
            try {
                const bytes = new Uint8Array(event.target?.result as ArrayBuffer);
                const text = decodeCsvBytes(bytes);
                resolve(parseSiafiCsvText(text));
            } catch (error) {
                reject(error);
            }
        };

        reader.onerror = () => reject(new Error('Falha ao ler o arquivo.'));
        reader.readAsArrayBuffer(file);
    });
}

export async function syncSiafiDataToDb(
    data: SiafiEmpenhoData[],
    onProgress?: (processed: number, total: number) => void,
): Promise<{ atualizados: number; criados: number; erros: number }> {
    let atualizados = 0;
    let criados = 0;
    let erros = 0;

    const uploadDate = new Date();
    uploadDate.setHours(3, 0, 0, 0);
    const ultimaAtualizacaoSiafiStr = uploadDate.toISOString();

    for (let i = 0; i < data.length; i++) {
        const item = data[i];

        try {
            const { data: empenhos } = await supabase
                .from('empenhos')
                .select('id, tipo, status')
                .eq('numero', item.numeroResumido)
                .limit(1);

            if (empenhos && empenhos.length > 0) {
                const existingEmpenho = empenhos[0] as { id: string; tipo?: string | null; status?: string | null };
                const updatePayload: Record<string, unknown> = {
                    ultima_atualizacao_siafi: ultimaAtualizacaoSiafiStr,
                };

                if (!item.rapSaldoOnly) {
                    updatePayload.valor_liquidado_oficial = item.valorLiquidadoOficial;
                    updatePayload.valor_pago_oficial = item.valorPagoOficial;
                    updatePayload.valor_liquidado_a_pagar = item.valorLiquidadoAPagar;
                }

                if (item.isRap) {
                    updatePayload.tipo = 'rap';
                    updatePayload.saldo_rap_oficial = getImportedRapSaldo(item);
                    updatePayload.status = getRapStatus(item, existingEmpenho.status);

                    if (!item.rapSaldoOnly) {
                        updatePayload.rap_inscrito = item.rapInscrito;
                        updatePayload.rap_a_liquidar = item.rapALiquidar;
                        updatePayload.rap_liquidado = item.rapLiquidado;
                        updatePayload.rap_pago = item.rapPago;
                        updatePayload.valor = item.rapInscrito;
                    }
                } else {
                    updatePayload.valor = item.valorEmpenhado;
                    updatePayload.valor_liquidado = item.valorLiquidadoOficial;

                    if (item.valorPagoOficial > 0 && item.valorPagoOficial >= item.valorEmpenhado) {
                        updatePayload.status = 'pago';
                    } else if (item.valorLiquidadoOficial > 0 && item.valorLiquidadoOficial >= item.valorEmpenhado) {
                        updatePayload.status = 'liquidado';
                    } else {
                        updatePayload.status = 'pendente';
                    }
                }

                if (item.descricao) updatePayload.descricao = item.descricao;
                if (item.processo) updatePayload.processo = item.processo;
                if (item.favorecidoNome) updatePayload.favorecido_nome = item.favorecidoNome;
                if (item.favorecidoDocumento) updatePayload.favorecido_documento = item.favorecidoDocumento;
                if (item.naturezaDespesa) updatePayload.natureza_despesa = item.naturezaDespesa;
                if (item.planoInterno) updatePayload.plano_interno = item.planoInterno;
                if (item.ptres) updatePayload.origem_recurso = item.ptres;

                const { error } = await supabase
                    .from('empenhos')
                    .update(updatePayload)
                    .eq('id', existingEmpenho.id);

                if (error) {
                    console.error(`Erro update ${item.numeroResumido}:`, error);
                    erros++;
                } else {
                    atualizados++;
                }
            } else if (item.isRap) {
                const saldoRapOficial = getImportedRapSaldo(item);
                const { error } = await supabase
                    .from('empenhos')
                    .insert({
                        numero: item.numeroResumido,
                        descricao: item.descricao || `Empenho RAP ${item.numeroResumido}`,
                        valor: item.rapSaldoOnly ? saldoRapOficial : item.rapInscrito,
                        dimensao: '',
                        componente_funcional: '',
                        origem_recurso: item.ptres || '',
                        natureza_despesa: item.naturezaDespesa || '',
                        plano_interno: item.planoInterno || null,
                        favorecido_nome: item.favorecidoNome || null,
                        favorecido_documento: item.favorecidoDocumento || null,
                        processo: item.processo || null,
                        data_empenho: `${item.numeroResumido.substring(0, 4)}-01-01`,
                        status: getRapStatus(item),
                        tipo: 'rap',
                        rap_inscrito: item.rapSaldoOnly ? saldoRapOficial : item.rapInscrito,
                        rap_a_liquidar: item.rapSaldoOnly ? null : item.rapALiquidar,
                        rap_liquidado: item.rapSaldoOnly ? null : item.rapLiquidado,
                        rap_pago: item.rapSaldoOnly ? null : item.rapPago,
                        valor_liquidado_a_pagar: item.rapSaldoOnly ? null : item.valorLiquidadoAPagar,
                        valor_liquidado_oficial: item.rapSaldoOnly ? null : item.valorLiquidadoOficial,
                        valor_pago_oficial: item.rapSaldoOnly ? null : item.valorPagoOficial,
                        saldo_rap_oficial: saldoRapOficial,
                        ultima_atualizacao_siafi: ultimaAtualizacaoSiafiStr,
                    });

                if (error) {
                    console.error(`Erro criando RAP ${item.numeroResumido}:`, error);
                    erros++;
                } else {
                    criados++;
                }
            } else {
                let status: EmpenhoStatus = 'pendente';
                if (item.valorPagoOficial > 0 && item.valorPagoOficial >= item.valorEmpenhado) {
                    status = 'pago';
                } else if (item.valorLiquidadoOficial > 0 && item.valorLiquidadoOficial >= item.valorEmpenhado) {
                    status = 'liquidado';
                }

                const { error } = await supabase
                    .from('empenhos')
                    .insert({
                        numero: item.numeroResumido,
                        descricao: item.descricao || `Empenho ${item.numeroResumido}`,
                        valor: item.valorEmpenhado,
                        dimensao: '',
                        componente_funcional: '',
                        origem_recurso: item.ptres || '',
                        natureza_despesa: item.naturezaDespesa || '',
                        plano_interno: item.planoInterno || null,
                        favorecido_nome: item.favorecidoNome || null,
                        favorecido_documento: item.favorecidoDocumento || null,
                        processo: item.processo || null,
                        data_empenho: `${item.numeroResumido.substring(0, 4)}-01-01`,
                        status,
                        tipo: 'exercicio',
                        valor_liquidado: item.valorLiquidadoOficial,
                        valor_liquidado_a_pagar: item.valorLiquidadoAPagar,
                        valor_liquidado_oficial: item.valorLiquidadoOficial,
                        valor_pago_oficial: item.valorPagoOficial,
                        ultima_atualizacao_siafi: ultimaAtualizacaoSiafiStr,
                    });

                if (error) {
                    console.error(`Erro criando Empenho corrente ${item.numeroResumido}:`, error);
                    erros++;
                } else {
                    criados++;
                }
            }
        } catch (error) {
            console.error(`Excecao ${item.numeroResumido}:`, error);
            erros++;
        }

        if (onProgress) {
            onProgress(i + 1, data.length);
        }
    }

    return { atualizados, criados, erros };
}
