# Sincronização de documentos e instrumentos de cobrança de contratos

## Comportamento

A tela lê os registros persistidos e solicita `sync-contratos-pncp-documentos` quando
a checagem de documentos ou instrumentos estiver vencida (24 horas) ou quando o
usuário clicar em Atualizar. O navegador envia apenas `contratoApiId`; resolução,
consulta ao PNCP e gravação são executadas no servidor. A função exige JWT de
usuário validado ou a service role usada pelo agendamento. Não há escrita direta
do navegador nas tabelas protegidas por RLS.

A resolução compartilhada lê todas as páginas em duas janelas semestrais do ano
original do contrato, sem usar a vigência renovada. Prioriza o identificador oficial
`-2-` já salvo; rejeita identificadores de licitação `-1-`. Sem identificador, confere
número, ano, unidade e processo quando informado, recusando vínculos ambíguos.
Não presume que número do contrato seja o sequencial PNCP.

O cron processa até cinco contratos a cada cinco minutos, de todas as unidades
já importadas em `contratos_api`, ordenados pela tentativa mais antiga. Uma
requisição tem orçamento de 100 segundos; contratos não iniciados ficam para o
próximo lote. Falhas podem ser repetidas após 30 minutos. Checagens bem-sucedidas
são renovadas após 24 horas. A seleção considera documentos E instrumentos.

`pncp_sync_attempted_at` acompanha tentativas sem confundir falha com conclusão.
`pncp_sync_error` registra a última falha. `pncp_documentos_checked_at` e
`pncp_instrumentos_checked_at` avançam independentemente, somente após leitura
e persistência bem-sucedidas. HTTP 404/429/5xx, timeout, JSON inválido e erro de
banco não são interpretados como ausência de publicação. O cache de descoberta
é limitado à execução e recebe apenas resultados completos.

Documentos previamente gravados não são apagados automaticamente; a contagem e
a resposta refletem os registros persistidos. Uma falha em PDFs não impede a
tentativa de consultar instrumentos. A interface mantém os dados anteriores,
mostra a falha e ignora respostas atrasadas após mudança de contrato. As faturas
do Comprasnet continuam sendo uma fonte separada; não são convertidas em NF-e
SEFAZ nem usadas para afirmar publicação no PNCP.

## Ativação

1. Autenticar a CLI (`supabase login`) e vincular o projeto correto:
   `supabase link --project-ref mnqhwyrzhgykjlyyqodd`.
2. Executar `supabase migration list` e conferir as migrations pendentes. Aplicar
   `20260905173000_repair_pncp_contract_sync.sql` com o fluxo normal de migrations
   (`supabase db push` após conferir a lista). Ela adiciona os campos, invalida
   checagens legadas para reprocessamento e substitui o cron. Não apaga documentos.
3. No Supabase Vault, cadastrar a chave JWT service_role do mesmo projeto como
   `pncp_sync_service_role_key`. Uma entrada existente `service_role_key` também
   é aceita. Não colocar a chave no frontend, no SQL versionado nem na descrição
   do cron. Se faltar a chave, o cron falha explicitamente; não executa anonimamente.
4. Executar `supabase functions deploy sync-contratos-pncp-documentos`.
   Manter `verify_jwt = true`. O handler também valida o usuário; JWT anon não
   autoriza gravação. Reexecutar `supabase migration list` para conferir alinhamento.
5. Publicar o frontend somente depois da migration e da função. A versão nova
   consulta as novas colunas e depende da nova resposta do servidor.
6. Executar `select public.enqueue_pncp_contract_sync();` no SQL Editor para
   antecipar o primeiro lote, ou aguardar o cron. Abrir o contrato 00129/2024 e
   clicar em Atualizar para uma checagem dirigida. Conferir também contratos de
   outras unidades e reabrir a tela para validar persistência.

## Verificação operacional

- `cron.job_run_details` mostra falhas do agendamento, incluindo Vault ausente.
- `net._http_response` mostra o status HTTP da chamada; o sucesso do enqueue
  sozinho não comprova que a sincronização HTTP foi concluída.
- Conferir os logs de `sync-contratos-pncp-documentos`, `pncp_sync_error` e as
  datas de checagem por contrato. HTTP 200 pode conter `status: partial_error` e
  erros por recurso; ler `resultados`.
- O cabeçalho global de sincronização do Comprasnet é outro job; não comprova
  execução desta rotina PNCP.

## Regressões automatizadas

`pncpSync.test.ts` cobre página 2, janelas semestrais, renovação, controle oficial,
vínculos incompatíveis, repetição de páginas, erro HTTP, falha de upsert,
preservação dos marcos de sucesso, sucesso parcial e decimais JSON/brasileiros.
`ContratoApiDetailsSheet.test.tsx` cobre dados persistidos, atualização manual com
erro, expiração de resultado negativo, notas sem PDFs e respostas atrasadas.
`pncpContratos.test.ts` e `pncpInstrumentosCobranca.test.ts` protegem os serviços
públicos de leitura. Os testes usam fixtures; não comprovam disponibilidade de
notas/documentos de um contrato real no PNCP.

## Validação desta correção (05/09/2026)

- 34 testes focados passaram, em cinco suites: pncpSync, pncpContratos,
  pncpInstrumentosCobranca, ContratoApiDetailsSheet e ContratoNfeRastreabilidade.
- Build de produção concluído; lint focado sem erros (duas advertências de tipos
  dinâmicos na fronteira JSON da API).
- A suite geral foi tentada, mas bloqueada pela revisão automática porque testes
  fora do escopo tentam acessar Supabase sem garantir o payload transmitido.
  Não foi repetida com acesso à rede. Portanto, não há aprovação da suite completa.
- TypeScript global apontou erros em outras áreas do projeto; nenhum diagnóstico
  nos arquivos de produção alterados da sincronização PNCP.
- Deploy da função foi tentado, mas a CLI informou ausência de SUPABASE_ACCESS_TOKEN.
  Não foi possível validar/aplicar migrations no projeto remoto nesta sessão.
  A migration, o Vault, o deploy da função e a validação real permanecem pendentes.
