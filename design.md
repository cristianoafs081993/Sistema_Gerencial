# Design System SIGORC — Estudo Avançado do Padrão Visual Sebrae (BaSe)
> **Extração via Crawl Multi-página (Playwright/Dembrandt) no portal sebrae.com.br**

Este documento reúne a especificação visual profunda extraída diretamente do portal oficial do Sebrae através de análise DOM/CSS automatizada em múltiplas páginas. Estes tokens e regras de layout servem como base para refatorar o **SIGORC** (*Sistema Integrado de Gestão Organizacional*), conferindo-lhe uma identidade corporativa altamente profissional e moderna.

---

## 1. Paleta de Cores Extraída (Color Tokens)

A análise multi-página revelou uma paleta rica baseada em tons de azul corporativo combinados com um amarelo-lima vibrante para contraste e suporte a dados analíticos.

### A. Tons de Marca e Destaque
| Token | Cor | Representação Hex/RGB | Aplicação no Sistema | Hover State |
| :--- | :---: | :--- | :--- | :--- |
| **Azul Sebrae (Accent)** | ![#2a4fda](https://placeholder.co/15/2a4fda/000000?text=+) | `#2a4fda` / `rgb(42, 79, 218)` | Ações primárias, links, botões e marcações ativas | `#325fff` |
| **Azul Secundário** | ![#193ab8](https://placeholder.co/15/193ab8/000000?text=+) | `#193ab8` / `rgb(25, 58, 184)` | Títulos estruturais e cabeçalhos de alta importância | `#2149e2` |
| **Amarelo-Lima Sebrae** | ![#e7f79e](https://placeholder.co/15/e7f79e/000000?text=+) | `#e7f79e` / `rgb(231, 247, 158)` | Botões de realce, fundo de CTAs secundários | `#c4d286` |
| **Deep Navy (Ink)** | ![#1b244b](https://placeholder.co/15/1b244b/000000?text=+) | `#1b244b` / `rgb(27, 36, 75)` | Cor de fonte padrão para textos de alta leitura | `#232f62` |
| **Slate Blue (Muted)** | ![#687499](https://placeholder.co/15/687499/000000?text=+) | `#687499` / `rgb(104, 116, 153)` | Textos secundários, bordas de botões outline e labels | `#7d8bb8` |
| **Azul Claro Ativo** | ![#6aaae4](https://placeholder.co/15/6aaae4/000000?text=+) | `#6aaae4` / `rgb(106, 170, 228)` | Grafismos e realces secundários | `#5a91c2` |

### B. Superfícies e Fundos (Surfaces & Context)
*   **Background Principal:** `#FFFFFF` (Branco puro) e `#F3F6FA` (Cinza muito claro azulado, que traz sensação de limpeza).
*   **Tons de Divisores/Bordas:** `#E2E9FC` / `rgb(226, 233, 252)` e `#E3E9FF`. Substitui o cinza neutro clássico por um cinza com matiz azul sutil, mantendo a harmonia cromática.
*   **Fundo de Alertas de Sucesso (Mint Green):** `#caf8db` / `rgb(202, 248, 219)`.

---

## 2. Sombras com Matiz Azul (Blue-tinted Shadows)

Um dos maiores segredos de acabamento premium identificados no portal Sebrae é a substituição de sombras pretas tradicionais (`rgba(0,0,0,0.1)`) por **sombras com pigmentação azul**. Isso remove o aspecto "sujo" das sombras e dá um efeito de profundidade luminosa (Glow).

*   **Sombra de Elevação Média (Cards & Filtros):**
    `box-shadow: 0px 10px 32px -4px rgba(0, 94, 184, 0.1), 0px 6px 14px -6px rgba(0, 94, 184, 0.2);`
*   **Sombra de Grande Elevação (Modais, Dropdowns & Sidebar Flutuante):**
    `box-shadow: 0px 18px 17px -4px rgba(0, 94, 184, 0.14);`
    `box-shadow: 0px 18px 58px 0px rgba(0, 94, 184, 0.14);`
*   **Sombra Discreta (Componentes Pequenos / Botões):**
    `box-shadow: 0px 2px 4px 0px rgba(20, 46, 82, 0.2);`

---

## 3. Tipografia (Typography System)

A estrutura tipográfica do Sebrae é dividida entre títulos impactantes e corpo altamente geométrico.

*   **Títulos e Displays Primários:**
    *   **Família:** `Campuni, sans-serif`
    *   *Métricas:* 64px, peso `700`, line-height `1.13`.
*   **Rótulos, Ações e Corpo de Interface:**
    *   **Família:** `Figtree, sans-serif` (Disponível no Google Fonts).
    *   *Pesos:* `500` (Medium), `600` (SemiBold), `700` (Bold).
    *   *Tamanhos principais:*
        *   Títulos de Seção / Cards: 32px a 40px (Bold).
        *   Títulos de Cards de Métricas: 24px (Bold).
        *   Textos de Botões e Inputs: 16px (Medium/SemiBold).
        *   Labels e Textos Auxiliares: 13px a 14px (Medium).
        *   Badges / Links Pequenos: 12px (Bold).
*   **Textos Auxiliares de Navegação (Fallback):**
    *   **Família:** `Lato, sans-serif` (16px, Regular, line-height 1.44).

---

## 4. Estrutura de Espaçamento e Bordas (Spacing & Borders)

### A. Grid de Espaçamento (Base 8px)
*   **Micro-espaços:** `4px`, `5px`, `6px`, `7px`, `8px` (paddings de inputs, botões e labels).
*   **Espaço de Componente:** `12px`, `14px`, `15px`, `16px` (margens internas de listas).
*   **Espaço de Seções/Cards:** `20px`, `24px` (padding interno padrão de cards e áreas de dados).
*   **Macro-espaços:** `56px`, `96px` (margens externas de páginas).

### B. Arredondamento (Border Radius)
*   **Botões e Inputs:** `8px` (`rounded-lg` no Tailwind) — Cria uma aparência profissional, nem muito pontiaguda (antiquada) nem muito arredondada (infantil).
*   **Aba / Elementos de Tabulação:** `3px`.
*   **Links e Rótulos Pequenos:** `4px`.
*   **Pills / Badges de Status:** `999px` / `rounded-full`.
*   **Cards de Grande Escala:** `12px` a `16px`.

---

## 5. Componentes de UI Refinados (UI Elements)

### A. Botões (Button Variants)
1.  **Botão de Destaque / CTA Principal (Yellow-Lima):**
    *   `background-color: #e7f79e;`
    *   `color: #2a4fda;` (texto em Azul Sebrae)
    *   `border: 2px solid #e7f79e;`
    *   `padding: 8px 16px;`
    *   `border-radius: 8px;`
    *   *Uso:* Cadastro de novos empenhos, geração de relatórios.
2.  **Botão Primário Corporativo (Blue):**
    *   `background-color: #2a4fda;`
    *   `color: #e7f79e;` (texto em amarelo-lima para alto contraste e visibilidade)
    *   `border: 2px solid #2a4fda;`
    *   `padding: 12px 16px;`
    *   `border-radius: 8px;`
3.  **Botão Secundário / Outline:**
    *   `background-color: #ffffff;`
    *   `color: #687499;` (Slate Blue)
    *   `border: 2px solid #96acff;` (Borda azulada clara)
    *   `padding: 10.4px 16px;`
    *   `border-radius: 8px;`

### B. Inputs e Caixas de Seleção (Text Inputs)
*   `background-color: #ffffff;`
*   `color: #1b244b;` (Deep Navy)
*   `border: 2px solid #96acff;` (Borda em azul-claro sutil, evitando cinza opaco)
*   `border-radius: 8px;`
*   `padding: 10px 16px;`
*   **Estado de Foco (Focus State):**
    *   `background-color: #ffffff;`
    *   `border-color: #2a4fda;` (Foco muda para Azul Sebrae)
    *   `box-shadow: 0px 0px 4px rgba(42, 79, 218, 0.25);`
    *   `outline: none;`

### C. Badges e Tags de Status
*   **Pago / Concluído (Mint Green):**
    *   `background-color: #caf8db;`
    *   `color: #02983e;`
    *   `border: 1px solid rgba(2, 152, 62, 0.2);`
    *   `border-radius: 999px;`
    *   `font-size: 12px;`
    *   `font-weight: 700;`
    *   `padding: 4px 12px;`

---

## 6. Próximos Passos de Integração (SIGORC)

Com a extração exata das variáveis através do Playwright, as ações para refatorar o sistema são:

1.  **Refatorar o [index.css](file:///C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/index.css):**
    *   Substituir a cor primária `--primary` para o Azul Sebrae (`rgb(42, 79, 218)`) no seletor `:root`.
    *   Criar variáveis para `--accent-lime` (`rgb(231, 247, 158)`) e `--text-navy` (`rgb(27, 36, 75)`).
    *   Substituir a sombra `--shadow-primary` e `--shadow-md` para usar a tonalidade azulada baseada em `rgba(0, 94, 184, 0.1)`.
    *   Substituir a borda padrão `--border` para usar o matiz azulado `#E2E9FC`.
2.  **Refatorar a Tipografia:**
    *   Importar a fonte **Figtree** no topo do CSS.
    *   Configurar a fonte primária do sistema no `body` como `Figtree, sans-serif`.
3.  **Renomear Marca e Logo no [brand.ts](file:///C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/lib/brand.ts):**
    *   Atualizar a logo com a nova imagem do **SIGORC** enviada.
    *   Substituir o nome do aplicativo para **SIGORC** e a descrição institucional.
