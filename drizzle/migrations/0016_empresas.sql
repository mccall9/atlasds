-- A second company (barbershops) shares the panel. Rows are scoped by empresa; 'gestor' users see and manage only the barbershops.
ALTER TABLE public.clientes ADD COLUMN empresa text NOT NULL DEFAULT 'atlas' CHECK (empresa IN ('atlas', 'barbearias'));
ALTER TABLE public.clientes ALTER COLUMN spreadsheet_id DROP NOT NULL;
ALTER TABLE public.crm_webhooks ADD COLUMN empresa text NOT NULL DEFAULT 'atlas' CHECK (empresa IN ('atlas', 'barbearias'));

CREATE OR REPLACE FUNCTION public.is_gestor(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'gestor')
$$;

CREATE OR REPLACE FUNCTION public.is_barbearia(_cliente_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO public AS $$
  SELECT EXISTS (SELECT 1 FROM public.clientes WHERE id = _cliente_id AND empresa = 'barbearias')
$$;

-- Atlas staff, linked doctors and hunters see Atlas clients; gestores see only barbershops; admins see both.
CREATE OR REPLACE FUNCTION public.can_view_cliente(_cliente_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clientes c WHERE c.id = _cliente_id AND (
      public.has_role(auth.uid(), 'admin')
      OR (c.empresa = 'atlas' AND (
        public.is_staff(auth.uid())
        OR EXISTS (SELECT 1 FROM public.user_clientes WHERE user_id = auth.uid() AND cliente_id = c.id)
        OR EXISTS (SELECT 1 FROM public.hunter_users h WHERE h.user_id = auth.uid() AND h.hunter = c.hunter)))
      OR (c.empresa = 'barbearias' AND public.is_gestor(auth.uid()))
    )
  )
$$;

CREATE POLICY "gestor insert barbearias" ON public.clientes FOR INSERT TO authenticated WITH CHECK (empresa = 'barbearias' AND public.is_gestor(auth.uid()));
CREATE POLICY "gestor update barbearias" ON public.clientes FOR UPDATE TO authenticated USING (empresa = 'barbearias' AND public.is_gestor(auth.uid())) WITH CHECK (empresa = 'barbearias' AND public.is_gestor(auth.uid()));
CREATE POLICY "gestor delete barbearias" ON public.clientes FOR DELETE TO authenticated USING (empresa = 'barbearias' AND public.is_gestor(auth.uid()));

CREATE POLICY "gestor read crm webhooks" ON public.crm_webhooks FOR SELECT TO authenticated USING (empresa = 'barbearias' AND public.is_gestor(auth.uid()));
CREATE POLICY "gestor insert crm webhooks" ON public.crm_webhooks FOR INSERT TO authenticated
  WITH CHECK (empresa = 'barbearias' AND public.is_gestor(auth.uid()) AND (cliente_id IS NULL OR public.is_barbearia(cliente_id)));
CREATE POLICY "gestor update crm webhooks" ON public.crm_webhooks FOR UPDATE TO authenticated
  USING (empresa = 'barbearias' AND public.is_gestor(auth.uid()))
  WITH CHECK (empresa = 'barbearias' AND public.is_gestor(auth.uid()) AND (cliente_id IS NULL OR public.is_barbearia(cliente_id)));
CREATE POLICY "gestor delete crm webhooks" ON public.crm_webhooks FOR DELETE TO authenticated USING (empresa = 'barbearias' AND public.is_gestor(auth.uid()));
CREATE POLICY "gestor read crm leads" ON public.crm_leads FOR SELECT TO authenticated
  USING (public.is_gestor(auth.uid()) AND EXISTS (SELECT 1 FROM public.crm_webhooks w WHERE w.id = webhook_id AND w.empresa = 'barbearias'));
CREATE POLICY "gestor delete crm leads" ON public.crm_leads FOR DELETE TO authenticated
  USING (public.is_gestor(auth.uid()) AND EXISTS (SELECT 1 FROM public.crm_webhooks w WHERE w.id = webhook_id AND w.empresa = 'barbearias'));

CREATE POLICY "gestor read meta contas" ON public.meta_contas_anuncio FOR SELECT TO authenticated USING (public.is_gestor(auth.uid()) AND public.is_barbearia(cliente_id));
CREATE POLICY "gestor insert meta contas" ON public.meta_contas_anuncio FOR INSERT TO authenticated WITH CHECK (public.is_gestor(auth.uid()) AND public.is_barbearia(cliente_id));
CREATE POLICY "gestor update meta contas" ON public.meta_contas_anuncio FOR UPDATE TO authenticated
  USING (public.is_gestor(auth.uid()) AND public.is_barbearia(cliente_id)) WITH CHECK (public.is_gestor(auth.uid()) AND public.is_barbearia(cliente_id));
CREATE POLICY "gestor delete meta contas" ON public.meta_contas_anuncio FOR DELETE TO authenticated USING (public.is_gestor(auth.uid()) AND public.is_barbearia(cliente_id));

-- One Meta connection per company: id 1 = Atlas, id 2 = barbershops.
ALTER TABLE public.meta_conexao DROP CONSTRAINT IF EXISTS meta_conexao_id_check;
ALTER TABLE public.meta_conexao ADD CONSTRAINT meta_conexao_id_check CHECK (id IN (1, 2));
ALTER TABLE public.meta_oauth_states ADD COLUMN empresa text NOT NULL DEFAULT 'atlas' CHECK (empresa IN ('atlas', 'barbearias'));

-- Admin-managed invitations: an invited, verified e-mail becomes a gestor on first login, whatever its domain.
CREATE TABLE public.convites_acesso (
  email text PRIMARY KEY CHECK (email = lower(trim(email)) AND email LIKE '%_@_%'),
  empresa text NOT NULL DEFAULT 'barbearias' CHECK (empresa = 'barbearias'),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.convites_acesso TO authenticated;
GRANT ALL ON public.convites_acesso TO service_role;
ALTER TABLE public.convites_acesso ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read convites" ON public.convites_acesso FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin insert convites" ON public.convites_acesso FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin delete convites" ON public.convites_acesso FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.claim_access() RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public AS $$
DECLARE uid uuid := auth.uid(); em text; dom text; verified timestamptz;
BEGIN
 IF uid IS NULL THEN RETURN 'none'; END IF;
 IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = uid) THEN
  RETURN (SELECT role::text FROM public.user_roles WHERE user_id = uid ORDER BY role LIMIT 1);
 END IF;
 SELECT email, email_confirmed_at INTO em, verified FROM auth.users WHERE id = uid;
 IF verified IS NULL THEN RETURN 'none'; END IF;
 IF EXISTS (SELECT 1 FROM public.convites_acesso WHERE email = lower(em)) THEN
  INSERT INTO public.user_roles(user_id, role) VALUES (uid, 'gestor');
  RETURN 'gestor';
 END IF;
 SELECT dominio_permitido INTO dom FROM public.configuracoes WHERE id = 1;
 IF dom IS NULL OR trim(dom) = '' OR lower(split_part(em,'@',2)) <> lower(trim(leading '@' from trim(dom))) THEN RETURN 'none'; END IF;
 IF lower(em) IN ('julia@assessoriaatlas.com','daisa@assessoriaatlas.com','fabi@assessoriaatlas.com','pamela@assessoriaatlas.com') THEN
  INSERT INTO public.user_roles(user_id,role) VALUES (uid,'cliente');
  RETURN 'cliente';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
  INSERT INTO public.user_roles(user_id,role) VALUES (uid,'admin'); RETURN 'admin';
 END IF;
 INSERT INTO public.user_roles(user_id,role) VALUES (uid,'equipe'); RETURN 'equipe';
END $$;
