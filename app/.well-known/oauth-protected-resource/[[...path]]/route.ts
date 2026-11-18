// Metadados do recurso protegido (RFC 9728). Atende /.well-known/oauth-protected-resource
// e a variante com o caminho do recurso (/.well-known/oauth-protected-resource/api/mcp).
import { generateProtectedResourceMetadata, getPublicOrigin } from "mcp-handler";
import { OAUTH_SCOPE, corsHeaders } from "@/lib/oauth";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const origin = getPublicOrigin(req);
  const metadata = generateProtectedResourceMetadata({
    authServerUrls: [origin],
    resourceUrl: `${origin}/api/mcp`,
    additionalMetadata: {
      scopes_supported: [OAUTH_SCOPE],
      bearer_methods_supported: ["header"],
      resource_name: "Pends",
    },
  });
  return Response.json(metadata, { headers: { ...corsHeaders, "Cache-Control": "public, max-age=3600" } });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
