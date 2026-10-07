
create type public.app_role as enum ('admin','equipe','cliente');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  unique(user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;
create or replace function public.is_staff(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role in ('admin','equipe'))
$$;

create policy "own roles or admin" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ativo boolean not null default true,
  spreadsheet_id text not null unique,
  hunter text,
  performance text,
  layout text not null default 'atual' check (layout in ('atual','antigo')),
  meta_mensal_override numeric,
  share_token text unique,
  last_sync_at timestamptz,
  last_sync_error text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.clientes to authenticated;
grant all on public.clientes to service_role;
alter table public.clientes enable row level security;

create table public.user_clientes (
  user_id uuid not null references auth.users(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  primary key (user_id, cliente_id)
);
grant select on public.user_clientes to authenticated;
grant all on public.user_clientes to service_role;
alter table public.user_clientes enable row level security;
create policy "own links or admin" on public.user_clientes for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create or replace function public.can_view_cliente(_cliente_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_staff(auth.uid())
    or exists (select 1 from public.user_clientes where user_id = auth.uid() and cliente_id = _cliente_id)
$$;

create policy "view clientes" on public.clientes for select to authenticated using (public.can_view_cliente(id));
create policy "admin insert clientes" on public.clientes for insert to authenticated with check (public.has_role(auth.uid(),'admin'));
create policy "admin update clientes" on public.clientes for update to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "admin delete clientes" on public.clientes for delete to authenticated using (public.has_role(auth.uid(),'admin'));

create table public.vendas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  linha_planilha int,
  lead_nome text not null,
  status text,
  data_consulta date,
  consultas numeric,
  comparecimentos numeric not null default 0,
  vendas numeric,
  data_venda date,
  data_cirurgia date,
  origem text,
  procedimento text,
  orcamento numeric,
  valor_fechado numeric,
  pago_100 boolean,
  caixa_recebido numeric,
  comissao_atlas numeric,
  comissao_hunter numeric,
  comissao_extra numeric,
  observacoes text,
  synced_at timestamptz not null default now()
);
create index on public.vendas(cliente_id);
create index on public.vendas(data_consulta);
create index on public.vendas(data_venda);
create index on public.vendas(data_cirurgia);

create table public.metas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  ano int not null,
  mes int not null,
  meta_minima numeric, meta_ideal numeric, supermeta numeric, alcancado numeric,
  meta_consultas numeric, meta_vendas numeric, meta_cirurgias numeric,
  unique(cliente_id, ano, mes)
);

create table public.acompanhamento (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  ordem int not null default 0,
  semana_label text,
  semana_inicio date,
  consultas_agendadas numeric, comparecimentos numeric, vendas numeric, cirurgias numeric,
  raw jsonb
);

create table public.regras_procedimentos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  procedimento text not null,
  valor_minimo numeric, valor_maximo numeric,
  formas_pagamento text, permite_desconto_av text, regras_parcelamento text, sinal_percentual text
);

create table public.info_gerais (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  chave text, valor text
);

