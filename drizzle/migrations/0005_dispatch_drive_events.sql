CREATE OR REPLACE FUNCTION public.dispatch_portal_drive_worker(_secret text) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE request_id bigint;
BEGIN
 IF _secret IS NULL OR length(_secret)<20 THEN RAISE EXCEPTION 'Invalid notification authorization'; END IF;
 SELECT net.http_post(
 url:='https://project--a701e888-1015-4fea-a124-2511a1e7386a.lovable.app/api/public/cron/drive-changes',
 headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||_secret),
 body:='{}'::jsonb,timeout_milliseconds:=120000) INTO request_id;
 RETURN request_id;
END; $$;
REVOKE ALL ON FUNCTION public.dispatch_portal_drive_worker(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_portal_drive_worker(text) TO service_role;