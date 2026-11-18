// Endpoint de token: authorization_code (com PKCE) e refresh_token.
import { OAuthFail, corsHeaders, exchangeCode, refreshTokens } from "@/lib/oauth";

export const dynamic = "force-dynamic";

async function readParams(req: Request): Promise<URLSearchParams> {
  const type = req.headers.get("content-type") ?? "";
  const text = await req.text();
  if (text.length > 10_000) throw new OAuthFail("invalid_request", "Requisição grande demais.");
  if (type.includes("application/json")) {
    const obj = JSON.parse(text) as Record<string, unknown>;
    return new URLSearchParams(Object.entries(obj).map(([k, v]) => [k, String(v)]));
  }
  return new URLSearchParams(text);
}

export async function POST(req: Request) {
  const headers = { ...corsHeaders, "Cache-Control": "no-store", Pragma: "no-cache" };
  try {
    const p = await readParams(req);
    const grant = p.get("grant_type");
    if (grant === "authorization_code") {
      return Response.json(
        exchangeCode({
          code: p.get("code"),
          redirect_uri: p.get("redirect_uri"),
          client_id: p.get("client_id"),
          code_verifier: p.get("code_verifier"),
        }),
        { headers }
      );
    }
    if (grant === "refresh_token") {
      return Response.json(refreshTokens({ refresh_token: p.get("refresh_token"), client_id: p.get("client_id") }), { headers });
    }
    throw new OAuthFail("unsupported_grant_type", "Use authorization_code ou refresh_token.");
  } catch (e) {
    const err = e instanceof OAuthFail ? e : new OAuthFail("invalid_request", "Requisição inválida.");
    return Response.json({ error: err.code, error_description: err.message }, { status: err.status, headers });
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
