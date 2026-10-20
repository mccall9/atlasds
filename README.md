# Atlas Insights

# PROMPT PARA O LOVABLE | DASHBOARD ATLAS (PAINEL DE RESULTADOS)

Crie um web app chamado **Atlas | Painel de Resultados**: um dashboard executivo e somente leitura que consolida, em tempo real, os dados dos **Portais de Resultados** (uma planilha Google Sheets por cliente) da Atlas Assessoria, uma assessoria de marketing e vendas para médicos e clínicas de cirurgia facial/estética. Todo o texto da interface em **português do Brasil**.

---

## 1. OBJETIVO

Dar à equipe (CS, Gestor de Projetos, Hunters, Performance) uma visão única de investimento, consultas, conversão, vendas, comissões e previsibilidade, por cliente ou de toda a carteira, filtrando por período. Os números vêm direto das planilhas. O app não digita nem edita nada nelas.

---

## 2. ARQUITETURA E CONEXÃO COM AS PLANILHAS

Use **Supabase** (backend) + **Google Sheets API v4** via **Edge Function** (a chave nunca vai ao front-end).

1. **Autenticação com o Google**: Service Account (JSON guardado em secret do Supabase). Cada Portal é compartilhado com o e-mail da Service Account como *Leitor*. Alternativa aceita: OAuth da conta corporativa Atlas.
2. **Tabela `clientes`** (Supabase), que é o cadastro de quais planilhas ler:
   - `id`, `nome` (ex.: "Dra. Thais Oliveira"), `ativo` (bool), `spreadsheet_id` (ID do Portal), `hunter`, `performance`, `layout` (`atual` | `antigo`), `meta_mensal_override` (opcional), `created_at`.
   - Tela de admin `/clientes` para adicionar, editar e desativar clientes colando a URL do Portal (extrair o `spreadsheet_id` automaticamente).
   - Opcional: sincronizar essa lista com a planilha "Controle | Gestão | Atlas Assessoria", aba "Controle de Clientes" (ID `1UFLJ2yn4LY_3QJDtqyo37NTm2Gcj48sI-KsaTdXgIoo`), que é a fonte oficial de clientes ativos.
3. **Edge Function `sync-portais`**: para cada cliente ativo, lê as abas abaixo com `spreadsheets.values.batchGet`, normaliza e grava em tabelas-espelho no Supabase (`vendas`, `metas`, `acompanhamento`, `regras_procedimentos`). Roda por **cron a cada 15 minutos** e também por botão "Atualizar agora" no topo do dashboard. Exibir "Última atualização: dd/mm/aaaa HH:mm".
4. O front-end lê somente das tabelas do Supabase (rápido, com filtros em SQL).
5. Tratar erros por cliente: se um Portal falhar (sem permissão, aba renomeada), mostrar um aviso discreto "Dados de [cliente] indisponíveis" sem derrubar o resto.

### Estrutura de cada Portal (todos seguem o mesmo modelo)

Abas: `PAINEL DE RESULTADOS`, `TABELA E REGRAS`, `VENDAS MÊS`, ` ACOMPANHAMENTO ` (há um espaço antes e depois do nome. Localizar a aba por `trim()` do título, nunca por posição).

**Aba `VENDAS MÊS`** (a principal fonte). Linha 1 é cabeçalho, uma linha por consulta/paciente. Mapear por **nome do cabeçalho** (com trim), não por letra de coluna:

| Cabeçalho | Campo | Observações |
|---|---|---|
| Nome do Paciente | `lead_nome` | |
| STATUS | `status` | valores listados abaixo |
| Data da consulta | `data_consulta` | formato dd/mm/aaaa |
| Consultas | `consultas` | número, 1 por consulta (vem como "1,00") |
| Comparecimentos | `comparecimentos` | 1 ou 0 (vazio = 0) |
| Vendas | `vendas` | 1 quando pagou sinal e agendou cirurgia |
| Data da Venda | `data_venda` | |
| Data da cirurgia | `data_cirurgia` | |
| Origem | `origem` | ANÚNCIO/ADS, INDICAÇÃO, INSTAGRAM, BASE |
| Procedimento | `procedimento` | texto livre |
| Orçamento | `orcamento` | texto "R$ 0.000,00" |
| Valor Fechado (R$) | `valor_fechado` | texto "R$ 0.000,00" |
| Procedimento 100% pago? | `pago_100` | checkbox TRUE/FALSE |
| Caixa recebido | `caixa_recebido` | |
| Comissão Atlas (5%) | `comissao_atlas` | |
| Comissão Hunter (3%) | `comissao_hunter` | |
| Comissão Extra (2%) | `comissao_extra` | |
| Observações | `observacoes` | |

