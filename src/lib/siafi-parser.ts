import { parseCurrency, formatarDocumento } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

export interface SiafiEmpenhoData {
    numeroCompleto: string;   // Ex: 158366264352024NE000010
    numeroResumido: string;   // Ex: 2024NE000010
    processo: string;
    favorecidoNome: string;
    favorecidoDocumento: string;
    descricao: string;
    naturezaDespesa: string;
    planoInterno: string;
    ptres: string;
    isRap: boolean;
    // Exercício corrente
    valorLiquidadoOficial: number;
    valorPagoOficial: number;
    valorEmpenhado: number;
    // RAP 4 estágios
    rapInscrito: number;
    rapALiquidar: number;
    rapLiquidado: number;  // = inscrito - a liquidar
    rapPago: number;
    rapAPagar: number;     // saldo restante
    valorLiquidadoAPagar: number;
}

/**
 * Faz o parse de uma linha de CSV lidando com aspas que encapsulam o delimitador.
 */
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

    return result.map(s => {
        let val = s.trim();
        if (val.startsWith('"') && val.endsWith('"') && val.length >= 2) {
            val = val.substring(1, val.length - 1);
        }
        return val.replace(/""/g, '"');
    });
}

/**
 * Lê o conteúdo do arquivo CSV do Tesouro Gerencial/SIAFI e extrai os saldos dos empenhos.
 */
export async function parseSiafiCsv(file: File): Promise<SiafiEmpenhoData[]> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const text = e.target?.result as string;
                const lines = text.split(/\r?\n/);

                if (lines.length < 2) {
                    throw new Error('Arquivo vazio ou com formato inválido.');
                }
                // Normalizar removendo acentos para comparação segura
                const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

                // Procurar a linha de cabeçalho
                let headerIndex = -1;
                let delimiter = ';';
                for (let i = 0; i < Math.min(15, lines.length); i++) {
                    const lineNorm = normalize(lines[i]);
                    if (lineNorm.includes('NE CCOR')) {
                        headerIndex = i;
                        delimiter = lines[i].includes(';') ? ';' : (lines[i].includes('\t') ? '\t' : ',');
                        break;
                    }
                }

                if (headerIndex === -1) {
                    throw new Error('Coluna "NE CCor" não encontrada nas primeiras linhas do arquivo. Verifique o padrão do CSV.');
                }

                const headers = parseCsvLine(lines[headerIndex], delimiter);

                const findCol = (keyword: string) => {
                    const nk = normalize(keyword);
                    return headers.findIndex(h => normalize(h).includes(nk));
                };

                console.log('[SIAFI Parser] Headers encontrados:', headers.join(' | '));

                const colNE = headers.findIndex(h => normalize(h).includes('NE CCOR') && !normalize(h).includes('-'));
                const colProcesso = findCol('Num. Processo');
                const colFavorecidoNome = findCol('Favorecido Nome');
                const colFavorecidoNum = findCol('Favorecido Numero');
                const colDescricao = findCol('Descricao') !== -1
                    ? findCol('Descricao')
                    : findCol('Observacao') !== -1
                        ? findCol('Observacao')
                        : findCol('Historico');
                const colNatureza = findCol('Natureza Despesa');
                const colPI = findCol('PI Codigo') !== -1 ? findCol('PI Codigo') : findCol('Plano Interno');
                const colPTRES = findCol('PTRES');

                console.log('[SIAFI Parser] Column indices:', { colNE, colProcesso, colFavorecidoNome, colFavorecidoNum, colDescricao, colNatureza, colPI, colPTRES });

                // Exercício Atual
                const colEmpenhadas = findCol('DESPESAS EMPENHADAS (CONTROLE EMPENHO)');
                const colLiquidadas = findCol('DESPESAS LIQUIDADAS (CONTROLE EMPENHO)');
                const colPagas = findCol('DESPESAS PAGAS (CONTROLE EMPENHO)');
                const colLiquidadasAPagar = findCol('DESPESAS LIQUIDADAS A PAGAR (CONTROLE EMPENHO)');

                // Restos a Pagar (RAP) - 4 estágios
                const colRapInscritos = findCol('RESTOS A PAGAR INSCRITOS');
                // Alguns relatórios trazem "NAO PROCESSADOS REINSCRITOS" no lugar de "A LIQUIDAR".
                // Usamos fallback para manter compatibilidade entre layouts do TG/SIAFI.
                const colRapALiquidar =
                    findCol('RESTOS A PAGAR NAO PROCESSADOS A LIQUIDAR') !== -1
                        ? findCol('RESTOS A PAGAR NAO PROCESSADOS A LIQUIDAR')
                        : findCol('RESTOS A PAGAR NAO PROCESSADOS REINSCRITOS');
                const colRapPagos = findCol('RESTOS A PAGAR PAGOS');
                const colRapAPagar = findCol('RESTOS A PAGAR A PAGAR');

                if (colNE === -1) {
                    throw new Error('Coluna "NE CCor" não encontrada. Verifique o padrão do CSV.');
                }

                let maxAnoEmpenho = 0;
                for (let i = headerIndex + 1; i < lines.length; i++) {
                    const matchAno = lines[i].match(/(\d{4})NE\d+/);
                    if (matchAno) {
                        const ano = parseInt(matchAno[1], 10);
                        if (ano > maxAnoEmpenho) maxAnoEmpenho = ano;
                    }
                }
                const currentYear = maxAnoEmpenho > 0 ? maxAnoEmpenho : new Date().getFullYear();

                const data: SiafiEmpenhoData[] = [];

                for (let i = headerIndex + 1; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (!line) continue;

                    const cols = parseCsvLine(line, delimiter);
                    if (cols.length < 3) continue;

                    const numeroCompleto = cols[colNE];
                    if (!numeroCompleto || !numeroCompleto.includes('NE')) continue;

                    // Extrair número resumido (YYYYNE...) do código completo
                    const matchAno = numeroCompleto.match(/(\d{4}NE\d+)/);
                    const numeroResumido = matchAno ? matchAno[1] : numeroCompleto;

                    const anoEmpenho = parseInt(numeroResumido.substring(0, 4), 10);
                    const isRap = anoEmpenho < currentYear;

                    const safeCol = (idx: number) => idx >= 0 && idx < cols.length ? cols[idx] : '';

                    const processo = safeCol(colProcesso);
                    const favorecidoNome = safeCol(colFavorecidoNome);
                    let favorecidoDocumento = safeCol(colFavorecidoNum);

                    if (favorecidoDocumento) {
                        favorecidoDocumento = formatarDocumento(favorecidoDocumento);
                    }

                    const descricao = safeCol(colDescricao);
                    const naturezaDespesa = safeCol(colNatureza);
                    const planoInterno = safeCol(colPI);
                    const ptres = colPTRES !== -1 ? safeCol(colPTRES) : '';

                    // Valores
                    const valorEmpenhado = parseCurrency(safeCol(colEmpenhadas));
                    const valorLiquidadoOficial = parseCurrency(safeCol(colLiquidadas));
                    const valorPagoOficial = parseCurrency(safeCol(colPagas));

                    let valorLiquidadoAPagar = parseCurrency(safeCol(colLiquidadasAPagar));
                    if (colLiquidadasAPagar === -1 && valorLiquidadoOficial !== undefined && valorPagoOficial !== undefined) {
                        valorLiquidadoAPagar = valorLiquidadoOficial - valorPagoOficial;
                    }

                    const rapInscrito = parseCurrency(safeCol(colRapInscritos));
                    const rapALiquidar = parseCurrency(safeCol(colRapALiquidar));
                    const rapPago = parseCurrency(safeCol(colRapPagos));
                    const rapAPagar = parseCurrency(safeCol(colRapAPagar));
                    const rapLiquidado = Math.max(0, rapInscrito - rapALiquidar);

                    data.push({
                        numeroCompleto,
                        numeroResumido,
                        processo,
                        favorecidoNome,
                        favorecidoDocumento,
                        descricao,
                        naturezaDespesa,
                        planoInterno,
                        ptres,
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

                resolve(data);
            } catch (error) {
                reject(error);
            }
        };

        reader.onerror = () => reject(new Error('Falha ao ler o arquivo.'));
        reader.readAsText(file, 'ISO-8859-1');
    });
}