create table public.investimento_anuncios (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  data date not null,
  plataforma text not null check (plataforma in ('meta','google')),
  valor_investido numeric not null default 0,
  conversas_iniciadas int not null default 0,
  created_by uuid,
  created_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['vendas','metas','acompanhamento','regras_procedimentos','info_gerais','investimento_anuncios'] loop
    execute format('grant select on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "view %s" on public.%I for select to authenticated using (public.can_view_cliente(cliente_id))', t, t);
  end loop;
end $$;

grant insert, update, delete on public.investimento_anuncios to authenticated;
create policy "admin insert inv" on public.investimento_anuncios for insert to authenticated with check (public.has_role(auth.uid(),'admin'));
create policy "admin update inv" on public.investimento_anuncios for update to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "admin delete inv" on public.investimento_anuncios for delete to authenticated using (public.has_role(auth.uid(),'admin'));

create table public.configuracoes (
  id int primary key default 1 check (id = 1),
  pct_total numeric not null default 5,
  pct_hunter numeric not null default 3,
  pct_performance numeric not null default 1,
  pct_atlas numeric not null default 1,
  dominio_permitido text,
  updated_at timestamptz not null default now()
);
grant select, update on public.configuracoes to authenticated;
grant all on public.configuracoes to service_role;
alter table public.configuracoes enable row level security;
create policy "auth read config" on public.configuracoes for select to authenticated using (true);
create policy "admin update config" on public.configuracoes for update to authenticated using (public.has_role(auth.uid(),'admin'));
insert into public.configuracoes (id) values (1);

create table public.sync_logs (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references public.clientes(id) on delete cascade,
  inicio timestamptz not null default now(),
  fim timestamptz,
  linhas_lidas int,
  status text not null default 'executando',
  erro text
);
grant select on public.sync_logs to authenticated;
grant all on public.sync_logs to service_role;
alter table public.sync_logs enable row level security;
create policy "staff read logs" on public.sync_logs for select to authenticated using (public.is_staff(auth.uid()));

-- Access claim: first user = admin; allowed domain = equipe
create or replace function public.claim_access()
returns text language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); em text; dom text;
begin
  if uid is null then return 'none'; end if;
  if exists (select 1 from user_roles where user_id = uid) then
    return (select role::text from user_roles where user_id = uid order by role limit 1);
  end if;
  if not exists (select 1 from user_roles where role = 'admin') then
    insert into user_roles(user_id, role) values (uid, 'admin');
    return 'admin';
  end if;
  select email into em from auth.users where id = uid;
  select dominio_permitido into dom from configuracoes where id = 1;
  if dom is not null and dom <> '' and lower(em) like '%@' || lower(trim(leading '@' from dom)) then
    insert into user_roles(user_id, role) values (uid, 'equipe');
    return 'equipe';
  end if;
  return 'none';
end $$;
grant execute on function public.claim_access() to authenticated;

insert into public.clientes (nome, spreadsheet_id, hunter, performance, layout) values
('Dr. Victor Hugo','1UmGuqYKKLXTHPXrCM-_KNH3F1RkUl1mOL07gJUPzU1I','Júlia','Vinícius','antigo'),
('Dr. Eriel','1bXMEa5bQ8S-YGedcPlv86QjALdH1czDrOELJw-q6gq4','Júlia','Vinícius','atual'),
('Dr. Lucas Bois','1e_m_rA3niNEARagPq30tu5qlG_Zz5sKlVkICf1A9Aj0','Júlia','Vinícius','atual'),
('Dra. Bruna Barcelos','1HXUWc0pO0rTzdCBQdZXhjDv4PztAAYbzfJ0QN68MYPI','Daisa','Vinícius','atual'),
('Dr. João Vitor','1udKlgCU8_IFvSi9j1fUkoW2L3te75vpzjxwLEPeudwU','Daisa','Vinícius','atual'),
('Dra. Priscila Martelli','1WZabkVH-vGQVqy7m5NGc--cT4KPFI_WXYRpg9AfYj2w','Daisa','Vinícius','atual'),
('Dra. Alessandra Santana','12rdmKkzPChI2mc3CWh2ZtJ0qY6BM_8ZnUfJ5OHUtyek','Fabi','Vinícius','antigo'),
('Dr. Wanderley','1Oj3-W_0Fa232naGSgi7tEMCBy7ltMWKpMcIO68VAbrI','Fabi','Vinícius','atual'),
('Dr. Danilo Blanco','1-4PUyB2HUdG0Mfstbqxk-GvWiS-96qXBPJsml84dWnE','Fabi','Vinícius','atual'),
('Dra. Thamyrys Prado','1xcLs-fiGQ9gSrWxPh-lRwCpC80GCLLK5C1Av6bBih5g','Pamela','Vinícius','atual'),
('Dr. Matheus Pereira','1xdax7JWcg4bG5b4Yv4HTE8iZmkRBSjs9p6Zz2B9OFKk','Pamela','Vinícius','atual');
