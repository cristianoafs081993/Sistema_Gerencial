import { parseCurrency } from '@/lib/utils';
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

                const headers = lines[0].split(';');
                const data: SiafiEmpenhoData[] = [];

                // Normalizar removendo acentos para comparação segura
                const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

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

                console.log('[SIAFI Parser] Column indices:', { colNE, colProcesso, colFavorecidoNome, colFavorecidoNum, colDescricao, colNatureza, colPI });

                // Exercício Atual
                const colEmpenhadas = findCol('DESPESAS EMPENHADAS (CONTROLE EMPENHO)');
                const colLiquidadas = findCol('DESPESAS LIQUIDADAS (CONTROLE EMPENHO)');
                const colPagas = findCol('DESPESAS PAGAS (CONTROLE EMPENHO)');

                // Restos a Pagar (RAP) - 4 estágios
                const colRapInscritos = findCol('RESTOS A PAGAR INSCRITOS');
                const colRapALiquidar = findCol('RESTOS A PAGAR NAO PROCESSADOS A LIQUIDAR');
                const colRapPagos = findCol('RESTOS A PAGAR PAGOS');
                const colRapAPagar = findCol('RESTOS A PAGAR A PAGAR');

                if (colNE === -1) {
                    throw new Error('Coluna "NE CCor" não encontrada. Verifique o padrão do CSV.');
                }

                const currentYear = new Date().getFullYear();

                for (let i = 1; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (!line) continue;

                    const cols = line.split(';');
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
                    const favorecidoDocumento = safeCol(colFavorecidoNum);
                    const descricao = safeCol(colDescricao);
                    const naturezaDespesa = safeCol(colNatureza);
                    const planoInterno = safeCol(colPI);

                    // Valores
                    const valorEmpenhado = parseCurrency(safeCol(colEmpenhadas));
                    const valorLiquidadoOficial = parseCurrency(safeCol(colLiquidadas));
                    const valorPagoOficial = parseCurrency(safeCol(colPagas));

                    const rapInscrito = parseCurrency(safeCol(colRapInscritos));
                    const rapALiquidar = parseCurrency(safeCol(colRapALiquidar));
                    const rapPago = parseCurrency(safeCol(colRapPagos));
                    const rapAPagar = parseCurrency(safeCol(colRapAPagar));
                    const rapLiquidado = rapInscrito - rapALiquidar;

                    data.push({
                        numeroCompleto,
                        numeroResumido,
                        processo,
                        favorecidoNome,
                        favorecidoDocumento,
                        descricao,
                        naturezaDespesa,
                        planoInterno,
                        isRap,
                        valorLiquidadoOficial,
                        valorPagoOficial,
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
                const updatePayload: Record<string, any> = {
                    valor_liquidado_oficial: item.valorLiquidadoOficial,
                    valor_pago_oficial: item.valorPagoOficial,
                    ultima_atualizacao_siafi: new Date().toISOString(),
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
                        origem_recurso: '',
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
                        ultima_atualizacao_siafi: new Date().toISOString(),
                    });

                if (error) {
                    console.error(`Erro criando RAP ${item.numeroResumido}:`, error);
                    erros++;
                } else {
                    criados++;
                }
            }
            // Exercício corrente que não existe no sistema: skip (são criados pela sincronização)
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
