import {
  createExecutionRecord,
  createSupabaseAdminClient,
  finishExecutionRecord,
  hasSupabaseCredentials,
  loadPayload,
  normalizePayload,
  parseArgs,
} from './shared.mjs';

const printUsage = () => {
  console.log(`
Uso:
  npm run atas:ingest -- --file=tmp/atas.json
  npm run atas:ingest -- --url=https://fonte/api/atas
  npm run atas:ingest -- --source=pncp --data-inicial=20260101 --data-final=20260331
  Get-Content .\\tmp\\atas.json | npm run atas:ingest -- --stdin

Opcoes:
  --file=PATH       Carrega um JSON local
  --url=URL         Carrega um JSON via HTTP
  --source=pncp     Consulta a API oficial do PNCP
  --data-inicial    Data inicial AAAAMMDD para consulta no PNCP
  --data-final      Data final AAAAMMDD para consulta no PNCP
  --cnpj-orgao      Filtra a consulta do PNCP por CNPJ do orgao
  --page-size=N     Tamanho da pagina no PNCP (10 a 500)
  --max-pages=N     Limita a quantidade de paginas consultadas no PNCP
  --stdin           Le o JSON pela entrada padrao
  --limit=N         Limita a quantidade de atas processadas
  --dry-run         Normaliza e resume, mas nao grava no banco
`.trim());
};

const upsertAtas = async (supabase, records) => {
  const atasPayload = records.map((entry) => entry.ata);

  const { data, error } = await supabase
    .from('atas')
    .upsert(atasPayload, { onConflict: 'identificador_fonte' })
    .select('id, identificador_fonte');

  if (error) throw error;

  const idByIdentifier = new Map(data.map((row) => [row.identificador_fonte, row.id]));
  return idByIdentifier;
};

const replaceItens = async (supabase, records, idByIdentifier) => {
  const recordsWithReplaceMode = records.filter((entry) => entry.item_sync_mode === 'replace');

  const ataIds = recordsWithReplaceMode
    .map((entry) => idByIdentifier.get(entry.ata.identificador_fonte))
    .filter(Boolean);

  if (ataIds.length > 0) {
    const { error: deleteError } = await supabase.from('itens_ata').delete().in('ata_id', ataIds);
    if (deleteError) throw deleteError;
  }

  const itemsPayload = recordsWithReplaceMode.flatMap((entry) => {
    const ataId = idByIdentifier.get(entry.ata.identificador_fonte);
    if (!ataId) return [];

    return entry.items.map((item) => ({
      ata_id: ataId,
      numero_item: item.numero_item,
      descricao: item.descricao,
      tipo_item: item.tipo_item,
      unidade_fornecimento: item.unidade_fornecimento,
      quantidade: item.quantidade,
      codigo_catmat_catser: item.codigo_catmat_catser,
      valor_unitario: item.valor_unitario,
      valor_total: item.valor_total,
      quantidade_homologada_fornecedor: item.quantidade_homologada_fornecedor,
      maximo_adesao: item.maximo_adesao,
      fornecedor_documento: item.fornecedor_documento,
      fornecedor_nome: item.fornecedor_nome,
      codigo_pdm: item.codigo_pdm,
      nome_pdm: item.nome_pdm,
      metadata: item.metadata,
    }));
  });

  if (itemsPayload.length === 0) {
    return {
      insertedItems: 0,
      preservedAtas: records.filter((entry) => entry.item_sync_mode !== 'replace').length,
      replacedAtas: recordsWithReplaceMode.length,
    };
  }

  const { error: insertError } = await supabase.from('itens_ata').insert(itemsPayload);
  if (insertError) throw insertError;

  return {
    insertedItems: itemsPayload.length,
    preservedAtas: records.filter((entry) => entry.item_sync_mode !== 'replace').length,
    replacedAtas: recordsWithReplaceMode.length,
  };
};

