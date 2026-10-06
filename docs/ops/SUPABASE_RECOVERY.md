# Diagnóstico e recuperação do Supabase

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
