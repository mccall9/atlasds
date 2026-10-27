-- The barbershop company moved to its own project (Painel Barbearias); this panel serves only Atlas again.
-- The 'gestor' enum value stays (Postgres cannot drop enum values) but no role or policy uses it.
CREATE OR REPLACE FUNCTION public.can_view_cliente(_cliente_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO public AS $$
 SELECT public.is_staff(auth.uid())
 OR EXISTS (SELECT 1 FROM public.user_clientes WHERE user_id = auth.uid() AND cliente_id = _cliente_id)
 OR EXISTS (SELECT 1 FROM public.hunter_users h JOIN public.clientes c ON c.hunter = h.hunter WHERE h.user_id = auth.uid() AND c.id = _cliente_id)
$$;

CREATE OR REPLACE FUNCTION public.claim_access() RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public AS $$
DECLARE uid uuid := auth.uid(); em text; dom text; verified timestamptz;
BEGIN
 IF uid IS NULL THEN RETURN 'none'; END IF;
 IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = uid) THEN
  RETURN (SELECT role::text FROM public.user_roles WHERE user_id = uid ORDER BY role LIMIT 1);
 END IF;
 SELECT email, email_confirmed_at INTO em, verified FROM auth.users WHERE id = uid;
 SELECT dominio_permitido INTO dom FROM public.configuracoes WHERE id = 1;
 IF verified IS NULL OR dom IS NULL OR trim(dom) = '' OR lower(split_part(em,'@',2)) <> lower(trim(leading '@' from trim(dom))) THEN RETURN 'none'; END IF;
 IF lower(em) IN ('julia@assessoriaatlas.com','daisa@assessoriaatlas.com','fabi@assessoriaatlas.com','pamela@assessoriaatlas.com') THEN
  INSERT INTO public.user_roles(user_id,role) VALUES (uid,'cliente');
  RETURN 'cliente';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
  INSERT INTO public.user_roles(user_id,role) VALUES (uid,'admin'); RETURN 'admin';
 END IF;
 INSERT INTO public.user_roles(user_id,role) VALUES (uid,'equipe'); RETURN 'equipe';
END $$;

DROP POLICY IF EXISTS "gestor insert barbearias" ON public.clientes;
DROP POLICY IF EXISTS "gestor update barbearias" ON public.clientes;
DROP POLICY IF EXISTS "gestor delete barbearias" ON public.clientes;
DROP POLICY IF EXISTS "gestor read crm webhooks" ON public.crm_webhooks;
DROP POLICY IF EXISTS "gestor insert crm webhooks" ON public.crm_webhooks;
DROP POLICY IF EXISTS "gestor update crm webhooks" ON public.crm_webhooks;
DROP POLICY IF EXISTS "gestor delete crm webhooks" ON public.crm_webhooks;
DROP POLICY IF EXISTS "gestor read crm leads" ON public.crm_leads;
DROP POLICY IF EXISTS "gestor delete crm leads" ON public.crm_leads;
DROP POLICY IF EXISTS "gestor read meta contas" ON public.meta_contas_anuncio;
DROP POLICY IF EXISTS "gestor insert meta contas" ON public.meta_contas_anuncio;
DROP POLICY IF EXISTS "gestor update meta contas" ON public.meta_contas_anuncio;
DROP POLICY IF EXISTS "gestor delete meta contas" ON public.meta_contas_anuncio;
DROP FUNCTION IF EXISTS public.is_barbearia(uuid);
DROP FUNCTION IF EXISTS public.is_gestor(uuid);
DROP TABLE IF EXISTS public.convites_acesso;

DELETE FROM public.meta_conexao WHERE id <> 1;
ALTER TABLE public.meta_conexao DROP CONSTRAINT IF EXISTS meta_conexao_id_check;
ALTER TABLE public.meta_conexao ADD CONSTRAINT meta_conexao_id_check CHECK (id = 1);
ALTER TABLE public.meta_oauth_states DROP COLUMN IF EXISTS empresa;
ALTER TABLE public.crm_webhooks DROP COLUMN IF EXISTS empresa;
ALTER TABLE public.clientes DROP COLUMN IF EXISTS empresa;
ALTER TABLE public.clientes ALTER COLUMN spreadsheet_id SET NOT NULL;