const run = async () => {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    return;
  }

  const options = parseArgs(args);
  const canUseDatabase = hasSupabaseCredentials();
  if (!canUseDatabase && !options.dryRun) {
    throw new Error('Credenciais do Supabase ausentes. Para gravar no banco, configure VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY ou VITE_SUPABASE_ANON_KEY.');
  }

  const supabase = canUseDatabase ? createSupabaseAdminClient() : null;

  const { payload, sourceType, sourceReference } = await loadPayload(options);

  let executionId = null;
  if (supabase) {
    try {
      executionId = await createExecutionRecord(supabase, {
        origem_tipo: sourceType,
        origem_referencia: sourceReference,
        status: 'iniciada',
        mensagem: 'Carga iniciada',
        dry_run: options.dryRun,
        detalhes: {
          limit: options.limit,
        },
      });
    } catch (error) {
      const isMissingAuditTable =
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'PGRST205';

      if (isMissingAuditTable) {
        console.warn('Tabela public.atas_ingestao_execucoes ainda nao encontrada. Seguindo sem auditoria desta execucao.');
      } else {
        throw error;
      }
    }
  }

  try {
    const { records, errors } = normalizePayload(payload, sourceReference, options.limit);
    const totalItens = records.reduce((sum, entry) => sum + entry.items.length, 0);
    const itemSyncSummary = {
      replace: records.filter((entry) => entry.item_sync_mode === 'replace').length,
      preserve: records.filter((entry) => entry.item_sync_mode !== 'replace').length,
    };

    if (options.dryRun) {
      console.log(
        JSON.stringify(
          {
            executionId,
            dryRun: true,
            sourceType,
            sourceReference,
            totalAtas: records.length,
            totalItens,
            totalErros: errors.length,
            itemSyncSummary,
            sample: records.slice(0, 2).map((entry) => ({
              numero_ata: entry.ata.numero_ata,
              objeto: entry.ata.objeto,
              itens: entry.items.length,
              item_sync_mode: entry.item_sync_mode,
            })),
            errors,
            meta: payload?.meta || null,
          },
          null,
          2
        )
      );

      if (supabase && executionId) {
        await finishExecutionRecord(supabase, executionId, {
          status: 'concluida',
          mensagem: 'Dry run concluido sem persistencia',
          total_atas: records.length,
          total_itens: totalItens,
          total_erros: errors.length,
          detalhes: {
            errors,
            dryRun: true,
            itemSyncSummary,
            meta: payload?.meta || null,
          },
        });
      }

      return;
    }

    if (!supabase) {
      throw new Error('Supabase indisponivel para persistir a carga.');
    }

    const idByIdentifier = await upsertAtas(supabase, records);
    const itemWriteSummary = await replaceItens(supabase, records, idByIdentifier);

    if (executionId) {
      await finishExecutionRecord(supabase, executionId, {
        status: 'concluida',
        mensagem: 'Carga concluida com sucesso',
        total_atas: records.length,
        total_itens: itemWriteSummary.insertedItems,
        total_erros: errors.length,
        detalhes: {
          errors,
          itemSyncSummary,
          itemWriteSummary,
          meta: payload?.meta || null,
        },
      });
    }

    console.log(
      JSON.stringify(
        {
          executionId,
          sourceType,
          sourceReference,
          totalAtas: records.length,
          totalItens: itemWriteSummary.insertedItems,
          totalErros: errors.length,
          itemSyncSummary,
          itemWriteSummary,
          meta: payload?.meta || null,
        },
        null,
        2
      )
    );
  } catch (error) {
    if (supabase && executionId) {
      await finishExecutionRecord(supabase, executionId, {
        status: 'falha',
        mensagem: error instanceof Error ? error.message : 'Falha desconhecida na carga de atas',
        total_erros: 1,
        detalhes: {
          stack: error instanceof Error ? error.stack : null,
        },
      });
    }

    throw error;
  }
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