**Parsing obrigatório**: valores monetários vêm como texto no padrão brasileiro `"R$ 15.500,00"`. Converter para número (remover "R$", espaços e pontos de milhar, trocar vírgula por ponto). Números como `"1,00"` idem. Datas `dd/mm/aaaa` para `date`. Linhas sem Nome do Paciente são ignoradas. Células vazias = `null` (nunca assumir zero onde o dado não existe, exceto Comparecimentos vazio = 0).

**Status possíveis** (usar exatamente estes, com cores de badge):
- CONSULTA AGENDADA (azul), NÃO COMPARECEU (cinza), COMPARECEU NÃO FECHOU (vermelho/rosa), AGUARDANDO SINAL (amarelo), EM NEGOCIAÇÃO (laranja), VENDA REALIZADA (verde), PROCEDIMENTO REALIZADO | PAGO (verde-escuro), DESMARCOU (cinza), CIRURGIA DESMARCADA (vermelho), DESQUALIFICADA (cinza-escuro).

**Aba `PAINEL DE RESULTADOS`**: tabela de metas por mês, cabeçalho na linha 6: `MÊS | META MÍNIMA (R$) | META IDEAL (R$) | SUPERMETA (R$) | ALCANÇADO | Meta Consultas (Qtd) | Meta Vendas (Qtd) | Meta Cirurgias (Qtd)`, com linhas JANEIRO a DEZEMBRO e TOTAL ACUMULADO. Usar para a "Meta Esperada" e o "% atingido".

**Aba ` ACOMPANHAMENTO `**: acompanhamento semanal (consultas agendadas, comparecimentos, vendas, cirurgias por semana) e bloco META MÍNIMA/IDEAL/SUPERMETA com valor meta, alcançado e % atingido. Ler e armazenar para uso numa seção secundária (evolução semanal).

**Aba `TABELA E REGRAS`** (uso secundário, só leitura): procedimentos em A:G (Procedimento | Valor Mínimo | Valor Máximo | Formas de Pagamento | Permite Desconto AV? | Regras de Parcelamento | Sinal / % para agendar cirurgia), informações gerais em I:J (linhas 2 a 9). **Atenção**: dois clientes (Dr. Victor Hugo e Dra. Alessandra Santana) usam o layout antigo, sem a coluna "Sinal / %", com informações gerais em H:I. O campo `layout` do cliente define qual leitura usar. Para o MVP, essa aba pode ficar fora do dashboard principal.

**Regras de segurança dos dados**: o app é 100% somente leitura nas planilhas. Nunca criar, recriar, renomear ou escrever em nenhum Portal, pois o Dashboard e outras automações dependem desses arquivos intactos.

---

## 3. FILTROS GLOBAIS (barra no topo, sticky)

- **Cliente**: dropdown com "Todos os clientes (carteira)" + cada cliente ativo. Em "Todos", somar/consolidar e mostrar comparativo por cliente.
- **Período**: seletor de intervalo de datas com atalhos (Este mês, Mês passado, Últimos 30 dias, Este trimestre, Personalizado). Padrão: mês corrente. Exibir no formato "1 ago 2026 - 31 ago 2026".
- **Filtro opcional por Hunter e por Performance** (quando "Todos").
- Os filtros ficam na URL (query string) para o link ser compartilhável.

**Critério de data de cada métrica** (importante, evita dupla contagem):
- Consultas, Comparecimentos, Origem, Leads: por `data_consulta` dentro do período.
- Vendas e Valor Fechado: por `data_venda` dentro do período.
- Procedimentos realizados, Caixa recebido e Comissões: por `data_cirurgia` dentro do período, considerando só status PROCEDIMENTO REALIZADO | PAGO.
- Faturamento futuro/Pipeline: `data_cirurgia` **posterior ao fim do período**, com venda realizada.

---

## 4. LAYOUT DO DASHBOARD (seguir esta ordem e agrupamento, cada grupo com título em caixa-alta, cor própria e cards arredondados)

Título: **Painel de Resultados**, subtítulo "Visão executiva consolidada: investimento, vendas, comissões e previsibilidade". Logo da Atlas no canto superior esquerdo (deixar um slot para upload do logo).

