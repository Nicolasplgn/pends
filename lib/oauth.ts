// lib/oauth.ts
// Servidor de autorização OAuth 2.1 do Pends (para o conector MCP do Claude).
//
// Sem tabelas novas no banco: client_id (DCR), códigos e tokens são assinados com HMAC
// usando uma chave derivada do AUTH_SECRET. Trocar o AUTH_SECRET revoga tudo de uma vez.
//
// - PKCE obrigatório (S256)
// - Registro dinâmico de cliente (RFC 7591) e Client ID Metadata Document (CIMD)
// - Redirect só para hosts permitidos (claude.ai / claude.com / localhost + OAUTH_EXTRA_REDIRECT_HOSTS)

import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { sessionSecret } from "./session";

export const OAUTH_SCOPE = "pends";
const ACCESS_TTL_S = 60 * 60; // 1 h
const REFRESH_TTL_S = 60 * 60 * 24 * 30; // 30 dias
const CODE_TTL_S = 5 * 60; // 5 min
const CSRF_TTL_S = 10 * 60; // 10 min

type Kind = "client" | "code" | "at" | "rt" | "csrf";
type Signed = { t: Kind; exp?: number; [k: string]: unknown };

const now = () => Math.floor(Date.now() / 1000);
const b64 = (s: string | Buffer) => Buffer.from(s).toString("base64url");

/** Chave própria do OAuth (derivada), separada da usada no cookie de sessão. */
function oauthKey(): Buffer {
  const secret = sessionSecret();
  if (!secret) throw new Error("AUTH_SECRET (ou AUTH_EMAIL/AUTH_PASSWORD) não configurado.");
  return createHmac("sha256", secret).update("pends-oauth-v1").digest();
}

function sign(payload: Signed): string {
  const body = b64(JSON.stringify(payload));
  const sig = createHmac("sha256", oauthKey()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verify<T extends Signed>(token: string | null | undefined, kind: Kind): T | null {
  if (!token || token.length > 4096) return null;
  const [body, sig, extra] = token.split(".");
  if (!body || !sig || extra !== undefined) return null;
  const expected = createHmac("sha256", oauthKey()).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T;
    if (p.t !== kind) return null;
    if (p.exp !== undefined && p.exp < now()) return null;
    return p;
  } catch {
    return null;
  }
}

// ---------------- Redirect URIs permitidos ----------------

const REDIRECT_HOSTS = ["claude.ai", "www.claude.ai", "claude.com", "www.claude.com"];
const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]"];

function extraHosts() {
  return (process.env.OAUTH_EXTRA_REDIRECT_HOSTS ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowedRedirect(uri: string): boolean {
  try {
    const u = new URL(uri);
    if (u.hash) return false;
    const host = u.hostname.toLowerCase();
    if (LOCAL_HOSTS.includes(host) || LOCAL_HOSTS.includes(`[${host}]`)) return u.protocol === "http:" || u.protocol === "https:";
    return u.protocol === "https:" && (REDIRECT_HOSTS.includes(host) || extraHosts().includes(host));
  } catch {
    return false;
  }
}

// ---------------- Clientes (DCR e CIMD) ----------------

export interface OAuthClient {
  client_id: string;
  client_name: string;
  redirect_uris: string[];
}

/** RFC 7591: o client_id é assinado e carrega os redirect_uris (nada salvo no banco). */
export function registerClient(input: { redirect_uris?: unknown; client_name?: unknown }) {
  const uris = Array.isArray(input.redirect_uris) ? input.redirect_uris.filter((u): u is string => typeof u === "string") : [];
  if (uris.length === 0 || uris.length > 5) throw new OAuthFail("invalid_redirect_uri", "Informe de 1 a 5 redirect_uris.");
  for (const u of uris) {
    if (u.length > 500 || !isAllowedRedirect(u)) throw new OAuthFail("invalid_redirect_uri", `redirect_uri não permitido: ${u.slice(0, 120)}`);
  }
  const name = typeof input.client_name === "string" ? input.client_name.slice(0, 80) : "Cliente MCP";
  const client_id = `pc_${sign({ t: "client", r: uris, n: name, iat: now() })}`;
  return { client_id, client_name: name, redirect_uris: uris, client_id_issued_at: now() };
}

const cimdCache = new Map<string, { at: number; client: OAuthClient }>();

/** Client ID Metadata Document: o client_id é uma URL https com os metadados do cliente. */
async function fetchCimd(url: string): Promise<OAuthClient | null> {
  const cached = cimdCache.get(url);
  if (cached && Date.now() - cached.at < 3600_000) return cached.client;
  const u = new URL(url);
  // Só busca em hosts conhecidos (evita o servidor ser usado para acessar URLs arbitrárias)
  const host = u.hostname.toLowerCase();
  if (u.protocol !== "https:" || !(REDIRECT_HOSTS.includes(host) || extraHosts().includes(host))) return null;
  const res = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(5000), redirect: "error" });
  if (!res.ok) return null;
  const text = await res.text();
  if (text.length > 20_000) return null;
  const doc = JSON.parse(text) as { client_id?: string; client_name?: string; redirect_uris?: unknown };
  if (doc.client_id !== url || !Array.isArray(doc.redirect_uris)) return null;
  const client: OAuthClient = {
    client_id: url,
    client_name: (doc.client_name ?? "Cliente MCP").slice(0, 80),
    redirect_uris: doc.redirect_uris.filter((r): r is string => typeof r === "string" && isAllowedRedirect(r)),
  };
  cimdCache.set(url, { at: Date.now(), client });
  return client;
}