/**
 * Processa os dados parseados e atualiza/cria empenhos no banco de dados.
 * - Para exercício corrente: atualiza campos _oficial
 * - Para RAP: cria empenho se não existir e preenche 4 estágios
 */
export async function syncSiafiDataToDb(
    data: SiafiEmpenhoData[],
    onProgress?: (processed: number, total: number) => void
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
            // 1. Buscar empenho existente
            const { data: empenhos } = await supabase
                .from('empenhos')
                .select('id, tipo')
                .eq('numero', item.numeroResumido)
                .limit(1);

            if (empenhos && empenhos.length > 0) {
                // Empenho já existe — atualizar campos oficiais
                const updatePayload: Record<string, unknown> = {
                    valor_liquidado_oficial: item.valorLiquidadoOficial,
                    valor_pago_oficial: item.valorPagoOficial,
                    valor_liquidado_a_pagar: item.valorLiquidadoAPagar,
                    ultima_atualizacao_siafi: ultimaAtualizacaoSiafiStr,
                };

                if (item.isRap) {
                    updatePayload.tipo = 'rap';
                    updatePayload.rap_inscrito = item.rapInscrito;
                    updatePayload.rap_a_liquidar = item.rapALiquidar;
                    updatePayload.rap_liquidado = item.rapLiquidado;
                    updatePayload.rap_pago = item.rapPago;
                    updatePayload.saldo_rap_oficial = item.rapAPagar;
                    updatePayload.valor = item.rapInscrito;
                    // Also update descriptive fields from CSV
                    if (item.descricao) updatePayload.descricao = item.descricao;
                    if (item.processo) updatePayload.processo = item.processo;
                    if (item.favorecidoNome) updatePayload.favorecido_nome = item.favorecidoNome;
                    if (item.favorecidoDocumento) updatePayload.favorecido_documento = item.favorecidoDocumento;
                    if (item.naturezaDespesa) updatePayload.natureza_despesa = item.naturezaDespesa;
                    if (item.planoInterno) updatePayload.plano_interno = item.planoInterno;
                    if (item.ptres) updatePayload.origem_recurso = item.ptres;
                } else {
                    // Exercício corrente — CSV é a fonte única de saldos
                    updatePayload.valor = item.valorEmpenhado;
                    updatePayload.valor_liquidado = item.valorLiquidadoOficial;

                    if (item.valorPagoOficial > 0 && item.valorPagoOficial >= item.valorEmpenhado) {
                        updatePayload.status = 'pago';
                    } else if (item.valorLiquidadoOficial > 0 && item.valorLiquidadoOficial >= item.valorEmpenhado) {
                        updatePayload.status = 'liquidado';
                    } else {
                        updatePayload.status = 'pendente';
                    }

                    // Also update descriptive fields from CSV
                    if (item.descricao) updatePayload.descricao = item.descricao;
                    if (item.processo) updatePayload.processo = item.processo;
                    if (item.favorecidoNome) updatePayload.favorecido_nome = item.favorecidoNome;
                    if (item.favorecidoDocumento) updatePayload.favorecido_documento = item.favorecidoDocumento;
                    if (item.naturezaDespesa) updatePayload.natureza_despesa = item.naturezaDespesa;
                    if (item.planoInterno) updatePayload.plano_interno = item.planoInterno;
                    if (item.ptres) updatePayload.origem_recurso = item.ptres;
                }

                const { error } = await supabase
                    .from('empenhos')
                    .update(updatePayload)
                    .eq('id', empenhos[0].id);

                if (error) {
                    console.error(`Erro update ${item.numeroResumido}:`, error);
                    erros++;
                } else {
                    atualizados++;
                }
            } else if (item.isRap) {
                // RAP não existe no sistema — CRIAR automaticamente
                const { error } = await supabase
                    .from('empenhos')
                    .insert({
                        numero: item.numeroResumido,
                        descricao: item.descricao || `Empenho RAP ${item.numeroResumido}`,
                        valor: item.rapInscrito,    // Valor inscrito é o "valor" do empenho RAP
                        dimensao: '',               // Será preenchido manualmente depois
                        componente_funcional: '',
                        origem_recurso: item.ptres || '',
                        natureza_despesa: item.naturezaDespesa || '',
                        plano_interno: item.planoInterno || null,
                        favorecido_nome: item.favorecidoNome || null,
                        favorecido_documento: item.favorecidoDocumento || null,
                        processo: item.processo || null,
                        data_empenho: `${item.numeroResumido.substring(0, 4)}-01-01`,
                        status: item.rapPago > 0 ? 'pago' : item.rapLiquidado > 0 ? 'liquidado' : 'pendente',
                        tipo: 'rap',
                        rap_inscrito: item.rapInscrito,
                        rap_a_liquidar: item.rapALiquidar,
                        rap_liquidado: item.rapLiquidado,
                        rap_pago: item.rapPago,
                        valor_liquidado_oficial: item.valorLiquidadoOficial,
                        valor_pago_oficial: item.valorPagoOficial,
                        saldo_rap_oficial: item.rapAPagar,
                        ultima_atualizacao_siafi: ultimaAtualizacaoSiafiStr,
                    });

                if (error) {
                    console.error(`Erro criando RAP ${item.numeroResumido}:`, error);
                    erros++;
                } else {
                    criados++;
                }
            } else {
                // Exercício corrente que não existe no sistema — CRIAR automaticamente a partir do CSV
                let status: 'pendente' | 'liquidado' | 'pago' | 'cancelado' = 'pendente';
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
                        dimensao: '',               // Será preenchido manualmente depois
                        componente_funcional: '',
                        origem_recurso: item.ptres || '',
                        natureza_despesa: item.naturezaDespesa || '',
                        plano_interno: item.planoInterno || null,
                        favorecido_nome: item.favorecidoNome || null,
                        favorecido_documento: item.favorecidoDocumento || null,
                        processo: item.processo || null,
                        data_empenho: `${item.numeroResumido.substring(0, 4)}-01-01`,
                        status: status,
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
        } catch (e) {
            console.error(`Exceção ${item.numeroResumido}:`, e);
            erros++;
        }

        if (onProgress) {
            onProgress(i + 1, data.length);
        }
    }

    return { atualizados, criados, erros };
}
