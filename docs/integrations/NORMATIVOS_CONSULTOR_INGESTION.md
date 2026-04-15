# NORMATIVOS CONSULTOR INGESTION

## Objetivo

Documentar o fluxo que alimenta a base semantica usada pelo Consultor juridico e manter um backlog rastreavel do que ja foi ingerido.

Este fluxo fica fora da matriz de CSVs do sistema principal. Ele usa o diretorio local [normativos-pipeline](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/normativos-pipeline) para extrair textos normativos, gerar chunks, criar embeddings e persistir no Supabase.

## Fontes de verdade

- orquestrador: [run.py](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/normativos-pipeline/run.py)
- extratores: [extract.py](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/normativos-pipeline/pipeline/extract.py)
- chunking e embeddings: [process.py](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/normativos-pipeline/pipeline/process.py)
- persistencia: [ingest.py](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/normativos-pipeline/pipeline/ingest.py)
- PDFs locais: [pdfs/pf-ifrn](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/normativos-pipeline/pdfs/pf-ifrn)
- frontend consumidor: [ConsultorSessions.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/ConsultorSessions.tsx)

## Fluxo operacional

1. `run.py` carrega o `.env` do pipeline e configura Google AI e Supabase.
2. `pipeline/extract.py` monta a lista de documentos por fonte:
   - `FONTES_PLANALTO`: leis e decretos em HTML do Planalto
   - `FONTES_IN`: instrucoes normativas e portarias em paginas do DOU ou gov.br
   - `pdfs/pf-ifrn/*.pdf`: arquivos PDF locais
3. Cada documento vira um `Documento` com metadados, `url_origem`, texto limpo e `hash_conteudo`.
4. `pipeline/ingest.py` consulta `normativos.hash_conteudo` para evitar reingestao de documento sem alteracao.
5. `pipeline/process.py` divide o texto em chunks e gera embeddings com o modelo configurado em `EMBEDDING_MODEL`.
6. `pipeline/ingest.py` faz upsert em `normativos`, recria os chunks em `normativos_chunks` e registra a execucao em `normativos_log`.
7. A function SQL `buscar_normativos` consulta `normativos_chunks` por similaridade vetorial e retorna trechos com metadados do normativo.
8. O frontend do Consultor chama a Edge Function `consultor`. A implementacao dessa function nao esta neste repo. Por inferencia a partir do contrato do pipeline e das fontes exibidas no frontend, ela usa a base `normativos`/`normativos_chunks` para compor respostas com fontes.

## Tabelas e RPC

O SQL de setup esta embutido em [ingest.py](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/normativos-pipeline/pipeline/ingest.py) e pode ser impresso com:

```powershell
python run.py --setup
```

Objetos esperados no Supabase:

- `normativos`: catalogo do documento, hash de conteudo, origem, tipo, numero, ano e metadados.
- `normativos_chunks`: chunks vetorizados com `embedding vector(768)`.
- `normativos_log`: historico de execucao por documento.
- `buscar_normativos`: RPC de busca semantica por embedding.

Observacao: esses objetos nao estavam documentados no catalogo principal antes deste registro. Antes de alterar schema, confirme no Supabase real e alinhe migrations se a base precisar ser recriada por deploy.

## Como auditar sem reingerir

Use consultas somente leitura contra `normativos`, `normativos_chunks` e `normativos_log`. Evite rodar `python run.py` quando o objetivo for apenas verificar estado, porque esse comando gera embeddings e grava no banco.

Consulta basica:

```sql
select
  n.tipo,
  n.titulo,
  n.numero,
  n.ano,
  n.url_origem,
  n.data_ingestao,
  count(c.id) as chunks
from normativos n
left join normativos_chunks c on c.normativo_id = n.id
group by n.id
order by n.tipo, n.titulo;
```

Ultimos logs:

```sql
select titulo, status, chunks_gerados, mensagem, executado_em
from normativos_log
order by executado_em desc
limit 100;
```

Para comparar se a versao atual da fonte mudou, extraia os documentos sem chamar `processar_documento` e compare `Documento.hash_conteudo` com `normativos.hash_conteudo`.

## Como ingerir

Com dependencias instaladas e segredos configurados no `.env` de [normativos-pipeline](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/normativos-pipeline):

```powershell
python run.py --fonte planalto
python run.py --fonte ins
python run.py --fonte pdfs
```

Ou, para todas as fontes:

```powershell
python run.py
```

Esse comando grava no Supabase e consome a API de embeddings. Antes de rodar em producao, confirme:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `GOOGLE_API_KEY`
- `EMBEDDING_MODEL`
- se a function `consultor` publicada usa a mesma dimensao de embedding da RPC `buscar_normativos`

## Backlog de ingestao

Snapshot levantado em 2026-04-12 e atualizado apos tentativa de ingestao em 2026-04-12, em consulta ao Supabase `mnqhwyrzhgykjlyyqodd`.

Resumo:

- esperados pelo pipeline local: 20 documentos
- registros em `normativos`: 12
- chunks em `normativos_chunks`: 1036
- ingeridos com hash atual conferido: 11
- ingerido, mas hash atual da fonte mudou: 1
- pendentes e extraiveis: 4
- pendentes com fonte atual retornando 404: 4

Observacao da execucao de 2026-04-12: a tentativa inicial de usar o pipeline padrao falhou antes da ingestao porque `tiktoken` tentou baixar `cl100k_base.tiktoken` de `openaipublic.blob.core.windows.net` e houve falha de DNS. Para ingerir apenas os documentos ausentes, foi usado um script inline com os mesmos extratores, mesmo Supabase e mesmo modelo de embedding, mas com chunking aproximado por palavras. Essa excecao operacional afetou os documentos ingeridos em 2026-04-12. Como os hashes desses documentos agora existem em `normativos`, uma futura reingestao pelo pipeline padrao vai ignora-los se o texto nao mudar; para recriar os chunks com `tiktoken`, sera necessario reprocessamento forçado desses registros.

