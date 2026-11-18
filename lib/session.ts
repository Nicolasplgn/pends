// lib/session.ts
// Sessão assinada com HMAC: o cookie só vale se foi emitido pelo servidor.
// Formato do token: <expiraEmMs>.<nonce>.<assinatura>

import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "pends_session";
export const SESSION_MAX_AGE_S = 60 * 60 * 24 * 30; // 30 dias

/**
 * Segredo da assinatura. Use AUTH_SECRET (recomendado); se não existir, deriva das
 * credenciais — trocar a senha derruba todas as sessões abertas.
 */
export function sessionSecret(): string | null {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  const { AUTH_EMAIL, AUTH_PASSWORD } = process.env;
  if (AUTH_EMAIL && AUTH_PASSWORD) {
    return createHash("sha256").update(`pends:${AUTH_EMAIL.trim().toLowerCase()}:${AUTH_PASSWORD}`).digest("hex");
  }
  return null;
}

function hmac(data: string, secret: string) {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export function createSessionToken(): string | null {
  const secret = sessionSecret();
  if (!secret) return null;
  const exp = Date.now() + SESSION_MAX_AGE_S * 1000;
  const payload = `${exp}.${randomBytes(16).toString("base64url")}`;
  return `${payload}.${hmac(payload, secret)}`;
}

export function verifySessionToken(token: string | undefined | null): boolean {
  const secret = sessionSecret();
  if (!secret || !token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [exp, nonce, sig] = parts;
  if (!safeEqual(hmac(`${exp}.${nonce}`, secret), sig)) return false;
  return Number(exp) > Date.now();
}

/** Compara credenciais em tempo constante (evita timing attack). */
export function credentialsMatch(email: string, pass: string): boolean {
  const { AUTH_EMAIL, AUTH_PASSWORD } = process.env;
  if (!AUTH_EMAIL || !AUTH_PASSWORD) return false;
  const h = (s: string) => createHash("sha256").update(s).digest("hex");
  const okEmail = safeEqual(h(email.trim().toLowerCase()), h(AUTH_EMAIL.trim().toLowerCase()));
  const okPass = safeEqual(h(pass), h(AUTH_PASSWORD));
  return okEmail && okPass;
}

export async function isAuthenticated(): Promise<boolean> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

/** Barreira das Server Actions: sem sessão válida, nada roda. */
export async function requireAuth(): Promise<void> {
  if (!(await isAuthenticated())) {
    throw new Error("Sessão expirada ou inválida. Faça login novamente.");
  }
}


// ---------- Login com limitador (usado pelo app e pela tela de login do OAuth) ----------

const loginFailures = new Map<string, { count: number; until: number }>();

export type LoginResult = { ok: true; token: string } | { ok: false; error: string };

/** Confere credenciais com atraso fixo e bloqueio de 5 min após 5 erros seguidos. */
export async function attemptLogin(email: string, pass: string): Promise<LoginResult> {
  if (!process.env.AUTH_EMAIL || !process.env.AUTH_PASSWORD) {
    return { ok: false, error: "Variáveis de ambiente AUTH_EMAIL ou AUTH_PASSWORD não foram configuradas no servidor." };
  }
  const key = email.trim().toLowerCase() || "_";
  const fail = loginFailures.get(key);
  if (fail && fail.until > Date.now()) {
    return { ok: false, error: "Muitas tentativas. Aguarde alguns minutos e tente de novo." };
  }
  if (credentialsMatch(email, pass)) {
    loginFailures.delete(key);
    const token = createSessionToken();
    if (!token) return { ok: false, error: "Falha ao criar sessão." };
    return { ok: true, token };
  }
  const count = (fail?.count ?? 0) + 1;
  loginFailures.set(key, { count, until: count >= 5 ? Date.now() + 5 * 60_000 : 0 });
  await new Promise((r) => setTimeout(r, 600));
  return { ok: false, error: "Credenciais inválidas. Verifique usuário e senha." };
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_MAX_AGE_S,
};
