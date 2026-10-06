# Integração determinística de atividades, RDs e empenhos do SUAP

Data da investigação: 05/10/2026. Escopo inicial: DG/CN, unidade SUAP `19`, UASG `158366`.

**Estado: implementação entregue no código, migration aplicada no Supabase remoto e function `sync-suap-rds` publicada inicialmente em 05/10/2026.** Em 06/10/2026, a coleta passou à extensão Suape 1.9.55, usando a aba autenticada, individualmente ou nas 44 unidades; dispensa conexão SUAP no backend. A primeira coleta real ainda exige as sessões SUAP/SIAGES e conferência antes da aplicação. O frontend requer publicação. O contrato implementado e suas limitações estão em [SUAP_RD_SYNC](../ops/SUAP_RD_SYNC.md); as seções abaixo preservam a investigação e o desenho original, com nomes de tabelas propostos que foram ajustados na implementação.

## 1. Decisão principal

Usar a cadeia oficial **atividade do plano → requisição de despesa → linha de despesa → nota de empenho** para resolver o vínculo. O nome da atividade, o PI e o processo passam a servir como conferência, sem determinar o vínculo por pontuação.

O detalhe da RD consultado mostra a atividade como texto, sem link ou ID. Contudo, o Plano 8 fornece links `/plan_estrategico/listar_requisicoes_despesa/8/<atividade_id>/`. Essas páginas identificam a atividade pelo ID da URL e enumeram as respectivas RDs com links para `/plan_estrategico/detalhar_requisicaodespesa/<rd_id>/`. Essa segunda fonte elimina a necessidade de adivinhar a atividade pelo nome.

Manter responsabilidades distintas:

| Informação | Fonte e responsabilidade |
| --- | --- |
| Identidade da atividade e vínculo com RD/NE | Relações oficiais do SUAP, com URLs e IDs de origem |
| Planejamento e saldo disponível da atividade | Snapshot do plano SUAP já sincronizado |
| Valores contábeis, liquidação, pagamento e RAP da NE | Dados SIAFI já usados pelo SIAGES |
| Histórico gerencial de dotação, reforço e anulação | Linhas confirmadas das RDs, sem sobrescrever os valores SIAFI |
| Vínculos manuais existentes | Preservados, com divergências encaminhadas à revisão |

## 2. Evidências verificadas no SUAP

