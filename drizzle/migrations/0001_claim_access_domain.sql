create or replace function public.claim_access()
returns text language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); em text; dom text; ok boolean;
begin
  if uid is null then return 'none'; end if;
  if exists (select 1 from user_roles where user_id = uid) then
    return (select role::text from user_roles where user_id = uid order by role limit 1);
  end if;
  select email into em from auth.users where id = uid;
  select dominio_permitido into dom from configuracoes where id = 1;
  ok := dom is not null and dom <> '' and lower(em) like '%@' || lower(trim(leading '@' from dom));
  if not ok then return 'none'; end if;
  if not exists (select 1 from user_roles where role = 'admin') then
    insert into user_roles(user_id, role) values (uid, 'admin');
    return 'admin';
  end if;
  insert into user_roles(user_id, role) values (uid, 'equipe');
  return 'equipe';
end $$;