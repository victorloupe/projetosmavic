# DESIGN.md — MAVIC Design System

## 1. Identidade e Filosofia Visual
O design do **MAVIC Projetos** é inspirado na arquitetura de alto padrão e galerias de arte contemporânea: superfícies quentes e táteis, contraste equilibrado, tipografia elegante e acabamento refinado com tons ocres, bronze e areia.

---

## 2. Tipografia
* **Família Display / Títulos / Números de Destaque:** `'Outfit', sans-serif` (pesos 500, 600, 700, 800)
* **Família Interface / Corpo de Texto / Controles:** `'Plus Jakarta Sans', sans-serif` (pesos 400, 500, 600, 700)
* **Fallback Geral:** `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`

### Escala Tipográfica Padrão
* **H1 / Títulos Principais:** 22px – 26px (`font-weight: 700 / 800`, `letter-spacing: -0.02em`)
* **H2 / Subtítulos de Seção:** 17px – 19px (`font-weight: 700`, `letter-spacing: -0.01em`)
* **H3 / Cabeçalhos de Card & Modal:** 15px – 16px (`font-weight: 600`)
* **Body / Padrão:** 13px – 14px (`line-height: 1.5`, `font-weight: 400 / 500`)
* **Small / Badges / Metadados:** 11px – 12px (`font-weight: 500 / 600`)

---

## 3. Paleta de Cores & Design Tokens

### Modo Claro (Light Theme)
```css
:root {
  --bg: #FAF9F6;              /* Alabastro clean de galeria de arte */
  --surface: #FFFFFF;         /* Branco puro para cartões e modais */
  --surface2: #F5F3EF;        /* Areia suave de arquitetura para inputs/toolbars */
  --border: rgba(146, 98, 58, 0.12); /* Borda ocre translúcida */
  --border2: rgba(146, 98, 58, 0.22);/* Borda de foco e realce */
  --text: #1C1B19;            /* Preto quente sofisticado */
  --text2: #5C5852;           /* Texto secundário/neutro */
  --text3: #9C958A;           /* Texto atenuado/placeholders */

  --accent: #92623a;          /* Ocre dourado corporativo MAVIC */
  --accent2: #754E2E;         /* Ocre profundo para hover/ativo */
  --accent-bg: rgba(146, 98, 58, 0.07); /* Fundo sutil de destaque */
}
```

### Modo Escuro (Dark Theme)
```css
[data-theme="dark"] {
  --bg: #0C0B0A;              /* Obsidiana bronzeada profunda */
  --surface: #141311;         /* Carvão quente de alto padrão */
  --surface2: #1E1C19;        /* Fundo de controles e cabeçalhos escuros */
  --border: rgba(197, 147, 95, 0.12); /* Ouro bronze suave */
  --border2: rgba(197, 147, 95, 0.22);
  --text: #F7F5F2;            /* Branco linho macio */
  --text2: #AFA99E;           /* Texto secundário linho */
  --text3: #7E786E;           /* Texto bronze acinzentado */

  --accent: #C5935F;          /* Bronze dourado */
  --accent2: #DBA774;         /* Dourado iluminado */
  --accent-bg: rgba(197, 147, 95, 0.12);
}
```

### Cores Semânticas e de Status
* **Sucesso / Concluído / Pago:** `--green: #1F8A4D` (Dark: `#2BBD6E`) | Fundo: `--green-bg: #EAF7EE`
* **Alerta / Em Andamento:** `--yellow: #B7791F` (Dark: `#DD6B20`) | Fundo: `--yellow-bg: #FEF9E7`
* **Perigo / Atrasado / Cancelado:** `--red: #C53030` (Dark: `#E53E3E`) | Fundo: `--red-bg: #FDF2F2`
* **Informativo / Primário Neutro:** `--blue: #2B6CB0` (Dark: `#3182CE`) | Fundo: `--blue-bg: #EBF8FF`
* **Categorias Especiais:** `--purple: #6B46C1` e `--teal: #319795`

---

## 4. Estrutura Espacial, Bordas e Sombras

### Geometria e Arredondamento
* **Bordas de Componentes / Cards:** `border-radius: var(--r);` (14px)
* **Superfícies Maiores / Modais:** `border-radius: var(--r-lg);` (24px)
* **Pílulas / Badges / Filtros:** `border-radius: 999px;`

### Sombras e Profundidade
* **Sombra Leve (`--sh`):** `0 4px 20px rgba(146, 98, 58, 0.03), 0 2px 4px rgba(0,0,0,0.01)`
* **Sombra Média (`--sh2`):** `0 12px 30px rgba(146, 98, 58, 0.07), 0 4px 8px rgba(0,0,0,0.02)`
* **Sombra de Elevação / Modais (`--sh3`):** `0 20px 48px rgba(0,0,0,0.08), 0 8px 16px rgba(0,0,0,0.02)`
* **Efeito Vidro Translúcido (Glassmorphism):** `backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);`

---

## 5. Padrões de Componentes

### 1. Barra de Navegação (`.nav`)
* Fixada no topo com altura compacta (60px), fundo em vidro translúcido (`--glass2`), borda inferior sutil.
* Brand com logo MAVIC e indicador de sincronização em tempo real (Supabase online/offline).
* Links em abas (`.nav-tab`) com indicador de estado ativo (`.on`), realçado pela cor `--accent`.

### 2. Cards do Quadro Kanban (`.kcard`)
* Fundo `--surface`, borda fina `--border`, cantos arredondados de 14px.
* Hover com leve elevação vertical (`translateY(-2px)`) e ampliação da sombra `--sh2`.
* Indicadores visuais claros: tag de tipo de projeto, tag de prioridade, barra de progresso e data limite com código de cor para atrasos.

### 3. Modais (`.modal`, `.modal-card`)
* Overlay com backdrop escurecido e desfoque suave (`backdrop-filter: blur(8px)`).
* Animação de entrada suave (`scale: 0.96 -> 1.0` com `opacity: 0 -> 1`).
* Cabeçalho fixo com botão de fechar, corpo com rolagem suave e rodapé de ações fixo.

### 4. Formulários e Inputs (`.inp`, `select`, `textarea`)
* Fundo `--surface2`, borda `--border`, cantos com 10px – 12px.
* Foco com contorno nítido e sutil da cor de destaque `--accent` e expansão de sombra ocre.

### 5. Indicadores Financeiros (`.fin-bar`, `.fin-val`)
* Resumos rápidos no topo ou no painel: valores pagos destacados em verde e saldos a pagar em vermelho/âmbar suave.

---

## 6. Microinterações e Movimento
* **Transições:** Duração entre `180ms` e `300ms` com curva de desaceleração suave `cubic-bezier(0.4, 0, 0.2, 1)`.
* **Navegação Nativa:** Uso de `@view-transition { navigation: auto; }` para crossfades fluidos entre páginas.
* **Proibição de Saltos:** Proibido uso de transições saltitantes ou elastic easing.

---

## 7. Acessibilidade e Responsividade
* **Contraste Mínimo:** Todos os textos principais mantêm contraste WCAG AA sobre fundos claros ou escuros.
* **Áreas de Toque:** Elementos clicáveis e botões de ação possuem área mínima de 40x40px para suporte mobile/PWA.
* **PWA & Safe Areas:** Totalmente adaptado para safe areas (`env(safe-area-inset-*)`) em dispositivos iOS e Android.