Na [listagem informada](https://suap.ifrn.edu.br/admin/plan_estrategico/requisicaodespesa/?unidade_gestora=19&tab=tab_concluidas), havia 433 RDs concluídas em 22 páginas, com 20 registros na primeira e 13 na última. O filtro de ano do plano estava em `Todos`; há RDs de 2025 e 2026. Esses números são uma observação dessa data, não limites fixos do coletor. A interface também mostrava 64 canceladas e pendências em emissão/validação.

| Atividade / ID oficial no Plano 8 | RD consultada | NE resumida | Movimento confirmado |
| --- | --- | --- | --- |
| Contratação empresa de apoio a eventos / `33155` | `2026RD003681`, ID `9033` | `2026NE000098` | Dotação: R$ 36.953,00 |
| Contratação do serviço de almoxarifado virtual / `32635` | `2026RD003731`, ID `9083` | `2026NE000014` | Reforço: R$ 20.242,46; RO `2026RO000338` |
| Realizar e participar de jogos estudantis / `35424` | `2026RD003616`, ID `8968` | `2026NE000040` | Anulação: R$ -1.859,51; RO `2026RO000330` |

Fontes oficiais consultadas: [atividade 33155](https://suap.ifrn.edu.br/plan_estrategico/listar_requisicoes_despesa/8/33155/), [RD 9033](https://suap.ifrn.edu.br/plan_estrategico/detalhar_requisicaodespesa/9033/), [atividade 32635](https://suap.ifrn.edu.br/plan_estrategico/listar_requisicoes_despesa/8/32635/), [RD 9083](https://suap.ifrn.edu.br/plan_estrategico/detalhar_requisicaodespesa/9083/), [atividade 35424](https://suap.ifrn.edu.br/plan_estrategico/listar_requisicoes_despesa/8/35424/), [RD 8968](https://suap.ifrn.edu.br/plan_estrategico/detalhar_requisicaodespesa/8968/).

Constatações que afetam o desenho:

- O detalhe informa macroprocesso, origem SUAP completa, PI, atividade, unidade, processo administrativo, finalidade, autorização e CDO quando presente. A tabela de despesa informa ND, valor, NE, situação e, em reforços/anulações observados, RO.
- A NE é apresentada no formato completo, por exemplo `158366264352026NE000098`. Guardar também UG `158366`, gestão `26435`, ano `2026` e NE resumida; não descartar o prefixo na evidência.
- No reforço `2026RD003731`, o valor inicial é R$ 20.289,05 e o valor confirmado é R$ 20.242,46. A soma deve usar as linhas confirmadas, sem substituir esse valor pelo pedido inicial ou pelo texto do despacho.
- A atividade `33155` lista quatro dotações concluídas e uma cancelada. As concluídas somam R$ 100.519,00, igual ao consumo observado na linha do plano; a cancelada de R$ 36.953,00 não entra nessa soma.
- A atividade `32635` lista dotação de R$ 29.988,83 e reforços de R$ 4.998,14 e R$ 20.242,46 da mesma NE, totalizando R$ 55.229,43. Lista também reforço cancelado que já menciona a mesma NE. A presença do número em uma RD cancelada não autoriza contar esse movimento nem cancelar a NE.
- A atividade `35424` lista R$ 15.000,00 + R$ 10.794,60 - R$ 1.859,51 = R$ 23.935,09, com a mesma NE e saldo do plano igual a zero. Atividades sem saldo devem ser coletadas para não perder execução já realizada.
- A RD histórica [2025RD000032 / ID 52](https://suap.ifrn.edu.br/plan_estrategico/detalhar_requisicaodespesa/52/) informa PAFE e NE `158366264352025NE000008`, confirmada em R$ 7.200,00. Sua ligação ao ID de uma atividade do plano histórico ainda não foi verificada.
- Breadcrumbs preservam páginas visitadas anteriormente: apareceram referências ao plano de 2026 mesmo no detalhe de RD de 2025. Não usar breadcrumbs para determinar o plano/ano da RD.

Não foi feita coleta integral das 433 RDs, consulta da base remota SIAGES, nem comprovação de uma API oficial de RDs. Casos de múltiplas NEs por RD e de uma NE repartida entre atividades precisam de amostras reais no piloto.

## 3. Situação do SIAGES e pontos de integração

- `src/services/suapPlanParser.ts` já extrai `suapActivityId` do link de requisições por atividade. Captura linhas ocultas e valores oficiais do Plano 8.
- `supabase/functions/sync-suap-plan/index.ts` já fornece sessão SUAP cifrada, prévia, snapshots, aplicação e lotes retomáveis. A conexão dura até oito horas no contrato atual.
- A migration `20260909120000_add_suap_plan_unit_scope.sql` estabelece identidade de atividade por `(org_id, suap_plan_id, suap_unit_code, suap_activity_id)`. UASG-pai não substitui a unidade SUAP: `19`, `36`, `25` e `29` compartilham `158366`.
- `src/services/atividades.ts` filtra unidade e arquivamento, mas seu select e mapper não expõem `suap_plan_id` e `suap_activity_id`. `src/types/index.ts` também precisa receber esses identificadores e o escopo necessário ao consumidor.
- `src/utils/atividadeEmpenhoMatching.ts` usa `atividadeId` manual, processo, PI, siglas e expressões. Cada NE é atribuída à maior pontuação acima do limiar; empates acabam dependendo da ordem das atividades.
- `src/components/dashboard/DashboardOrigemAtividadesModal.tsx` é o consumidor identificado dessa associação. Usa saldo oficial SUAP quando disponível e calcula o consumo como `valorTotal - saldoDisponivel`; a lista de NEs é atualmente inferida.
- `src/services/empenhos.ts` lê `atividade_id` e filtra UASG. O campo único não representa uma NE distribuída entre várias atividades nem explica a proveniência do vínculo.
- `src/components/modals/EmpenhoDialog.tsx` tem uma seção legada `Histórico de Operações`, renderizada apenas se `historicoOperacoes` estiver preenchido; no modo página, fica em `Itens e histórico`. Essa seção não consulta RDs nem fornece RD/RO como evidência. A integração precisa alimentar um histórico consultável e apresentar explicitamente sua ausência, em vez de depender desse array opcional.
- `supabase/functions/_shared/suap_proxy_paths.ts` não permite as rotas de RD e de requisições por atividade. A sincronização do plano também restringe sua captura HTML à página canônica do Plano 8. Não basta apontar o mecanismo atual para a nova URL.
- A migration legada `0008_create_documentos_habeis.sql` declara unicidade global de `empenhos.numero`. Conferir a constraint efetiva e possíveis colisões entre UGs no remoto antes de mudar chaves; não ampliar esse refactor sem necessidade demonstrada.

Documentação operacional consultada: [entrada](../ai/START_HERE.md), [guia](../REPOSITORY_GUIDE.md), [índice](../README.md), [testes](../TESTING.md), [schema](../database/SCHEMA_OVERVIEW.md), [tabelas](../database/TABLE_CATALOG.md), [linhagem](../database/DATA_LINEAGE.md), [APIs](../integrations/API_CATALOG.md), [functions](../ops/SUPABASE_FUNCTIONS.md), [ambiente](../ops/ENVIRONMENT.md), [fluxo frontend](../frontend/DATA_FLOW.md), [importações](../data-import/README.md), [matriz](../data-import/PIPELINE_MATRIX.md) e guias do design system.

## 4. Coleta e identidade sem inferência

1. Inventariar todas as páginas da listagem da unidade `19`, preservando IDs, número, tipo, situação, links, contagem e filtros. Seguir links de paginação observados; não assumir paginação Django baseada em zero. Validar repetição de páginas, IDs duplicados e cobertura.
2. Capturar o Plano 8 inteiro da unidade, incluindo linhas ocultas, arquivadas no espelho e com saldo zero. Enumerar os links oficiais de requisições por atividade, com `plan_id` e `activity_id` obtidos do caminho.
3. Para cada atividade, ler sua lista de RDs e materializar a relação explícita `plan_id + activity_id + rd_id`. Validar a unidade nos dados gerais da página. Tratar paginação se existir; não supor que as três amostras representam todas as variantes.
4. Deduplicar RDs entre o inventário e as listas por atividade e consultar cada detalhe necessário uma vez. Extrair somente a seção correta, pelos rótulos/cabeçalhos, preservando todas as linhas da tabela e os estados confirmados/pendentes.
5. Associar a atividade SIAGES pela chave oficial composta e a NE pelo identificador normalizado com UG/gestão/ano/escopo. O texto do detalhe deve ser coerente com a atividade de origem; divergência é pendência, não nova associação por score.
6. Inventariar também canceladas e estados pendentes para acompanhar transições. Somente RD concluída com linha confirmada pode fornecer movimento ativo nesta primeira versão. Estados desconhecidos bloqueiam o registro.
7. Toda RD do inventário deve terminar classificada: resolvida por ID oficial, fora do plano inicial/histórica, sem NE, NE ausente no SIAGES, atividade ausente, situação não elegível, erro de captura ou conflito. Nenhuma omissão silenciosa.

Para 2025, preservar a RD e sua NE como dado histórico, sem ligar pelo nome a uma atividade de 2026. Descobrir e validar o plano histórico e suas relações antes de habilitar vínculo e indicadores de RAP. O ano da RD, o ano de emissão da NE e o ano do plano são dimensões separadas; filtros por data de cadastro não substituem essas dimensões. Até existir identidade histórica verificada, mostrar a pendência e não incluí-la como confirmação no planejamento de 2026.

Se uma RD trouxer várias NEs, persistir cada linha. Se a mesma NE aparecer em RDs de atividades distintas, preservar as relações oficiais, verificar o histórico completo e o rateio antes de calcular valores por atividade. Não escolher a primeira atividade.

## 5. Modelo persistente proposto

Nomes a confirmar na implementação:

| Entidade | Conteúdo e invariantes |
| --- | --- |
| `suap_rd_sync_runs` | Usuário, órgão, UASG, unidade, planos/anos solicitados, cursor, contagens, erros, completude, hashes, versões do parser, datas e estados de coleta/prévia/aplicação |
| `suap_requisicoes_despesa` | Identidade `(org_id, suap_rd_id)` no host IFRN fixo; número, unidade, plano quando comprovado, tipo, situação, processo, valores pedido/atual, finalidade e referências CDO; classificação e última observação |
| `suap_rd_activity_sources` | Evidência da associação oficial RD/atividade, com chave composta do plano/unidade, URL da lista por atividade, hash e run; permite múltiplas relações detectadas e sua revisão |
| `suap_rd_despesa_linhas` | RD, identidade de linha, ND, NE completa e componentes, RO quando houver, valor assinado, situação e vínculo opcional ao `empenho_id` local |
| `atividade_empenho_vinculos` | Projeção derivada por órgão/unidade/plano/atividade/NE, valor líquido dos movimentos elegíveis, método, situação de conciliação e fontes; várias RDs podem sustentar um único vínculo |
| Snapshots de auditoria | Versões dos campos estruturados e das evidências necessárias, referidas por run, com estados anteriores preservados |

Vincular RDs/linhas às atividades e empenhos sem apagar registros ausentes. Guardar referência externa mesmo se a FK local ainda estiver nula; nova importação SIAFI ou sincronização de atividades deve permitir resolver a pendência sem recapturar tudo.

Usar IDs nativos das linhas se existirem. Caso não existam, versionar o conjunto de linhas de cada RD e substituir transacionalmente a versão ativa; não usar número de linha/ordem visual como identidade permanente. Repetições legítimas com ND/NE/valor iguais devem conservar multiplicidade. A contagem em duas fontes não cria dois movimentos da mesma RD.

Guardar hashes, URLs e extratos mínimos para comprovação. Se HTML for necessário para diagnóstico, sanitizar scripts, tokens CSRF e dados pessoais irrelevantes, usar armazenamento privado e retenção definida. Cookies, senhas e tokens não entram em snapshots, logs ou respostas.

Todas as tabelas novas exigem RLS por órgão e campus, com escopo de unidade/plano nas queries. FKs e a RPC devem impedir referências entre órgãos e campi diferentes, mesmo com service role. O servidor deriva órgão do JWT e valida o escopo; não confia em `org_id` enviado pelo cliente.

## 6. Regras de conciliação e valores

- Validar NE completa com estrutura `UG(6) + gestão(5) + ano(4) + NE + sequência(6)` para o formato observado. Preservar o original. Usar formato resumido apenas quando a UG/gestão já estiver comprovada e houver uma única correspondência local no escopo. Ausência ou duplicidade gera pendência.
- Valor ausente/inválido é erro, nunca zero automático. Converter moeda em centavos ou numeric decimal; preservar zero e sinal. Anulação já negativa não pode receber uma segunda inversão de sinal. Tipos e sinais incompatíveis exigem revisão.
- `valor_liquido_rd = soma(dotação + reforços + anulações confirmadas)`, deduplicando a evidência por linha/versão. `valor_inicial`, valor atual do pedido e total da tabela são conferências separadas.
- Comparar total das linhas com o total confirmado da RD. Divergência não deve ser corrigida escolhendo arbitrariamente um dos valores.
- No caso de uma atividade por NE, exibir a NE uma vez, com valor contábil SIAFI e histórico de RDs acessível. Reforços/anulações não criam novas NEs.
- No caso de várias atividades por NE, o vínculo oficial pode ser N:N, mas não somar o valor integral da NE em cada atividade. Mostrar a parcela gerencial comprovada por RDs e o valor total SIAFI uma vez no agregado da origem. Rateio contábil só fica conciliado quando os movimentos completos das parcelas fecharem com o SIAFI dentro de R$ 0,01; saldo residual deve aparecer como não conciliado, sem rateio proporcional inventado.
- Preservar `atividades.saldo_disponivel` e os campos oficiais de `empenhos`. Não recalcular liquidação, pagamento, saldo RAP nem data de emissão usando data de cadastro/autorização/conclusão da RD.
- Confrontar separadamente consumo do plano, movimentos líquidos de RDs e valor SIAFI, com datas de atualização. Diferenças temporais, reservas e incompletude exigem investigação; não impor igualdade contábil sem comprovar o significado e a cobertura das fontes.
- RD cancelada não produz movimento ativo. Uma anulação concluída é movimento negativo e conserva o histórico do vínculo, inclusive com saldo líquido zero. Cancelamento da RD não implica status `cancelado` da NE no SIAGES.
- Preservar `empenhos.atividade_id` como vínculo manual legado. Se conflitar com SUAP, mostrar ambas as evidências e exigir resolução registrada; não sobrescrever silenciosamente. Quando concordarem, deduplicar.
- Relação oficial pendente, fora do plano/unidade ativo ou conflitante não cai automaticamente no matcher textual. O score permanece somente como sugestão separada para NEs sem evidência oficial; sugestões não entram em indicadores confirmados.
- PI, origem, ND e processo são conferências. Não ocultar vínculo oficial porque o filtro atual por origem descartou previamente a atividade; detectar divergências antes de montar a visualização e listar a pendência.

## 7. Sincronização, segurança e aplicação

Preferir um worker autenticado separado, proposto como `sync-suap-rds`, com helpers internos compartilhados de conexão/autorização da sincronização do plano. O fluxo inicial pode reaproveitar a conexão SUAP existente, inclusive a conexão fornecida pela extensão. Não depender de OAuth para ler HTML administrativo sem validação específica desse acesso.

Coleta no servidor com sessão cifrada evita exigir dezenas de cliques no navegador. Como alternativa para sessão local, a extensão pode capturar páginas sob a sessão SUAP e enviar dados para validação/parsing no backend. Em ambos os caminhos, o backend valida escopo, estrutura, tamanho, IDs e evidência; a URL declarada pelo cliente sozinha não autentica o conteúdo capturado.

Permitir apenas origem SUAP fixa, GETs de leitura, IDs numéricos, unidades autorizadas e filtros necessários nas rotas do plano, listagem de RDs, lista por atividade e detalhe. Não liberar `/admin/*` ou `/plan_estrategico/*` de forma genérica. Validar redirects e destino final; recusar páginas de login, permissão negada ou mudança de estrutura. Se o proxy existente for alterado, acrescentar testes e publicar também `suap-proxy`.

Processar lotes pequenos retomáveis, inicialmente com até duas leituras simultâneas e orçamento de tempo por chamada; ajustar com medição. Persistir cursor por página/atividade/RD, timeout por leitura, retry limitado com backoff e lock por órgão/unidade/plano. Falha de rede é retomável; sessão expirada pausa com orientação de reconexão, sem marcar a captura como completa.

Não usar apenas data de criação ou o maior ID da RD como cursor incremental: reforços, correções e cancelamentos alteram registros existentes. Reconsultar pendentes, recentes e periodicamente o inventário completo, com hashes para detectar alterações. Conferir inventário no início e no fim e recapturar discrepâncias para evitar perda por movimentação entre páginas durante a coleta.

Estados propostos: `collecting`, `partial`, `ready_for_preview`, `applied`, `failed`, `awaiting_auth`. Snapshot incompleto não revoga vínculos anteriores. A aplicação deve validar propriedade/permissão, completude do escopo, versão da prévia e hash, e atualizar apenas a projeção daquele escopo em uma transação. Prévia de 2026 não pode revogar histórico de 2025.

A prévia deve comparar associação atual e oficial, mostrando inclusões, confirmações, divergências, possíveis rateios e pendências. A primeira aplicação segue o padrão já existente de prévia/aplicação explícita. Reversão restaura a projeção anterior por run, preservando a auditoria e sem reverter os valores SIAFI.

Uma rotina autônoma só deve ser prometida depois de validar renovação/validade da sessão: a conexão atual tem TTL de oito horas. No piloto, iniciar manualmente e retomar pela extensão/conexão; não criar cron que pressuponha autenticação permanente.

## 8. Consumo no frontend

- Criar service de leitura dos vínculos oficiais e incluir órgão/campus/unidade/plano nas chaves de cache. Manter contrato equivalente na leitura principal e no fallback REST.
- Expor IDs estáveis e escopo nas atividades. Incluir a nova query no fluxo de atualização de `useDataQueries`/`DataContext`; após aplicação, importação SIAFI ou mudança de campus, invalidar os dados relacionados.
- Adaptar o modal por origem para usar vínculos oficiais antes das sugestões. Exibir fonte `SUAP/RD`, NEs distintas, parcela quando houver, RDs/ROs, data da coleta e acesso às URLs oficiais.
- Mostrar `Confirmado pelo SUAP`, `Manual`, `Sugerido` e `Pendente de conciliação` como estados distintos. Empenho com evidência oficial cuja atividade não está visível deve aparecer como fora do filtro/escopo ou pendente, sem ganhar outra atividade por inferência.
- Manter saldo oficial do plano e destacar divergência entre consumo SUAP, movimentos RD e SIAFI quando houver. Carregamento/erro da nova fonte não pode aparecer como zero confirmado nem promover sugestões a vínculos oficiais.
- Expor controle de sincronização/prévia na área administrativa de importações, aproveitando `ImportacaoDados.tsx` e o padrão de `SuapPlanSyncCard.tsx`. Evitar uma nova página operacional antes de confirmar necessidade.
- Respeitar componentes e tokens existentes: `PageHeader compact` nas telas orçamentárias, `DataTablePanel`, `Badge`, `LoadingState` e estados acessíveis. Manter ações de escrita restritas ao perfil administrativo validado também no backend.

### Movimentações de reforço e anulação na interface do empenho

Requisito acrescentado pelo usuário: mostrar os reforços e as anulações de cada empenho. Essa entrega faz parte da etapa 4 e dos critérios de aceitação da integração.

No `EmpenhoDialog.tsx`, disponibilizar uma seção/aba claramente intitulada **Movimentações**, acessível na página de detalhe e no modal aberto pelo Dashboard ou pela lista de empenhos. Carregar as linhas de RDs da NE por service dedicado, com escopo e cache; a ausência do array legado não pode esconder a seção. Na lista de empenhos, oferecer indicação discreta da quantidade de reforços/anulações que leve a esse detalhe, sem multiplicar as linhas da NE.

Apresentação prevista:

| Coluna | Conteúdo |
| --- | --- |
| Data | Data oficial do movimento se comprovada; caso contrário, data de conclusão no SUAP identificada como tal ou `Não informada` |
| Movimento | Dotação inicial, Reforço ou Anulação |
| Valor | Valor confirmado com sinal: positivo para dotação/reforço, negativo para anulação |
| RD | Número da requisição com link oficial |
| RO | Número resumido e completo consultável quando disponível; `—` nas dotações sem RO |
| Atividade | Atividade oficialmente vinculada àquela RD, útil para NEs com mais de uma atividade |
| Situação / fonte | Confirmada, pendente ou cancelada; origem SUAP e data da sincronização |

Resumo da seção: dotação inicial total, total de reforços, total de anulações e valor líquido dos movimentos confirmados, com comparação ao valor SIAFI e indicação de histórico parcial/divergência. Movimentos pendentes/cancelados podem ser consultados separadamente e não entram nos totais. A data de autorização/cadastro da RD não representa data de emissão do reforço/anulação no SIAFI.

Exemplo confirmado para `2026NE000040`:

| Movimento | RD | RO | Valor |
| --- | --- | --- | ---: |
| Dotação inicial | `2026RD001544` | — | R$ 15.000,00 |
| Reforço | `2026RD002879` | `2026RO000255` | R$ 10.794,60 |
| Anulação | `2026RD003616` | `2026RO000330` | R$ -1.859,51 |
| **Líquido confirmado das RDs** | | | **R$ 23.935,09** |

Esse exemplo veio da página oficial da atividade; ainda não foi comparado ao valor remoto SIAFI da NE. A interface deve indicar essa distinção, sem declarar conciliação contábil só pelo exemplo.

Quando houver histórico de operações já importado do Portal/SIAFI, reconciliar por documento de movimento e identidade comprovada. Não juntar duas operações apenas porque tipo, data e valor coincidem. Evitar repetir um mesmo evento vindo das duas fontes; se a identidade não puder ser comprovada, apresentar fontes separadas sem soma conjunta. Preservar sinais já negativos para evitar `--R$` na renderização.

Estados obrigatórios: carregando, erro com nova tentativa, histórico não sincronizado, histórico parcial e nenhuma movimentação encontrada numa consulta completa. Nunca escrever `Sem reforços/anulações` só porque a fonte ainda não foi sincronizada. Validar navegação por teclado, leitura no celular e rótulos acessíveis dos links.

## 9. Execução em etapas e critérios de saída

| Etapa | Entrega | Condição para avançar |
| --- | --- | --- |
| 1. Piloto de leitura | Fixtures sanitizadas, inventário da unidade e relações oficiais para as três atividades verificadas; buscar exemplos de múltiplas NEs e múltiplas atividades | IDs, tabelas, sinais, estados e cobertura comprovados; lacunas registradas |
| 2. Persistência e coletor | Migrations, RLS, worker e snapshots com retomada; prévia de 2026 no escopo `19/158366` | Histórico remoto validado, função publicada, testes de isolamento/idempotência e inventário fechado |
| 3. Conciliação em paralelo | Comparação do matcher atual com vínculos oficiais, sem troca dos indicadores | Todos os registros classificados; diferenças manuais, de chave e de valor explicadas; rateios sem duplicação |
| 4. Aplicação e frontend | Aplicar prévia conferida, priorizar relações oficiais e mostrar dotação/reforços/anulações por NE | Histórico com RD/RO e valores assinados acessível no modal e na página, mesmas fontes e escopo na UI, totais sem duplicação e reversão validada |
| 5. Histórico e manutenção | Plano histórico de 2025, RAP, cancelamentos e reconsultas periódicas | Identidades históricas oficiais comprovadas; política de atualização executável com a autenticação disponível |

O lote não precisa ter 100% das NEs já existentes no SIAFI para preservar as RDs. Precisa classificar 100% do inventário solicitado e não apresentar pendências como vínculos confirmados. A soma das categorias deve fechar com o inventário da execução; RDs de outros planos devem ficar explicitamente fora da cobertura inicial.

Na implementação, aplicar as migrations novas no ambiente remoto vinculado e conferir `supabase migration list`. Publicar a função nova e todas as funções alteradas com `supabase functions deploy <nome>`. Essas operações pertencem à implementação, não foram realizadas nesta etapa de planejamento.

## 10. Testes de regressão previstos

- Parsers: listagem paginada, headers por rótulo, detalhe de dotação/reforço/anulação, RO opcional, CDO ausente, várias linhas/NEs, moeda negativa/zero/inválida, total divergente e login/403/HTML inesperado. Fixtures retiradas das seções úteis, sem sessão ou cadastro pessoal.
- Relações: ID obtido na lista oficial por atividade, nome igual com IDs distintos, renomeação, breadcrumbs históricos irrelevantes, RD em mais de uma lista e mesmo ID em unidades/órgãos diferentes.
- Conciliação: NE longa/resumida, UG/gestão ambígua, importação SIAFI tardia, conflito manual, confirmação que contradiz o score, empate textual, origem divergente, anulação integral e cancelada com número de NE.
- Valores: os três exemplos reais acima; repetir RD ou coletar pela listagem e pela atividade não duplica valor nem NE; uma NE em duas atividades não replica seu total; resíduo SIAFI fica pendente; reforço usa R$ 20.242,46, não R$ 20.289,05.
- Integração: prévia sem projeção ativa alterada, aplicação transacional, repetição idempotente, retomada, falha no meio, sessão expirada, alterações entre páginas, snapshot parcial sem revogação, reversão e reimportação SIAFI preservando vínculo manual/oficial.
- Autorização: escrita sem perfil administrativo, leitura/escrita cruzada entre órgãos/campi/unidades, referências locais fora do escopo, URLs/redirects externos e parâmetros extras recusados; nenhum token nas respostas/logs.
- Frontend: confirmação e sugestões separadas, ausência de vínculo oficial não tratada como erro de saldo, carregamento com cache anterior, filtro de saldo zero, NEs sem atividade visível, troca de campus/plano, fallback REST e refresh após aplicação.
- Histórico de movimentações: seção visível sem `historicoOperacoes` legado, dotação/reforço/anulação com RD e RO corretos, valores negativos sem sinal duplicado, exclusão de canceladas/pendentes dos totais, datas com fonte correta, conciliação entre fontes sem duplicação e estados de vazio/incompleto/erro; cobertura do modal e do modo página de `EmpenhoDialog`.
- Executar as suites existentes de matching, parser/sync do plano, services de atividades, modal do dashboard e importação SIAFI, além das novas suites; `npm run check` na implementação. Integrações remotas seguem `docs/TESTING.md` e ficam fora da suite unitária.

## 11. Documentação e limites desta entrega

Este plano foi acrescentado ao índice em `docs/README.md`. A documentação operacional do comportamento atual continua válida; a implantação futura deve atualizar `API_CATALOG.md`, `SUPABASE_FUNCTIONS.md`, `ENVIRONMENT.md`, `SCHEMA_OVERVIEW.md`, `TABLE_CATALOG.md`, `DATA_LINEAGE.md`, `DATA_FLOW.md` e `TESTING.md` conforme o contrato efetivamente entregue.

Verificação da base atual nesta investigação: 25 testes aprovados em quatro suites (`atividadeEmpenhoMatching`, `suapPlanParser`, `atividades` e `DashboardOrigemAtividadesModal`). Essa validação confirma os contratos existentes examinados, não a integração proposta, que ainda exige as novas regressões acima.

A consulta confirmou a viabilidade determinística para as atividades verificadas do Plano 8. Ainda não mediu a cobertura total dos vínculos no SIAGES remoto, a associação ao plano histórico nem a frequência de rateios/múltiplas NEs. Esses pontos são trabalho de piloto com saída mensurável, não premissas para preenchimento automático por inferência.
