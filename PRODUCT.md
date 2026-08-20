# PRODUCT.md — MAVIC Projetos

## 1. Visão Geral do Produto
**MAVIC Projetos** é um sistema web e PWA de gestão de projetos desenvolvido especificamente para escritórios e profissionais de **arquitetura, interiores e design**. Ele centraliza o ciclo de vida completo de cada projeto — desde o primeiro contato, proposta e orçamento, passando pelas fases de planejamento, modelagem 3D, detalhamento executivo e acompanhamento de obra, até a entrega e quitação financeira.

---

## 2. Lane / Register
* **Register:** **Product** (Aplicação Web / SaaS / Dashboard Operacional + Portal do Cliente)
* **Contexto Visual:** Sofisticação arquitetônica, alta densidade de informação com respiração visual, precisão e clareza.

---

## 3. Público-Alvo (Personas)
1. **Administradores / Arquitetos Líderes:**
   * Necessitam de visão macro do fluxo de trabalho (Kanban), controle de prazos, faturamento, recebíveis e relatórios consolidados.
2. **Equipe de Produção / Detalhamento:**
   * Precisam de clareza nas etapas, tarefas pendentes, prioridades e checklists operacionais por projeto.
3. **Clientes Finais do Escritório:**
   * Acessam o **Portal do Cliente** (`cliente.html`) para acompanhar o status e evolução visual do seu projeto, etapas aprovadas, pendências financeiras e avisos importantes de forma transparente e acolhedora.

---

## 4. Voz e Tom
* **Elegante e Arquitetônico:** Comunicação que reflete o cuidado estético e a precisão do trabalho arquitetônico.
* **Profissional e Acolhedor:** Linguagem direta em português brasileiro (PT-BR), sem jargões técnicos de TI desnecessários.
* **Confiável e Transparente:** Clareza total em termos de status de aprovação, entregas e valores financeiros.

---

## 5. Módulos e Superfícies Principais
* **Quadro de Projetos (`index.html`, `board.js`):** Kanban interativo com colunas customizáveis, drag-and-drop, filtros por cliente/tipo/prioridade, modal de projeto detalhado.
* **Dashboard Executivo (`dashboard.html`, `dashboard.js`):** Indicadores de desempenho, projetos ativos, taxas de conclusão e prazos críticos.
* **Orçamentos (`orcamento.html`, `orcamento.js`):** Criação e emissão de orçamentos, detalhamento de itens/serviços, precificação e status de aprovação.
* **Pagamentos & Finanças (`pagamentos.html`, `pagamentos.js`):** Gestão de parcelas, comprovantes, valores recebidos vs. a receber, alertas de vencimento.
* **Relatórios (`relatorio.html`, `relatorio.js`):** Relatórios de produtividade, faturamento mensal, histórico de projetos e exportação.
* **Clientes (`clientes.html`, `clientes.js`):** Diretório unificado de clientes, contatos, histórico e links diretos para o portal.
* **Serviços (`servicos.html`, `servicos.js`):** Catálogo de serviços padronizados do escritório com valores base.
* **Portal do Cliente (`cliente.html`, `cliente.js`):** Interface segura (via Supabase Edge Function) com resumo financeiro, timeline de etapas e avisos.

---

## 6. Anti-References (O que NÃO fazer)
* **Sem estética "Generic AI SaaS":** Evitar gradientes elétricos roxo-azul neon, bordas super-brilhantes ou temas espaciais.
* **Sem cinzas frios/ardósia de TI genérica:** O sistema utiliza uma paleta quente (alabastro, areia, terracota/ocre dourado, carvão aquecido).
* **Sem tipografia sem identidade:** Proibido uso indiscriminado de fontes genéricas; a identidade é ancorada em `Outfit` (display) e `Plus Jakarta Sans` (interface).
* **Sem aninhamento excessivo ("Card in Card"):** Manter a hierarquia limpa, usando divisores sutis ou espaçamento em vez de caixas dentro de caixas.
* **Sem animações saltitantes (bouncy/spring):** Transições devem ser suaves, com desaceleração precisa (`cubic-bezier(0.4, 0, 0.2, 1)`).