### Ingeridos com hash atual conferido

| Fonte | Documento | Chunks | Data de ingestao |
|---|---|---:|---|
| Planalto | Lei no 10.520/2002 | 19 | 2026-03-29T11:38:02.269707+00:00 |
| Planalto | Decreto no 10.947/2022 | 35 | 2026-03-29T11:34:11.648381+00:00 |
| Planalto | Decreto no 10.193/2019 | 19 | 2026-03-29T11:34:25.292298+00:00 |
| Planalto | Lei no 12.305/2010 | 85 | 2026-03-29T11:35:11.141666+00:00 |
| Planalto | Lei no 9.784/1999 | 85 | 2026-03-29T11:42:36.638433+00:00 |
| Planalto | Lei no 14.133/2021 | 452 | 2026-03-29T16:20:07.695699+00:00 |
| Planalto | Decreto no 11.246/2022 | 48 | 2026-03-29T16:21:19.860936+00:00 |
| Planalto | Decreto no 11.531/2023 | 54 | 2026-04-12T23:38:02.64576+00:00 |
| IN/gov.br | IN SEGES/ME no 65/2021 | 4 | 2026-04-12T23:38:09.758008+00:00 |
| PDF local | DEC_12174_2024.pdf | 8 | 2026-03-29T16:10:07.628096+00:00 |
| PDF local | Parecer _52025_Limpeza.pdf | 97 | 2026-03-26T18:54:01.073212+00:00 |

### Ingerido, mas com hash atual diferente

| Fonte | Documento | Estado | Acao recomendada |
|---|---|---|---|
| Planalto | Lei no 12.462/2011 | Existe no banco com 130 chunks, mas o hash extraido em 2026-04-12 difere do hash salvo | Reprocessar `planalto` ou esse documento especifico depois de confirmar se a diferenca vem de alteracao real do texto ou de variacao da pagina HTML |

### Pendentes e extraiveis

| Fonte | Documento | Evidencia | Acao recomendada |
|---|---|---|---|
| IN/DOU | IN SEGES/MGI no 5/2017 | Extraida em 2026-04-12, ausente em `normativos`; tentativa de ingestao em 2026-04-12 falhou por quota `429 RESOURCE_EXHAUSTED` da API Gemini | Reexecutar fonte `ins` quando a quota de embeddings estiver disponivel |
| PDF local | CADERNO_Limpeza_SEGES.pdf | PDF extraivel, ausente em `normativos`; tentativa de ingestao em 2026-04-12 falhou por quota `429 RESOURCE_EXHAUSTED` da API Gemini | Reexecutar fonte `pdfs` quando a quota de embeddings estiver disponivel |
| PDF local | CADERNO_Transportes_SEGES.pdf | PDF extraivel, ausente em `normativos`; tentativa de ingestao em 2026-04-12 falhou por quota `429 RESOURCE_EXHAUSTED` da API Gemini | Reexecutar fonte `pdfs` quando a quota de embeddings estiver disponivel |
| PDF local | CADERNO_Vigilancia_SEGES.pdf | PDF extraivel, ausente em `normativos`; tentativa de ingestao em 2026-04-12 falhou por quota `429 RESOURCE_EXHAUSTED` da API Gemini | Reexecutar fonte `pdfs` quando a quota de embeddings estiver disponivel |

### Pendentes com URL 404

| Fonte | Documento | URL configurada | Acao recomendada |
|---|---|---|---|
| DOU | Portaria ME no 7.828/2022 | `https://www.in.gov.br/en/web/dou/-/portaria-me-n-7.828-de-30-de-agosto-de-2022-426189993` | Atualizar URL em `FONTES_IN` ou substituir por fonte oficial acessivel |
| DOU | IN SEGES no 58/2022 | `https://www.in.gov.br/web/dou/-/instrucao-normativa-seges/me-n-58-de-8-de-agosto-de-2022-421312386` | Atualizar URL em `FONTES_IN` ou substituir por fonte oficial acessivel |
| DOU | IN SEGES/ME no 67/2021 | `https://www.in.gov.br/en/web/dou/-/instrucao-normativa-seges/me-n-67-de-8-de-julho-de-2021-331037740` | Atualizar URL em `FONTES_IN` ou substituir por fonte oficial acessivel |
| DOU | IN SEGES/ME no 73/2022 | `https://www.in.gov.br/web/dou/-/instrucao-normativa-seges-me-n-73-de-30-de-setembro-de-2022-433436035` | Atualizar URL em `FONTES_IN` ou substituir por fonte oficial acessivel |

## Problemas conhecidos

- A implementacao da Edge Function `consultor` nao esta versionada em `supabase/functions`, entao o contrato entre function, embedding e RPC precisa ser conferido no ambiente Supabase publicado.
- `FONTES_IN` contem URLs do DOU que retornaram 404 em 2026-04-12.
- A inferencia de metadados dos PDFs usa o nome do arquivo separado por `_`. Arquivos como `CADERNO_Limpeza_SEGES.pdf` entram como `tipo=parecer`, `numero=LIMPEZA` e `ano=SEGES` no estado atual do parser.
- O pipeline nao possui modo dry-run formal. Para auditoria, rode consultas somente leitura ou escreva um script separado que nao chame `processar_documento`.
