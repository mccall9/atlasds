import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/atlas/AppShell";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar · Atlas | Painel de Resultados" },
      { name: "description", content: "Acesso da equipe Atlas ao painel de resultados." },
      { property: "og:title", content: "Entrar · Atlas | Painel de Resultados" },
      { property: "og:description", content: "Acesso da equipe Atlas ao painel de resultados." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        nav({ to: "/painel" });
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
        if (error) throw error;
        if (data.session) nav({ to: "/painel" });
        else toast.success("Conta criada. Confirme pelo link enviado ao seu e-mail.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível entrar");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin, extraParams: { hd: "assessoriaatlas.com", prompt: "select_account" } });
    if (r.error) { toast.error("Falha no login com Google"); return; }
    if (r.redirected) { return; }
    nav({ to: "/painel" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-8 shadow-sm">
        <Logo />
        <h1 className="mt-6 text-xl font-semibold">Painel de Resultados</h1>
        <p className="mt-1 text-sm text-muted-foreground">Acesso restrito à equipe Atlas (@assessoriaatlas.com).</p>
        <Button variant="outline" className="mt-6 w-full" onClick={google}>Continuar com Google</Button>
        <div className="my-5 text-center text-xs text-muted-foreground">ou</div>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5"><Label>E-mail</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Senha</Label><Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          <Button className="w-full" disabled={busy}>{mode === "login" ? "Entrar" : "Criar conta"}</Button>
        </form>
        <button className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
          {mode === "login" ? "Primeiro acesso? Criar conta" : "Já tenho conta"}
        </button>
      </div>
    </div>
  );
}
