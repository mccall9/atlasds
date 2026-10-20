CREATE TABLE public.meta_oauth_states (
  state text PRIMARY KEY,
  user_id uuid NOT NULL,
  redirect_uri text NOT NULL,
  return_origin text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '10 minutes'
);
GRANT ALL ON public.meta_oauth_states TO service_role;
ALTER TABLE public.meta_oauth_states ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.meta_conexao (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  meta_user_id text NOT NULL,
  meta_user_name text,
  access_token text NOT NULL,
  token_expires_at timestamptz,
  scopes text,
  connected_by uuid,
  connected_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.meta_conexao TO service_role;
ALTER TABLE public.meta_conexao ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.meta_contas_anuncio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  ad_account_id text NOT NULL UNIQUE,
  nome text,
  moeda text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_contas_anuncio TO authenticated;
GRANT ALL ON public.meta_contas_anuncio TO service_role;
ALTER TABLE public.meta_contas_anuncio ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read meta contas" ON public.meta_contas_anuncio FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin insert meta contas" ON public.meta_contas_anuncio FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin update meta contas" ON public.meta_contas_anuncio FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin delete meta contas" ON public.meta_contas_anuncio FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));