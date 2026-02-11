# Database Schema (Inferred)

Based on `src/types/index.ts` and `src/services`, the application uses the following main entities.

## Tables (Supabase)

### `atividades`
Stores budget activities.
| Column | Type | Description |
|---|---|---|
| id | UUID | Primary Key |
| dimensao | Text | Dimension code (GO, EN, PE, EX, AD) |
| componente_funcional | Text | Functional component code |
| processo | Text | Process identifier |
| atividade | Text | Activity name/code |
| descricao | Text | Detailed description |
| valor_total | Numeric | Planned budget value |
| origem_recurso | Text | Source of funds |
| natureza_despesa | Text | Expense nature code |
| plano_interno | Text | Internal plan code |
| created_at | Timestamp | Creation date |
| updated_at | Timestamp | Last update date |

### `empenhos`
Stores financial commitments.
| Column | Type | Description |
|---|---|---|
| id | UUID | Primary Key |
| numero | Text | Commitment number |
| descricao | Text | Description |
| valor | Numeric | Committed value |
| dimensao | Text | Dimension code |
| componente_funcional | Text | Functional component |
| origem_recurso | Text | Source of funds |
| natureza_despesa | Text | Expense nature |
| plano_interno | Text | (Optional) Internal plan |
| favorecido_nome | Text | (Optional) Beneficiary name |
| favorecido_documento | Text | (Optional) Beneficiary ID |
| valor_liquidado | Numeric | Liquidated amount |
| data_empenho | Date | Date of commitment |
| status | Text | 'pendente', 'liquidado', 'pago', 'cancelado' |
| atividade_id | UUID | (FK) Reference to `atividades` (Optional) |
| created_at | Timestamp | Creation date |
| updated_at | Timestamp | Last update date |

### `transparencia_documentos`
Stores expenditure documents synced from Transparency API.
| Column | Type | Description |
|---|---|---|
| id | UUID | Primary Key |
| documento | Text | Document ID (Unique) |
| data_emissao | Date | Issue date |
| fase | Text | 'Liquidação', 'Pagamento' |
| documento_resumido | Text | Short document ID |
| observacao | Text | Observations |
| favorecido_nome | Text | Beneficiary name |
| favorecido_documento | Text | Beneficiary ID |
| valor | Numeric | Document value |
| elemento_despesa | Text | Expense element |
| natureza_despesa | Text | Full expense nature string |
| source_recurso | Text | Source (Optional) |
| created_at | Timestamp | Creation date |
| updated_at | Timestamp | Last update date |
