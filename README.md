# Sistema Gerencial

Aplicacao web de gestao para o IFRN com modulos de execucao orcamentaria, documentos habeis, contratos, PFs, conciliacoes e assistentes apoiados por IA.

## Leia primeiro

- Guia principal do repositorio: [docs/REPOSITORY_GUIDE.md](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/docs/REPOSITORY_GUIDE.md)
- Ponto de entrada para IA e manutencao: [docs/ai/START_HERE.md](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/docs/ai/START_HERE.md)
- Indice da documentacao: [docs/README.md](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/docs/README.md)

## Regras operacionais

- Antes de alterar importadores, leia [docs/data-import/README.md](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/docs/data-import/README.md).
- Antes de alterar banco, leia [docs/database/SCHEMA_OVERVIEW.md](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/docs/database/SCHEMA_OVERVIEW.md) e [docs/database/TABLE_CATALOG.md](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/docs/database/TABLE_CATALOG.md).
- Antes de alterar integracoes ou functions, leia [docs/integrations/API_CATALOG.md](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/docs/integrations/API_CATALOG.md) e [docs/ops/SUPABASE_FUNCTIONS.md](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/docs/ops/SUPABASE_FUNCTIONS.md).
- A pasta `docs/llm` e legado auxiliar, nao fonte primaria.

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## Design System

- Documentação oficial: `docs/DESIGN_SYSTEM.md`
- Preview visual: `src/pages/DesignSystemPreview.tsx` (`/design-system-preview`)
- Regras de adoção: `.antigravity/rules.md`

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
