// Tela de autorização do conector: login do Pends (se precisar) → "Permitir acesso?" → redirect com o código.
import { cookies } from "next/headers";
import { getPublicOrigin } from "mcp-handler";
import { OAUTH_SCOPE, checkConsentToken, consentToken, issueCode, resolveClient, validCodeChallenge } from "@/lib/oauth";
import { SESSION_COOKIE, attemptLogin, sessionCookieOptions, verifySessionToken } from "@/lib/session";

export const dynamic = "force-dynamic";

const KEYS = ["response_type", "client_id", "redirect_uri", "code_challenge", "code_challenge_method", "state", "scope", "resource"] as const;
type Params = Record<(typeof KEYS)[number], string>;

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function pick(src: URLSearchParams | FormData): Params {
  const out = {} as Params;
  for (const k of KEYS) out[k] = String(src.get(k) ?? "").slice(0, 2048);
  return out;
}

function page(title: string, body: string, status = 200, extraHeaders: Record<string, string> = {}) {
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · Pends</title>
<style>
:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#050811;color:#cbd5e1;font:15px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;padding:16px}
.card{width:100%;max-width:400px;background:#0b101d;border:1px solid #1e293b;border-radius:20px;padding:28px}
.logo{display:flex;align-items:center;gap:10px;margin-bottom:20px}.logo b{display:grid;place-items:center;width:36px;height:36px;border-radius:12px;background:#2563eb;color:#fff;font-weight:900}
h1{font-size:18px;color:#fff;margin:0 0 6px}p{margin:0 0 16px;color:#94a3b8;font-size:14px}
label{display:block;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#94a3b8;margin:12px 0 4px}
input{width:100%;padding:11px 12px;border-radius:12px;border:1px solid #1e293b;background:#050811;color:#fff;font-size:16px}input:focus{outline:none;border-color:#3b82f6}
button{width:100%;margin-top:16px;padding:12px;border-radius:12px;border:0;font-weight:700;font-size:14px;cursor:pointer}
.primary{background:#10b981;color:#04130d}.ghost{background:transparent;color:#94a3b8;border:1px solid #1e293b}
.err{background:#4c0519;border:1px solid #be123c;color:#fecdd3;padding:10px 12px;border-radius:12px;font-size:13px;margin-bottom:12px}
ul{margin:0 0 8px;padding-left:18px;color:#cbd5e1;font-size:14px}li{margin:4px 0}.muted{font-size:12px;color:#64748b}
</style></head><body><main class="card"><div class="logo"><b>P</b><strong style="color:#fff">PENDS</strong></div>${body}</main></body></html>`;
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Frame-Options": "DENY",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self' https: http://localhost:* http://127.0.0.1:*; frame-ancestors 'none'",
      "Referrer-Policy": "no-referrer",
      ...extraHeaders,
    },
  });
}

const hidden = (p: Params) =>
  KEYS.map((k) => `<input type="hidden" name="${k}" value="${esc(p[k])}">`).join("");

function loginPage(p: Params, clientName: string, error?: string) {
  return page(
    "Entrar",
    `<h1>Entrar no Pends</h1><p><b style="color:#fff">${esc(clientName)}</b> quer acessar seu Pends. Entre para continuar.</p>
${error ? `<div class="err">${esc(error)}</div>` : ""}
<form method="post">${hidden(p)}<input type="hidden" name="action" value="login">
<label for="e">E-mail</label><input id="e" name="email" type="email" autocomplete="username" required autofocus>
<label for="s">Senha</label><input id="s" name="password" type="password" autocomplete="current-password" required>
<button class="primary" type="submit">Entrar</button></form>`,
    error ? 401 : 200
  );
}

function consentPage(p: Params, clientName: string, extraHeaders?: Record<string, string>) {
  const csrf = consentToken(p);
  return page(
    "Permitir acesso",
    `<h1>Permitir acesso ao Pends?</h1>
<p><b style="color:#fff">${esc(clientName)}</b> vai poder, em seu nome:</p>
<ul><li>ver e criar pendências, atualizar e concluir</li><li>ver os módulos de vida</li><li>registrar lançamentos e ver resumos financeiros</li></ul>
<p class="muted">Nada é apagado por esse acesso. Para revogar tudo, troque o AUTH_SECRET do Pends.</p>
<form method="post">${hidden(p)}<input type="hidden" name="csrf" value="${esc(csrf)}">
<button class="primary" name="action" value="allow" type="submit">Permitir</button>
<button class="ghost" name="action" value="deny" type="submit">Cancelar</button></form>`,
    200,
    extraHeaders
  );
}

function redirectTo(redirectUri: string, params: Record<string, string>) {
  const u = new URL(redirectUri);
  for (const [k, v] of Object.entries(params)) if (v) u.searchParams.set(k, v);
  return new Response(null, { status: 302, headers: { Location: u.toString(), "Cache-Control": "no-store" } });
}

/** Valida cliente e redirect. Erros aqui NÃO redirecionam (o redirect pode ser de terceiros). */
async function validate(req: Request, p: Params) {
  const client = await resolveClient(p.client_id);
  if (!client) return { fail: page("Erro", `<h1>Cliente desconhecido</h1><p>Este aplicativo não está registrado.</p>`, 400) };
  if (!p.redirect_uri || !client.redirect_uris.includes(p.redirect_uri)) {
    return { fail: page("Erro", `<h1>Endereço de retorno inválido</h1><p>O redirect_uri não pertence a este cliente.</p>`, 400) };
  }
  const back = (error: string, description: string) =>
    ({ fail: redirectTo(p.redirect_uri, { error, error_description: description, state: p.state }) });
  if (p.response_type !== "code") return back("unsupported_response_type", "Use response_type=code.");
  if (!validCodeChallenge(p.code_challenge, p.code_challenge_method)) return back("invalid_request", "PKCE S256 obrigatório.");
  const origin = getPublicOrigin(req);
  if (p.resource && ![`${origin}/api/mcp`, origin].includes(p.resource.replace(/\/$/, ""))) {
    return back("invalid_target", "Recurso desconhecido.");
  }
  if (p.scope && !p.scope.split(" ").every((s) => s === OAUTH_SCOPE)) return back("invalid_scope", `Escopo suportado: ${OAUTH_SCOPE}.`);
  return { client };
}

async function loggedIn() {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

export async function GET(req: Request) {
  const p = pick(new URL(req.url).searchParams);
  const v = await validate(req, p);
  if ("fail" in v) return v.fail;
  return (await loggedIn()) ? consentPage(p, v.client.client_name) : loginPage(p, v.client.client_name);
}

export async function POST(req: Request) {
  const form = await req.formData();
  const p = pick(form);
  const v = await validate(req, p);
  if ("fail" in v) return v.fail;
  const action = String(form.get("action") ?? "");

  if (action === "login") {
    const res = await attemptLogin(String(form.get("email") ?? "").slice(0, 200), String(form.get("password") ?? "").slice(0, 200));
    if (!res.ok) return loginPage(p, v.client.client_name, res.error);
    const o = sessionCookieOptions;
    const cookie = `${SESSION_COOKIE}=${res.token}; Path=${o.path}; Max-Age=${o.maxAge}; HttpOnly; SameSite=Lax${o.secure ? "; Secure" : ""}`;
    return consentPage(p, v.client.client_name, { "Set-Cookie": cookie });
  }

  // Permitir/Cancelar exigem sessão válida e o token anti-CSRF da tela
  if (!(await loggedIn())) return loginPage(p, v.client.client_name, "Sua sessão expirou. Entre de novo.");
  if (!checkConsentToken(String(form.get("csrf") ?? ""), p)) {
    return page("Erro", `<h1>Pedido expirado</h1><p>Volte ao Claude e tente conectar de novo.</p>`, 400);
  }
  if (action !== "allow") return redirectTo(p.redirect_uri, { error: "access_denied", error_description: "Acesso negado.", state: p.state });

  const code = issueCode({
    client_id: p.client_id,
    redirect_uri: p.redirect_uri,
    code_challenge: p.code_challenge,
    scope: OAUTH_SCOPE,
    resource: p.resource || undefined,
  });
  return redirectTo(p.redirect_uri, { code, state: p.state });
}
