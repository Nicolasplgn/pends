// Registro dinâmico de cliente (RFC 7591). Nada é salvo: o client_id é assinado.
import { OAuthFail, corsHeaders, registerClient } from "@/lib/oauth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    const text = await req.text();
    if (text.length > 10_000) throw new Error("grande demais");
    body = JSON.parse(text);
  } catch {
    return Response.json({ error: "invalid_client_metadata", error_description: "JSON inválido." }, { status: 400, headers: corsHeaders });
  }
  try {
    const c = registerClient({ redirect_uris: body.redirect_uris, client_name: body.client_name });
    return Response.json(
      {
        ...c,
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
      },
      { status: 201, headers: { ...corsHeaders, "Cache-Control": "no-store" } }
    );
  } catch (e) {
    const err = e instanceof OAuthFail ? e : new OAuthFail("invalid_client_metadata", "Cadastro inválido.");
    return Response.json({ error: err.code, error_description: err.message }, { status: 400, headers: corsHeaders });
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
