import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/atlas/AppShell";
import { ThemeToggle } from "@/components/atlas/ThemeToggle";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setMode("reset");
    });
    if (window.location.hash.includes("type=recovery")) setMode("reset");
    return () => data.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "reset") {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        toast.success("Senha definida com sucesso.");
        nav({ to: "/painel" });
      } else if (mode === "login") {
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
        <div className="flex items-center justify-between gap-3"><Logo /><ThemeToggle /></div>
        <h1 className="mt-6 text-xl font-semibold">{mode === "reset" ? "Definir sua senha" : "Painel de Resultados"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Acesso restrito à equipe Atlas (@assessoriaatlas.com).</p>
        {mode !== "reset" && <><Button variant="outline" className="mt-6 w-full" onClick={google}>Continuar com Google</Button>
        <div className="my-5 text-center text-xs text-muted-foreground">ou</div></>}
        <form onSubmit={submit} className="space-y-3">
          {mode !== "reset" && <div className="space-y-1.5"><Label htmlFor="email">E-mail</Label><Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>}
          <div className="space-y-1.5"><Label htmlFor="password">{mode === "reset" ? "Nova senha" : "Senha"}</Label><Input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          <Button className="w-full" disabled={busy}>{mode === "reset" ? "Salvar senha" : mode === "login" ? "Entrar" : "Criar conta"}</Button>
        </form>
        {mode !== "reset" && <Button variant="link" className="mt-4 w-full text-xs" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
          {mode === "login" ? "Primeiro acesso? Criar conta" : "Já tenho conta"}
        </Button>}
      </div>
    </div>
  );
}