export async function resolveClient(clientId: string | null | undefined): Promise<OAuthClient | null> {
  if (!clientId || clientId.length > 4096) return null;
  if (clientId.startsWith("https://")) {
    try {
      return await fetchCimd(clientId);
    } catch {
      return null;
    }
  }
  if (!clientId.startsWith("pc_")) return null;
  const p = verify<Signed & { r: string[]; n: string }>(clientId.slice(3), "client");
  if (!p) return null;
  return { client_id: clientId, client_name: p.n, redirect_uris: p.r.filter(isAllowedRedirect) };
}

// ---------------- PKCE ----------------

export function validCodeChallenge(challenge: string | null, method: string | null) {
  return method === "S256" && !!challenge && /^[A-Za-z0-9_-]{43}$/.test(challenge);
}

function pkceMatches(verifier: string, challenge: string) {
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) return false;
  const computed = createHash("sha256").update(verifier).digest("base64url");
  const a = Buffer.from(computed);
  const b = Buffer.from(challenge);
  return a.length === b.length && timingSafeEqual(a, b);
}

// ---------------- Consentimento (proteção CSRF da tela) ----------------

const paramsHash = (p: Record<string, string>) =>
  createHash("sha256").update(JSON.stringify(Object.keys(p).sort().map((k) => [k, p[k]]))).digest("base64url");

export function consentToken(params: Record<string, string>) {
  return sign({ t: "csrf", h: paramsHash(params), exp: now() + CSRF_TTL_S });
}

export function checkConsentToken(token: string | null, params: Record<string, string>) {
  const p = verify<Signed & { h: string }>(token, "csrf");
  return !!p && p.h === paramsHash(params);
}

// ---------------- Códigos e tokens ----------------

export interface Grant {
  client_id: string;
  scope: string;
  resource?: string;
}

const usedCodes = new Map<string, number>(); // nonce → expiração (uso único, melhor esforço por instância)

export function issueCode(g: Grant & { redirect_uri: string; code_challenge: string }) {
  return sign({
    t: "code", c: g.client_id, r: g.redirect_uri, cc: g.code_challenge, s: g.scope, res: g.resource ?? null,
    n: randomBytes(12).toString("base64url"), exp: now() + CODE_TTL_S,
  });
}

function issueTokens(g: Grant) {
  const base = { c: g.client_id, s: g.scope, res: g.resource ?? null };
  return {
    access_token: sign({ t: "at", ...base, n: randomBytes(9).toString("base64url"), exp: now() + ACCESS_TTL_S }),
    token_type: "Bearer",
    expires_in: ACCESS_TTL_S,
    refresh_token: sign({ t: "rt", ...base, n: randomBytes(9).toString("base64url"), exp: now() + REFRESH_TTL_S }),
    scope: g.scope,
  };
}

export class OAuthFail extends Error {
  constructor(public code: string, description: string, public status = 400) {
    super(description);
  }
}

/** Troca o código (com PKCE) por tokens. */
export function exchangeCode(p: { code?: string | null; redirect_uri?: string | null; client_id?: string | null; code_verifier?: string | null }) {
  const c = verify<Signed & { c: string; r: string; cc: string; s: string; res: string | null; n: string }>(p.code, "code");
  if (!c) throw new OAuthFail("invalid_grant", "Código inválido ou expirado.");
  if (usedCodes.has(c.n)) throw new OAuthFail("invalid_grant", "Código já usado.");
  if (!p.client_id || p.client_id !== c.c) throw new OAuthFail("invalid_grant", "client_id não confere.");
  if (!p.redirect_uri || p.redirect_uri !== c.r) throw new OAuthFail("invalid_grant", "redirect_uri não confere.");
  if (!p.code_verifier || !pkceMatches(p.code_verifier, c.cc)) throw new OAuthFail("invalid_grant", "code_verifier inválido (PKCE).");
  usedCodes.set(c.n, c.exp ?? now() + CODE_TTL_S);
  for (const [k, exp] of usedCodes) if (exp < now()) usedCodes.delete(k);
  return issueTokens({ client_id: c.c, scope: c.s, resource: c.res ?? undefined });
}

/** Renova os tokens (gira o refresh token). */
export function refreshTokens(p: { refresh_token?: string | null; client_id?: string | null }) {
  const r = verify<Signed & { c: string; s: string; res: string | null }>(p.refresh_token, "rt");
  if (!r) throw new OAuthFail("invalid_grant", "Refresh token inválido ou expirado.");
  if (p.client_id && p.client_id !== r.c) throw new OAuthFail("invalid_grant", "client_id não confere.");
  return issueTokens({ client_id: r.c, scope: r.s, resource: r.res ?? undefined });
}

/** Valida o token de acesso enviado ao /api/mcp. */
export function verifyAccessToken(token: string | undefined, expectedResource: string) {
  const p = verify<Signed & { c: string; s: string; res: string | null; exp: number }>(token, "at");
  if (!p) return null;
  // Token emitido para outro recurso não vale aqui (RFC 8707)
  if (p.res && p.res.replace(/\/$/, "") !== expectedResource.replace(/\/$/, "")) return null;
  return { clientId: p.c, scopes: p.s.split(" ").filter(Boolean), expiresAt: p.exp };
}

/** Metadados do servidor de autorização (RFC 8414). */
export function authorizationServerMetadata(origin: string) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/oauth/token`,
    registration_endpoint: `${origin}/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: [OAUTH_SCOPE],
    client_id_metadata_document_supported: true,
    service_documentation: `${origin}/`,
  };
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, mcp-protocol-version, mcp-session-id",
  "Access-Control-Expose-Headers": "WWW-Authenticate, mcp-session-id",
  "Access-Control-Max-Age": "86400",
};
