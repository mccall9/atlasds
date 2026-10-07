# Atlas | Painel de Resultados — confirmação de schema e credenciais

## Conexão com as planilhas
- **Recomendado:** usar o conector Google Sheets do Lovable com a conta corporativa da Atlas (a alternativa por OAuth que você aceitou). Não precisa criar Service Account nem colar JSON: você autoriza uma vez e cada Portal precisa estar acessível para essa conta. A leitura é feita só no servidor, a chave nunca chega ao navegador.
- **Alternativa:** Service Account. Nesse caso peço o secret `GOOGLE_SERVICE_ACCOUNT_JSON`, e cada Portal é compartilhado como Leitor com o e-mail dela.
- O app só lê os Portais (values.batchGet). Nunca escreve, cria ou renomeia nada.

## Credenciais necessárias
| Item | Origem |
|---|---|
| URL e chaves do backend | Automáticas (Lovable Cloud), nada para colar |
| Acesso ao Google Sheets | Conector (recomendado) ou `GOOGLE_SERVICE_ACCOUNT_JSON` |
| Segredo do cron | Gerado automaticamente (`CRON_SECRET`) |
| Login Google | Gerenciado pelo Lovable Cloud |

## Schema (todas as tabelas com RLS)
```text
clientes(id uuid pk, nome text, ativo bool, spreadsheet_id text unique,
  hunter text, performance text, layout text check in('atual','antigo'),
  meta_mensal_override numeric null, share_token text unique null, created_at)

vendas(id, cliente_id fk, linha_planilha int, lead_nome, status,
  data_consulta date, consultas numeric, comparecimentos numeric default 0,
  vendas numeric, data_venda date, data_cirurgia date, origem, procedimento,
  orcamento numeric, valor_fechado numeric, pago_100 bool, caixa_recebido numeric,
  comissao_atlas numeric, comissao_hunter numeric, comissao_extra numeric,
  observacoes, synced_at)

metas(id, cliente_id, ano int, mes int (1-12, 0 = total acumulado),
  meta_minima, meta_ideal, supermeta, alcancado,
  meta_consultas, meta_vendas, meta_cirurgias)  unique(cliente_id, ano, mes)

acompanhamento(id, cliente_id, semana_label, semana_inicio date null,
  consultas_agendadas, comparecimentos, vendas, cirurgias, raw jsonb)

regras_procedimentos(id, cliente_id, procedimento, valor_minimo, valor_maximo,
  formas_pagamento, permite_desconto_av, regras_parcelamento, sinal_percentual null)
info_gerais(cliente_id, chave, valor)

investimento_anuncios(id, cliente_id, data date, plataforma ('meta'|'google'),
  valor_investido numeric, conversas_iniciadas int, created_by)

configuracoes(id=1, pct_total 5, pct_hunter 3, pct_performance 1, pct_atlas 1,
  dominio_permitido text)

sync_logs(id, cliente_id null, inicio, fim, linhas_lidas int, status, erro text)

user_roles(user_id, role app_role: 'admin'|'equipe'|'cliente')
user_clientes(user_id, cliente_id)   -- vincula usuário "cliente" ao próprio painel
```
- Sync: apaga e regrava as linhas do cliente a cada leitura (espelho fiel). Valores vazios ficam `null`, exceto Comparecimentos = 0.
- Os 11 clientes iniciais entram já cadastrados (Victor Hugo e Alessandra Santana com layout antigo).

## Permissões
- `admin`: clientes, configurações, lançamentos de investimento, logs.
- `equipe`: lê tudo.
- `cliente`: lê só o próprio cliente; link público `/c/[token]` mostra só aquele painel.
- Login por e-mail/senha ou Google, bloqueado fora do domínio configurado.

## Ajuste técnico em relação ao prompt
O projeto roda em TanStack Start, então a "Edge Function sync-portais" vira uma função de servidor do próprio app, mais um endereço protegido por segredo chamado pelo cron a cada 15 min. O resultado é o mesmo.

## Ordem de construção
1. Schema + dados iniciais + tela `/clientes` + login/papéis.
2. Sync (VENDAS MÊS, PAINEL DE RESULTADOS, ACOMPANHAMENTO, TABELA E REGRAS) com parsers pt-BR, botão "Atualizar agora", cron, logs.
3. Dashboard completo (seções 4.1–4.10), filtros na URL, auditoria por card.
4. Lançamento de investimento (formulário + CSV), configurações, exportar PDF/CSV, link do cliente.

## Pendências para você
- Qual domínio de e-mail da Atlas libera o login? (ex.: @atlasassessoria.com.br)
- Confirmar: conector Google (recomendado) ou Service Account?
