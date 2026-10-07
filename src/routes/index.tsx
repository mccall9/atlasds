import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/painel" });
  },
  head: () => ({
    meta: [
      { title: "Atlas | Painel de Resultados" },
      { name: "description", content: "Painel executivo de resultados da Atlas Assessoria." },
      { property: "og:title", content: "Atlas | Painel de Resultados" },
      { property: "og:description", content: "Painel executivo de resultados da Atlas Assessoria." },
    ],
  }),
});
