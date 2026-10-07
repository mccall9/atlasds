import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Poll only small mirrored status rows, never Google Sheets from the browser.
export function usePanelFreshness() {
  const client = useQueryClient();
  const previous = useRef<string | undefined>(undefined);
  const status = useQuery({
    queryKey: ["panel-freshness"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clientes")
        .select("id,last_sync_at,last_sync_error").eq("ativo", true).order("id");
      if (error) throw error;
      return JSON.stringify(data);
    },
    refetchInterval: (query) => query.state.error ? false : 30_000,
    retry: false,
  });
  useEffect(() => {
    if (status.data === undefined) return;
    if (previous.current !== undefined && previous.current !== status.data) {
      void client.invalidateQueries({ queryKey: ["panel"] });
      void client.invalidateQueries({ queryKey: ["clientes"] });
    }
    previous.current = status.data;
  }, [status.data, client]);
}