CREATE TABLE public.hunter_users (user_id uuid PRIMARY KEY, hunter text NOT NULL);
GRANT SELECT ON public.hunter_users TO authenticated;
GRANT ALL ON public.hunter_users TO service_role;
ALTER TABLE public.hunter_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own hunter assignment or admin" ON public.hunter_users FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
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