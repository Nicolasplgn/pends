// Metadados do servidor de autorização (RFC 8414) para o conector MCP.
import { getPublicOrigin } from "mcp-handler";
import { authorizationServerMetadata, corsHeaders } from "@/lib/oauth";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return Response.json(authorizationServerMetadata(getPublicOrigin(req)), {
    headers: { ...corsHeaders, "Cache-Control": "public, max-age=3600" },
  });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
