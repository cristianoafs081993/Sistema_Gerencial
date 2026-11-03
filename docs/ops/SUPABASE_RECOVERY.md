# Diagnóstico e recuperação do Supabase

## Recorrência e recuperação em 19/10/2026

Às 10:22 BRT, as verificações diretas no projeto vinculado retornaram HTTP 504 em `/auth/v1/health` e `/auth/v1/user`, com corpo `Gateway Timeout` e sem `Access-Control-Allow-Origin`. Leituras mínimas de `/rest/v1/empenhos?select=id&limit=1` com origem SUAP e SIAGES excederam 15 segundos. O preflight `OPTIONS /auth/v1/user` respondeu HTTP 200, `Access-Control-Allow-Origin: *`, em 227 ms. A falha não depende de uma sessão de usuário: foi reproduzida com a chave pública da aplicação. Os erros CORS/`Failed to fetch` da captura são compatíveis com as respostas de gateway sem CORS durante a indisponibilidade, não demonstram necessidade de liberar origens ou desativar proteção do navegador.

A listagem autenticada `supabase projects list` mostrou `ACTIVE_HEALTHY`, mas `supabase inspect db role-stats --linked -o json` falhou na inicialização do login de inspeção com HTTP 544: `Connection terminated due to connection timeout`. Portanto, a saúde geral da listagem não confirma funcionamento do banco/Auth/REST. A evidência inicial não determina a causa de infraestrutura (conexões, CPU, memória, I/O ou bloqueios).

Nova leitura de `/auth/v1/health` sem cabeçalho `Origin` também excedeu 12 segundos. Após autorização explícita do usuário, a API oficial confirmou às 10:29 BRT os três serviços (`db`, `auth`, `rest`) como `UNHEALTHY`; SQL e verificação de modo somente leitura retornaram HTTP 544, e a métrica de ocupação de disco retornou HTTP 500. Uma única reinicialização autorizada foi solicitada às 10:30 BRT e aceita com HTTP 200. Às 10:35, Auth e consultas de empenhos responderam HTTP 200, em aproximadamente 1–2 s, com CORS correto para SIAGES e SUAP; às 10:36, `db`, `auth` e `rest` estavam individualmente `ACTIVE_HEALTHY`. Não houve alteração de CORS, código da aplicação, migrations, Edge Functions ou plano contratado.

Medições posteriores à recuperação (bytes agregados, sem ler conteúdo dos arquivos):

| Recurso | Medição |
| --- | --- |
| Arquivos do Storage | 1.984.375.265 bytes, 588 objetos, aproximadamente 1,98 GB decimais / 1,85 GiB |
| Bucket `suap-pdfs` | 1.980.069.951 bytes, 585 objetos |
| Demais buckets | 3.869.995 bytes em `manutencao-ocorrencias`; 435.319 em `price-research-evidence` |
| Banco bruto, `pg_database_size` | 1.356.778.643 bytes; inclui tabelas, índices e estruturas internas; não confundir com Storage de arquivos ou assumir equivalência com cada indicador de franquia do painel |
| Modo somente leitura | Desativado, sem override |
| Volume `/data` | Aproximadamente 6,67 GB disponíveis de 8,35 GB, cerca de 80% disponíveis |
| Memória disponível | Cerca de 55%, medida após reiniciar |

As maiores relações eram `preco_referencia_itens` (434,9 MB), `suap_plan_activity_snapshots` (190,1 MB) e `contratos_api_faturas` (112,3 MB), incluindo índices/TOAST. As estimativas de linhas em `pg_stat_user_tables` estavam zeradas após reiniciar e não significam tabelas vazias. Logs agregados das duas horas anteriores registraram 13 erros `42703` (coluna ausente) e três `57014` (timeout), sem comprovar a causa inicial da indisponibilidade. Memória/disco medidos depois da recuperação não descartam esgotamento anterior.

