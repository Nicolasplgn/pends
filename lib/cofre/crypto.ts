// lib/cofre/crypto.ts
// Criptografia do cofre de senhas: AES-256-GCM com IV aleatório por registro.
// A chave é derivada do AUTH_SECRET por HKDF (info "pends-cofre-v1"), sem variável nova.
// Se o AUTH_SECRET mudar, o cofre deixa de abrir: rode `npm run cofre:recifrar` (veja o README).
//
// Formato gravado: "v1.<base64url(iv 12 bytes | tag 16 bytes | texto cifrado)>"
// Nunca registre em log nem coloque em mensagem de erro o texto aberto ou a chave.

import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

const INFO = "pends-cofre-v1";
const PREFIXO = "v1.";
const IV_BYTES = 12;
const TAG_BYTES = 16;

/** Erro genérico do cofre: a mensagem nunca carrega dado sensível. */
export class CofreError extends Error {
  constructor(message = "Não foi possível abrir o cofre.") {
    super(message);
    this.name = "CofreError";
  }
}

/** Deriva a chave AES-256 a partir de um segredo (o AUTH_SECRET). */
export function derivarChave(segredo: string): Buffer {
  if (!segredo) throw new CofreError("AUTH_SECRET não configurado: o cofre não funciona sem ele.");
  return Buffer.from(hkdfSync("sha256", Buffer.from(segredo, "utf8"), Buffer.alloc(0), Buffer.from(INFO, "utf8"), 32));
}

/** Chave do cofre com o AUTH_SECRET atual. */
export function chaveAtual(): Buffer {
  return derivarChave(process.env.AUTH_SECRET ?? "");
}

export function cifrar(texto: string, chave: Buffer): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", chave, iv);
  const corpo = Buffer.concat([cipher.update(texto, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIXO + Buffer.concat([iv, tag, corpo]).toString("base64url");
}

export function decifrar(payload: string, chave: Buffer): string {
  if (!payload?.startsWith(PREFIXO)) throw new CofreError("Registro do cofre em formato desconhecido.");
  const bruto = Buffer.from(payload.slice(PREFIXO.length), "base64url");
  if (bruto.length < IV_BYTES + TAG_BYTES) throw new CofreError("Registro do cofre corrompido.");
  const iv = bruto.subarray(0, IV_BYTES);
  const tag = bruto.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const corpo = bruto.subarray(IV_BYTES + TAG_BYTES);
  try {
    const decipher = createDecipheriv("aes-256-gcm", chave, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(corpo), decipher.final()]).toString("utf8");
  } catch {
    // Chave errada (AUTH_SECRET mudou) ou dado adulterado: GCM recusa
    throw new CofreError("Não foi possível abrir o cofre (chave diferente ou registro alterado).");
  }
}
