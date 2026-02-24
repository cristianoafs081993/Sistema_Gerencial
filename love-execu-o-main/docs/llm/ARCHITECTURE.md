# Architecture & Tech Stack

## Tech Stack
- **Frontend Framework**: React 18 with Vite.
- **Language**: TypeScript.
- **Styling**: Tailwind CSS with `shadcn/ui` components.
- **State Management**: React Query (`@tanstack/react-query`) for server state, React Context for global app state (`DataContext`).
- **Backend/Database**: Supabase (PostgreSQL).
- **Routing**: React Router DOM.
- **Icons**: Lucide React.
- **Date Handling**: `date-fns`.

## Project Structure
- `src/components`: Reusable UI components (mostly `shadcn/ui` in `ui/` subfolder).
- `src/contexts`: Context providers (e.g., `DataContext` for budget data).
- `src/hooks`: Custom React hooks (e.g., `use-toast`, `use-mobile`).
- `src/lib`: Utilities and configuration (Supabase client, helper functions).
- `src/pages`: Main route components (Dashboard, Atividades, Empenhos, etc.).
- `src/services`: API service layers interacting with Supabase.
- `src/types`: TypeScript type definitions and interfaces.

## Data Flow
1. **Services**: `src/services` contains functions to interact with Supabase (CRUD operations).
2. **Context**: `DataContext` uses React Query to fetch data via services and exposes it to the application. It also handles mutations (create/update/delete) and invalidates queries to refresh data.
3. **Pages/Components**: Consume data from `useData()` hook (from `DataContext`) and render the UI.

## External Integrations
- **Portal da Transparencia API**: Accessed via a proxy (configured in `vite.config.ts`) to avoid CORS issues. Used in `transparenciaService` to fetch real-time expenditure data.
- **Supabase**: Primary data store for Activities and Commitments.

## Database Schema (Key Tables)
### `transparencia_documentos`
Stores liquidations and payments fetched from the Transparency Portal.
- `documento` (PK): Unique document ID.
- `empenho_documento`: (Added Feb 2026) Links to the simplified empenho number (e.g., `2026NE000001`) in the `empenhos` table. Essential for "Restos a Pagar" association.
- `fase`: "Liquidação" or "Pagamento".

### `empenhos`
Stores commitment data.
- `numero`: Simplified empenho number (e.g., `2026NE000001`).
- `valor_liquidado`, `valor_pago`: Calculated fields based on associated documents.