O usuário informou que apenas o indicador de Storage excedia o Free. A medição confirma arquivos acima da franquia de 1 GB, mas não comprova que isso causou os 504/544: depois da reinicialização os serviços funcionaram com os mesmos arquivos e sem modo somente leitura. Cotas de arquivos, tamanho do banco e ocupação do disco são métricas diferentes. Regularizar o excesso exige revisão de retenção com autorização antes de apagar PDFs ou mudança de plano solicitada pelo usuário; nenhuma limpeza ou contratação foi feita. Referências: [Storage e franquia](https://supabase.com/docs/guides/platform/manage-your-usage/storage-size), [banco e disco](https://supabase.com/docs/guides/platform/database-size).

## Falhas diferentes exigem correções diferentes

Em 06/10/2026, os logs do projeto vinculado registraram:

- HTTP 409 em `/rest/v1/processos`, seguido de SQLSTATE `23505` na restrição `processos_tenant_id_suap_id_key`: cadastro duplicado de processo no mesmo tenant. O inventário agora faz `ON CONFLICT DO NOTHING` e reutiliza o registro existente, sem regredir seu estágio de extração ou substituir PDF.
- SQLSTATE `42703`, `column contratos.objeto does not exist`: a paleta da extensão selecionava campos ausentes em contratos locais. A versão 1.9.58 seleciona apenas as colunas reais; os campos ricos continuam em `contratos_api`.
- HTTP 504 em consultas de atividades, empenhos, contratos, órgãos e autenticação, além de SQLSTATE `57014` por timeout. A API administrativa de consulta SQL também retornou timeout de conexão (544), e a verificação individual marcou `db`, `auth` e `rest` como `UNHEALTHY`. Isso caracteriza indisponibilidade dos serviços; os logs obtidos não determinam a causa inicial de infraestrutura.

## Recuperação verificada em 06/10/2026

Uma reinicialização foi aceita às 10:45 BRT. Na verificação às 10:51 BRT, `db`, `auth` e `rest` estavam saudáveis; chamadas reais de autenticação, atividades e execução de RDs retornaram HTTP 200 em menos de um segundo. O histórico remoto de migrations estava alinhado ao local, até `20261005120000`. A atividade oficial de energia elétrica e o empenho `2026NE000001` foram localizados no campus 158366/unidade 19.

A coleta mais recente de RDs permaneceu `partial`, com apenas 1 de 500 detalhes processados e a mensagem “RD alterada durante a captura; inicie nova conferência.”. Essa execução não foi aplicada nem promovida automaticamente. Após atualizar a extensão, iniciar uma nova conferência de RDs para recuperar esse fluxo.

Após a recuperação, a inspeção encontrou 12 conexões ociosas e uma ativa (a própria consulta), sem espera de bloqueio aparente. Métricas voltaram a responder, com cerca de 48% de memória disponível e 86% de espaço disponível no volume `/data`. São medidas posteriores à reinicialização; não comprovam a causa do incidente nem descartam um pico anterior. A recorrência da indisponibilidade ainda exige investigação de infraestrutura.

## Proteções de aplicação

As sete leituras centrais usam cache em memória por campus/unidade, sem retry automático ou refetch ao focar a janela. Leituras com timeout/conexão indisponível não repetem a mesma consulta em um fallback REST, e retornos vazios válidos não geram outra consulta. O fallback de compatibilidade preserva o JWT da sessão e limita o fetch a 15 segundos. A busca nativa de contratos é carregada ao abrir a paleta.

O Layout mostra aviso e tentativa manual. Falha da primeira leitura bloqueia os indicadores/tabelas centrais para não comunicar zero como resultado válido. Uma atualização com erro preserva os valores anteriores com aviso de possível desatualização. Importações e demais páginas de recuperação seguem acessíveis. Estas proteções reduzem consultas desnecessárias e evitam resultados enganosos; não garantem disponibilidade do provedor.

## Procedimento operacional

1. Verificar `db`, `auth` e `rest` individualmente na API de gerenciamento ou no painel. `ACTIVE_HEALTHY` na lista de projetos, isoladamente, não confirma que as leituras estão respondendo.
2. Consultar logs com intervalo explícito de até 24 horas e limite de resultados. Separar status 409 dos status 5xx e registrar SQLSTATE/horário/caminho. Evitar exportar headers, tokens e dados pessoais. A CLI instalada não consulta esses logs; usar a API de gerenciamento autenticada ou o painel de logs.
3. Quando o banco responde, inspecionar bloqueios, consultas demoradas, conexões, CPU/memória e disco. Usar `supabase inspect db blocking`, `long-running-queries`, `outliers` e métricas do projeto. Resolver a consulta/índice ou o excesso de concorrência identificado; não aumentar timeout, capacidade ou custo sem diagnóstico.
4. Quando todas as verificações de serviço falham e até a inspeção SQL não conecta, preservar evidências e considerar uma reinicialização do projeto. Ela interrompe conexões/trabalhos em andamento e é medida de recuperação, não correção da causa inicial. Não repetir reinicializações como rotina de retry.
5. Após recuperação, validar os três serviços, uma leitura de atividades e empenhos, o histórico de migrations e as filas/execuções interrompidas antes de retomar coletas. RDs parciais devem ser retomadas e conferidas antes da aplicação; não promover dados incompletos.
6. Para prevenção de infraestrutura, acompanhar latência, proporção de 5xx, CPU/memória, ocupação de disco e conexões durante sincronizações. Dimensionamento e alertas devem ser definidos a partir dessas medidas. Investigar recorrência mesmo quando uma reinicialização resolve o sintoma.

Documentação do provedor: [consulta de logs](https://supabase.com/docs/guides/observability/advanced-log-filtering), [estado dos serviços](https://supabase.com/docs/reference/api/v1-get-services-health) e [reinicialização](https://supabase.com/docs/reference/api/v1-restart-a-project).
