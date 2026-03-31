# Normativos Pipeline — ContratoIFRN

Pipeline de ingestão de normativos jurídicos para o módulo de verificação de conformidade.

## Fluxo

```
Planalto (leis/decretos)  ┐
SEGES (INs)               ├→ Extração → Chunking → Embedding (Gemini) → Supabase (pgvector)
PDFs locais (PF/IFRN)     ┘
```

## Setup

### 1. Supabase — criar as tabelas

```bash
python run.py --setup
```

Copie o SQL gerado e cole no **SQL Editor** do seu projeto Supabase.

### 2. Configurar variáveis de ambiente

```bash
cp .env.example .env
```

Edite o `.env`:
- `GOOGLE_API_KEY` → [aistudio.google.com](https://aistudio.google.com) → Get API key
- `SUPABASE_URL` → Settings → API → Project URL
- `SUPABASE_SERVICE_KEY` → Settings → API → service_role key

### 3. Instalar dependências

```bash
pip install -r requirements.txt
```

### 4. Adicionar PDFs da PF/IFRN

Coloque os arquivos PDF na pasta `pdfs/pf-ifrn/`.

Convenção de nomenclatura:
```
PARECER_001_2023_descricao.pdf
NOTA_004_2022_descricao.pdf
```

### 5. Rodar a pipeline

```bash
# Ingere todas as fontes
python run.py

# Ingere apenas uma fonte
python run.py --fonte planalto
python run.py --fonte ins
python run.py --fonte pdfs
```

## Estrutura

```
normativos-pipeline/
├── run.py                  # Orquestrador
├── requirements.txt
├── .env.example
├── pdfs/
│   └── pf-ifrn/            # PDFs dos pareceres da PF/IFRN
└── pipeline/
    ├── extract.py           # Extratores por fonte
    ├── process.py           # Chunking + embeddings (Gemini)
    └── ingest.py            # Upsert Supabase + SQL de setup
```

## Busca semântica (usar na aplicação)

Após a ingestão, use a função SQL gerada no Supabase:

```sql
select * from buscar_normativos(
  query_embedding := <vetor gerado pelo Gemini>,
  match_count     := 5,
  tipo_filtro     := 'lei',   -- opcional: lei | decreto | in | parecer
  apenas_vigentes := true
);
```

Ou via Supabase client no Python/TypeScript:

```python
embedding = genai.embed_content(
    model="models/text-embedding-004",
    content="fiscal técnico e administrativo",
    task_type="RETRIEVAL_QUERY",  # QUERY para busca, DOCUMENT para ingestão
)["embedding"]

resultado = sb.rpc("buscar_normativos", {
    "query_embedding": embedding,
    "match_count": 5,
}).execute()
```

## Deduplicação

A pipeline usa hash SHA-256 do conteúdo de cada documento.
Se o documento não mudou desde a última execução, é ignorado automaticamente.
Isso permite rodar a pipeline diariamente sem overhead.

## Adicionar novos normativos

Edite `pipeline/extract.py` e adicione entradas nas listas:
- `FONTES_PLANALTO` — para leis e decretos
- `FONTES_IN` — para Instruções Normativas
- Ou coloque o PDF em `pdfs/pf-ifrn/`
