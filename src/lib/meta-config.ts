// Browser-safe Meta Ads integration constants (no secrets here).
export const META_GRAPH_VERSION = "v23.0";
export const META_CALLBACK_PATH = "/api/public/meta/callback";
export const META_SCOPES = ["ads_read", "business_management"] as const;

const PROJECT = "a701e888-1015-4fea-a124-2511a1e7386a";

export const META_ORIGINS = [
  { label: "Site publicado", origin: "https://atlasds.lovable.app" },
  { label: "Endereço fixo do site publicado", origin: `https://project--${PROJECT}.lovable.app` },
  { label: "Pré-visualização", origin: `https://id-preview--${PROJECT}.lovable.app` },
  { label: "Pré-visualização (endereço fixo)", origin: `https://project--${PROJECT}-dev.lovable.app` },
] as const;

export function isAllowedMetaOrigin(origin: string): boolean {
  return META_ORIGINS.some((o) => o.origin === origin);
}

export function metaRedirectUri(origin: string): string {
  return `${origin}${META_CALLBACK_PATH}`;
}

export const META_ERROR_MESSAGES: Record<string, string> = {
  invalido: "Retorno da Meta inválido. Tente conectar novamente.",
  expirado: "A autorização expirou. Clique em Conectar novamente.",
  negado: "A autorização foi cancelada na Meta.",
  "sem-permissao": "Somente administradores podem conectar a Meta.",
  troca: "A Meta não confirmou a autorização. Confira o App ID, o App Secret e a URL de redirecionamento.",
  config: "App ID ou App Secret ainda não configurados.",
};
