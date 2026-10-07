CREATE TABLE public.portal_drive_watches (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
 spreadsheet_id text NOT NULL,
 callback_url text NOT NULL,
 resource_id text,
 token_hash text NOT NULL,
 expires_at timestamptz NOT NULL,
 last_message numeric NOT NULL DEFAULT 0,
 pending_at timestamptz,
 last_version text,
 last_error text,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.portal_drive_watches TO service_role;
ALTER TABLE public.portal_drive_watches ENABLE ROW LEVEL SECURITY;
CREATE INDEX portal_drive_pending ON public.portal_drive_watches(pending_at);
CREATE TABLE public.portal_sync_leases (
 cliente_id uuid PRIMARY KEY REFERENCES public.clientes(id) ON DELETE CASCADE,
 lease_token uuid NOT NULL,
 expires_at timestamptz NOT NULL
);
GRANT ALL ON public.portal_sync_leases TO service_role;
ALTER TABLE public.portal_sync_leases ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.acquire_portal_sync(_cliente_id uuid, _token uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE acquired uuid;
BEGIN
 INSERT INTO public.portal_sync_leases(cliente_id,lease_token,expires_at)
 VALUES (_cliente_id,_token,now()+interval '5 minutes')
 ON CONFLICT(cliente_id) DO UPDATE SET lease_token=EXCLUDED.lease_token,expires_at=EXCLUDED.expires_at
 WHERE portal_sync_leases.expires_at < now()
 RETURNING lease_token INTO acquired;
 RETURN acquired IS NOT NULL;
END; $$;
REVOKE ALL ON FUNCTION public.acquire_portal_sync(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_portal_sync(uuid,uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.receive_portal_drive_event(_id uuid,_hash text,_resource text,_message numeric,_changed boolean) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE accepted uuid;
BEGIN
 UPDATE public.portal_drive_watches SET last_message=_message,
 pending_at=CASE WHEN _changed THEN now() ELSE pending_at END
 WHERE id=_id AND token_hash=_hash AND (resource_id IS NULL OR resource_id=_resource)
 AND expires_at > now() AND last_message < _message
 RETURNING id INTO accepted;
 RETURN accepted IS NOT NULL;
END; $$;
REVOKE ALL ON FUNCTION public.receive_portal_drive_event(uuid,text,text,numeric,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.receive_portal_drive_event(uuid,text,text,numeric,boolean) TO service_role;