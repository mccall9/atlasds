ALTER TABLE public.investimento_anuncios ADD COLUMN origem text NOT NULL DEFAULT 'manual';
ALTER TABLE public.investimento_anuncios ADD COLUMN meta_ad_account_id text;
ALTER TABLE public.investimento_anuncios ADD COLUMN atualizado_em timestamptz;
CREATE UNIQUE INDEX investimento_anuncios_meta_dia ON public.investimento_anuncios (meta_ad_account_id, data);
ALTER TABLE public.meta_conexao ADD COLUMN last_import_at timestamptz;
ALTER TABLE public.meta_conexao ADD COLUMN last_import_error text;