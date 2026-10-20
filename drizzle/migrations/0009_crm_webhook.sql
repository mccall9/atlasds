CREATE TABLE public.crm_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  token text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  ativo boolean NOT NULL DEFAULT true,
  ultimo_recebimento timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_webhooks TO authenticated;
GRANT ALL ON public.crm_webhooks TO service_role;
ALTER TABLE public.crm_webhooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read crm webhooks" ON public.crm_webhooks FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin insert crm webhooks" ON public.crm_webhooks FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin update crm webhooks" ON public.crm_webhooks FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin delete crm webhooks" ON public.crm_webhooks FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Leads received from the CRM; written only by the public webhook route (service_role).
CREATE TABLE public.crm_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id uuid NOT NULL REFERENCES public.crm_webhooks(id) ON DELETE CASCADE,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  external_id text,
  nome text,
  telefone text,
  email text,
  campanha text,
  origem text,
  etapa text,
  valor numeric,
  payload jsonb NOT NULL,
  recebido_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX crm_leads_webhook_external ON public.crm_leads (webhook_id, external_id);
CREATE INDEX crm_leads_recebido ON public.crm_leads (recebido_em);
GRANT SELECT, DELETE ON public.crm_leads TO authenticated;
GRANT ALL ON public.crm_leads TO service_role;
ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read crm leads" ON public.crm_leads FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin delete crm leads" ON public.crm_leads FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
