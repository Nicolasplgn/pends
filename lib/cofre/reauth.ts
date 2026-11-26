// lib/cofre/reauth.ts
// Reautenticação do cofre: revelar, copiar e importar exigem digitar de novo a senha do Pends.
// Depois de confirmar, um cookie assinado (HMAC) vale por 5 minutos.

import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const COFRE_COOKIE = "pends_cofre";
export const REAUTH_MS = 5 * 60_000;

function chave() {
  const segredo = process.env.AUTH_SECRET ?? "";
  if (!segredo) throw new Error("AUTH_SECRET não configurado.");
  return Buffer.from(hkdfSync("sha256", Buffer.from(segredo), Buffer.alloc(0), Buffer.from("pends-cofre-reauth-v1"), 32));
}

const assinar = (dados: string) => createHmac("sha256", chave()).update(dados).digest("base64url");

/** Grava o cookie de reautenticação e devolve quando ele expira. */
export async function emitirReauth() {
  const exp = Date.now() + REAUTH_MS;
  const valor = `${exp}.${assinar(String(exp))}`;
  const store = await cookies();
  store.set(COFRE_COOKIE, valor, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: Math.floor(REAUTH_MS / 1000),
  });
  return exp;
}

/** Momento em que a reautenticação expira, ou null se não houver uma válida. */
export async function reauthAte(): Promise<number | null> {
  const store = await cookies();
  const v = store.get(COFRE_COOKIE)?.value;
  if (!v) return null;
  const [exp, sig] = v.split(".");
  if (!exp || !sig) return null;
  const esperado = Buffer.from(assinar(exp));
  const recebido = Buffer.from(sig);
  if (esperado.length !== recebido.length || !timingSafeEqual(esperado, recebido)) return null;
  const n = Number(exp);
  return n > Date.now() ? n : null;
}

export async function encerrarReauth() {
  const store = await cookies();
  store.delete(COFRE_COOKIE);
}