### 4.1 ANÚNCIOS (azul)
3 cards:
- **Valor Investido**: soma Meta Ads + Google Ads (R$). Legenda "Meta Ads + Google Ads".
- **Conversas Iniciadas**: total consolidado das plataformas.
- **Custo por Conversa**: Valor Investido ÷ Conversas Iniciadas. Legenda "Investido ÷ Conversas".

> ⚠️ Estes dados **não existem nos Portais**. Criar a tabela `investimento_anuncios` (`cliente_id`, `data`, `plataforma` [meta|google], `valor_investido`, `conversas_iniciadas`) com **tela de lançamento manual** (formulário + upload CSV) e deixar pronta a estrutura para depois conectar às APIs do Meta Ads e Google Ads. Enquanto não houver dado, mostrar "—" e um aviso "Sem investimento lançado no período".

### 4.2 COMISSÕES (verde)
Linha 1: **Procedimentos Realizados** (qtd) | **Caixa Recebido** (soma de `caixa_recebido`) | **Comissão Total (5%)**.
Linha 2: **Comissão Hunter (3%)** | **Comissão Gestor de Performance (1%)** | **Comissão Atlas (1%)**.
- Cálculo: comissão total = 5% do caixa recebido; Hunter 3%; Performance 1%; Atlas 1%. Deixar os percentuais **configuráveis** numa tela de configurações (o cabeçalho da planilha usa rótulos diferentes: "Comissão Atlas (5%)", "Hunter (3%)", "Extra (2%)"; ver nota de divergência na seção 8). Por padrão, calcular a partir do `caixa_recebido` com os percentuais configurados em vez de depender das colunas de comissão da planilha.

### 4.3 CONSULTAS (laranja)
**Consultas Agendadas** | **Comparecimentos** | **Taxa de Comparecimento** (comparecimentos ÷ consultas).

### 4.4 TAXA DE CONVERSÃO DO DOUTOR (rosa)
**Comparecimentos** (no período) | **Vendas Realizadas** (no período) | **Taxa de Conversão** (vendas ÷ comparecimentos).

### 4.5 PROCEDIMENTOS PROJETADOS (verde-água)
4 cards: **Procedimentos Previstos** | **Faturamento Previsto** | **Ticket Médio** | **Meta Esperada** (meta do mês vinda da aba PAINEL DE RESULTADOS, com legenda "x% atingido" = faturamento previsto ÷ meta).

### 4.6 FATURAMENTO FUTURO (roxo)
3 cards: **Procedimentos** (cirurgias com data após o período filtrado) | **Valor Previsto** (soma de Valor Fechado futuro) | **Ticket Médio**.
Abaixo, **PIPELINE: PRÓXIMOS MESES**: 3 cards (mês seguinte, +2, +3), cada um com nome do mês/ano, nº de procedimentos e faturamento previsto.

### 4.7 ORIGEM DOS CLIENTES
Gráfico de barras horizontais por Origem (ANÚNCIO/ADS, INDICAÇÃO, INSTAGRAM, BASE), com **toggle Quantidade / Faturamento**. Eixo em R$ quando Faturamento.

### 4.8 LEADS NO PERÍODO
Tabela com contador ("10 leads"), colunas: **Nome do Lead | Doutor | Data da Consulta | Data da Venda | Data da Cirurgia | Procedimento | Valor Fechado | Status** (badge colorido). Ordenar por data da consulta (mais recente primeiro), com busca por nome, filtro por status e paginação. Datas no formato "25 ago 2026"; vazio = "—". Exportar CSV.

### 4.9 EVOLUÇÃO E METAS (seção extra, abaixo)
- Barra de progresso do **Caixa vs. Meta Mínima / Ideal / Supermeta** do mês.
- Gráfico semanal (da aba ACOMPANHAMENTO): consultas, comparecimentos, vendas e cirurgias por semana.
- Funil: Consultas → Comparecimentos → Vendas → Cirurgias realizadas.

### 4.10 VISÃO DA CARTEIRA (quando Cliente = Todos)
Tabela comparativa por cliente com: consultas, comparecimento %, conversão %, vendas, faturamento, caixa recebido, % da meta e um **semáforo de saúde** (verde ≥ 100% da meta mínima, amarelo 60-99%, vermelho < 60%). Clicar numa linha filtra o dashboard para aquele cliente.

---

## 5. DESIGN

