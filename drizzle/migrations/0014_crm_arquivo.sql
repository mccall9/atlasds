-- 'arquivo' marks sources fed by uploading the CRM export in the panel.
ALTER TABLE public.crm_webhooks ADD COLUMN tipo text;
