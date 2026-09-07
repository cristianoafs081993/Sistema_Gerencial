# Pesquisa de preços: precisão e recuperação da ingestão

Implementação de 07/09/2026, baseada no commit `08517c3cd12d7fb023fa645f4e715732f73ed305`. Este documento substitui as descrições anteriores de auditoria automática, ponderação 50/30/20 e sincronização sem autenticação.

## Comportamento

A RPC `match_preco_referencia_v2` combina rankings vetoriais, textuais e de trigramas por RRF. Consulta e documentos usam o mesmo modelo de embeddings, 768 dimensões e tarefas RETRIEVAL_QUERY/RETRIEVAL_DOCUMENT. Vetores antigos sem identificação do modelo ficam fora da etapa vetorial até serem regenerados; a busca textual continua disponível.

Cada referência é identificada por contratação e número do item. São conferidos preço homologado, data, unidade e requisitos técnicos antes da seleção. Registros legados sem origem do preço confirmada exigem consulta ao resultado do item no PNCP. O orçamento estimado da compra não substitui o preço unitário homologado. Unidades incompatíveis e embalagens sem capacidade conhecida não são convertidas por suposição.

A IA recebe a demanda completa e as evidências de cada candidato. Falhas e informações ausentes não aprovam referências automaticamente. A mediana usa somente referências selecionadas. O resultado permanece preliminar, inclusive com três ou mais preços: quantidade de fontes não comprova conformidade jurídica.

Quando faltam requisitos técnicos reconhecidos pelo extrator, o fluxo pode baixar e enviar PDFs oficiais ao modelo. Guarda URL, página, trecho e SHA-256 do arquivo efetivamente processado. Referências analisadas apenas pela descrição são identificadas dessa forma. A extração por IA precisa de conferência no original.

Limites por solicitação: cinco demandas, prazo aproximado de 110 segundos, avaliação em lotes de 15 e até três PDFs por demanda, com limite de 8 MB por arquivo. Há limites de paginação externa; a busca não representa todo o universo PNCP. O cache de PDF existe apenas durante a solicitação. O reconhecimento determinístico de requisitos cobre um conjunto inicial de características, não todas as categorias de compras.

## Ingestão e janeiro

As páginas são gravadas atomicamente com o cursor. Uma página inválida não avança a execução. O lease impede duas execuções simultâneas no mesmo escopo. Execuções parciais mantêm período e tamanho de página e retomam de onde pararam. Novos registros, atualizações e descartes têm contagens separadas. Alterar descrição, detalhamento ou marca invalida o embedding; exclusões manuais de amostra são preservadas.

O incremento diário considera a última janela v2 concluída e consulta datas de inclusão na API Compras.gov.br. Alterações tardias em itens antigos podem exigir reprocessamento mensal. Ter muitos registros de janeiro não assegura cobertura de resultados homologados, especificações completas ou vetores utilizáveis.

Depois da implantação, execute `backfill_mensal` para janeiro do ano correspondente aos dados. Repita a mesma requisição até `completed`, usando `resumeRunId` retornado quando necessário. Não exclua os dados legados. Execute `generate_embeddings` em lotes até zerar pendências. A retomada automática agendada cobre execuções diárias; o backfill mensal requer chamadas sucessivas.

## Implantação

1. Aplique o patch em uma branch e confira conflitos com alterações posteriores ao commit-base: `git apply --check melhorias.patch`, depois `git apply melhorias.patch`.
2. Revise e aplique, na ordem, `20260907010000_price_research_precision.sql` e `20260907011000_price_sync_authenticated_jobs.sql`. O projeto precisa das extensões existentes vector, pg_trgm, unaccent, pg_cron, pg_net e Vault. Confira a URL do projeto no dispatcher antes de aplicar em outro ambiente.
3. Cadastre um segredo aleatório no Vault com nome `price_sync_secret` e o mesmo valor no segredo de Edge Functions `PRICE_SYNC_SECRET`. Não grave o valor em arquivos versionados ou logs. Configure `GEMINI_API_KEY`; o modelo padrão de preços é `gemini-3.8-flash` (`GEMINI_PRICE_RESEARCH_MODEL`, com fallback automático para `gemini-2.5-flash`) e o de embeddings é `gemini-embedding-001` (`PRICE_EMBEDDING_MODEL`).
4. Publique `assistente-gerencial`, `pesquisar-precos` e `sync-precos-referencia`. Esta última usa `verify_jwt=false` no gateway, mas autentica todas as chamadas no handler. Escritas exigem superadmin autenticado, service role ou o segredo de sincronização; leitura exige autenticação.
5. Publique o frontend pelo fluxo habitual do projeto. Confira chamadas autenticadas, retomada de backfill, pendências de vetores e uma pesquisa representativa antes de considerar a mudança validada em produção.

Os agendamentos são diário às 04:00 UTC, retomada diária a cada dez minutos quando houver execução pendente sem lease ativo e embeddings pendentes aos 15 minutos de cada hora. Configure os segredos antes da primeira execução; sem segredo o dispatcher falha explicitamente.

Ao trocar o modelo de embeddings, planeje regeneração: o gerador busca registros com embedding ou embedding_model nulo. A troca da variável sozinha não regenera vetores existentes. Não misture modelos diferentes na comparação.

## Diagnóstico somente leitura

```sql
select price_kind, embedding_model, count(*)
from public.preco_referencia_itens
group by price_kind, embedding_model;

select status, tipo_sync, cursor_data, lease_until
from public.preco_referencia_sync_runs
order by created_at desc limit 30;
```

Compare resultados com um conjunto fixo de demandas reais, incluindo itens que deveriam e não deveriam ser selecionados. Registre precisão das seleções, cobertura, tempo, pendências de especificação e erros de origem. Não foi medida melhoria percentual com dados reais nesta entrega.

## Validação e limites desta entrega

Testes em `src/services/__tests__/priceResearchPrecision.test.ts` cobrem identidade por item, preços efetivos, requisitos, unidades, falhas, ingestão e PDF real no payload simulado. As chamadas de rede e IA são simuladas; não representam validação de respostas reais do Gemini.

```sh
npx vitest run src/services/__tests__/priceResearchPrecision.test.ts src/services/__tests__/assistenteGerencialDomain.test.ts src/services/__tests__/assistenteGerencial.test.ts src/lib/__tests__/assistenteGerencialSessions.test.ts src/lib/__tests__/priceResearch.test.ts --maxWorkers=2
npm run build
```

`scripts/test-price-research-db.mjs` executa a migration de precisão em PostgreSQL descartável PGlite com vector, pg_trgm e unaccent. Instale `@electric-sql/pglite@0.5.8` e `@electric-sql/pglite-pgvector@0.0.9` em um diretório separado e indique-o por `PRICE_SQL_RUNTIME`. Cobre lease, retomada da página 11, rollback, contagens, busca e invalidação de vetores. A migration de cron/Vault exige validação no Supabase de destino.

O build foi executado localmente. A suíte global registrou timeouts e não foi inteiramente validada. O typecheck geral registra erros fora dos módulos novos. O lockfile existente não permite `npm ci`; a instalação local de validação usou `npm install --ignore-scripts --legacy-peer-deps --no-package-lock`, sem alterar o lockfile. Não houve publicação no GitHub, aplicação de migrations remotas ou deploy de funções nesta entrega.