- Visual limpo, claro e profissional, estilo dashboard SaaS moderno: fundo off-white, cards brancos com borda sutil e cantos bem arredondados (rounded-2xl), tipografia Inter, números grandes em semibold, rótulos pequenos em cinza.
- Cada grupo de cards tem tom pastel próprio (azul, verde, laranja, rosa, verde-água, roxo) com ícone dentro de um quadrado arredondado. Paleta de apoio na identidade da Atlas (tons de azul-petróleo/teal para gráficos).
- Responsivo (desktop primeiro, mas legível no celular e tablet), com grid de 3 colunas no desktop e 1 no mobile.
- Estados de carregamento (skeleton), vazio e erro bem tratados.
- **Impressão/PDF**: botão "Exportar PDF" que gera o painel do cliente e período selecionados em formato A4 com o logo da Atlas no topo e rodapé (usado nos relatórios semanais enviados ao cliente).
- Valores sempre em **R$ 0.000,00** (pt-BR), percentuais com 1 casa ("66,7%").

---

## 6. ACESSO E PERMISSÕES

- Login com Supabase Auth (e-mail/senha ou Google), restrito ao domínio corporativo da Atlas.
- Papéis: `admin` (gerencia clientes, configurações e lançamentos), `equipe` (vê todos os clientes), `cliente` (vê **somente o próprio painel**, opcional, via link/rota `/c/[token]` somente leitura, sem filtros de outros clientes).
- RLS ativo em todas as tabelas.

---

## 7. ORDEM DE CONSTRUÇÃO SUGERIDA

1. Schema do Supabase + tela `/clientes`.
2. Edge Function `sync-portais` (leitura de `VENDAS MÊS` e `PAINEL DE RESULTADOS`) + parsers pt-BR + cron.
3. Dashboard de um cliente com todos os blocos da seção 4 usando os dados sincronizados.
4. Visão consolidada da carteira + filtros por Hunter/Performance.
5. Lançamento de investimento (Anúncios) + exportação em PDF.
6. Acompanhamento semanal e metas.

Antes de gerar o código, me confirme o schema das tabelas e os secrets necessários (credencial da Service Account do Google, URL e chaves do Supabase).

---

## 8. REGRAS DE QUALIDADE

- Nunca inventar valores: dado ausente aparece como "—" e não entra em somas de forma silenciosa.
- Toda métrica deve poder ser auditada: ao clicar num card, abrir a lista de linhas da planilha que compõem aquele número.
- Cabeçalhos das planilhas podem ter espaços extras e variações de caixa; comparar sempre normalizando (trim, minúsculas, sem acento).
- Tabela de logs de sync (`sync_logs`: cliente, início, fim, linhas lidas, erro) visível ao admin.

**Dados para cadastrar inicialmente** (nome, `spreadsheet_id`, hunter, performance):
Dr. Victor Hugo (1UmGuqYKKLXTHPXrCM-_KNH3F1RkUl1mOL07gJUPzU1I, Júlia, Vinícius, layout antigo) · Dr. Eriel (1bXMEa5bQ8S-YGedcPlv86QjALdH1czDrOELJw-q6gq4, Júlia, Vinícius) · Dr. Lucas Bois (1e_m_rA3niNEARagPq30tu5qlG_Zz5sKlVkICf1A9Aj0, Júlia, Vinícius) · Dra. Bruna Barcelos (1HXUWc0pO0rTzdCBQdZXhjDv4PztAAYbzfJ0QN68MYPI, Daisa, Vinícius) · Dr. João Vitor (1udKlgCU8_IFvSi9j1fUkoW2L3te75vpzjxwLEPeudwU, Daisa, Vinícius) · Dra. Priscila Martelli (1WZabkVH-vGQVqy7m5NGc--cT4KPFI_WXYRpg9AfYj2w, Daisa, Vinícius) · Dra. Alessandra Santana (12rdmKkzPChI2mc3CWh2ZtJ0qY6BM_8ZnUfJ5OHUtyek, Fabi, Vinícius, layout antigo) · Dr. Wanderley (1Oj3-W_0Fa232naGSgi7tEMCBy7ltMWKpMcIO68VAbrI, Fabi, Vinícius) · Dr. Danilo Blanco (1-4PUyB2HUdG0Mfstbqxk-GvWiS-96qXBPJsml84dWnE, Fabi, Vinícius) · Dra. Thamyrys Prado (1xcLs-fiGQ9gSrWxPh-lRwCpC80GCLLK5C1Av6bBih5g, Pamela, Vinícius) · Dr. Matheus Pereira (1xdax7JWcg4bG5b4Yv4HTE8iZmkRBSjs9p6Zz2B9OFKk, Pamela, Vinícius).

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://atlasds.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/a701e888-1015-4fea-a124-2511a1e7386a).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
