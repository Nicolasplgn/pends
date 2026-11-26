// lib/cofre/service.ts
// Regras do cofre, usadas pelas Server Actions (app) e pelo MCP. Sem autenticação aqui:
// quem chama já validou o login (e a reautenticação, no app).
// Senhas e notas só saem decifradas em `revelar`. Nada sensível vai para log ou mensagem de erro.

import { prisma } from "../prisma";
import { chaveAtual, cifrar, decifrar } from "./crypto";

export type OrigemCofre = "app" | "mcp";
export type AcaoCofre = "criou" | "revelou" | "copiou" | "editou" | "apagou" | "importou";

export interface CredencialEntrada {
  titulo: string;
  url?: string | null;
  usuario?: string | null;
  /** Na edição: vazio/undefined mantém a senha atual */
  senha?: string;
  /** undefined mantém; "" apaga as notas */
  notas?: string;
  projeto?: string | null;
  modulo?: string | null;
  tags?: string[];
}

const LIMITE = { titulo: 120, url: 500, usuario: 200, senha: 1000, notas: 5000, rotulo: 60 };

const txt = (v: string | null | undefined, max: number) => {
  const t = (v ?? "").trim();
  return t ? t.slice(0, max) : null;
};

/** Visão pública: nunca inclui senha nem notas. */
const publico = {
  id: true, titulo: true, url: true, usuario: true, projeto: true, modulo: true, tags: true,
  criadoEm: true, atualizadoEm: true, ultimaRevelacao: true,
} as const;

async function log(credencialId: string | null, titulo: string, acao: AcaoCofre, origem: OrigemCofre) {
  await prisma.credencialLog.create({ data: { credencialId, titulo: titulo.slice(0, LIMITE.titulo), acao, origem } });
}

export async function listarCredenciais(f: { texto?: string; projeto?: string } = {}, limite = 500) {
  const where: Record<string, unknown> = {};
  if (f.projeto?.trim()) {
    where.projeto = f.projeto === "__sem" ? null : { equals: f.projeto.trim(), mode: "insensitive" };
  }
  if (f.texto?.trim()) {
    const t = { contains: f.texto.trim(), mode: "insensitive" };
    where.OR = [{ titulo: t }, { url: t }, { usuario: t }, { projeto: t }, { tags: { has: f.texto.trim().toLowerCase() } }];
  }
  const rows = await prisma.credencial.findMany({
    where,
    select: { ...publico, notasCifradas: true },
    orderBy: [{ titulo: "asc" }],
    take: limite,
  });
  return rows.map(({ notasCifradas, ...r }) => ({ ...r, temNotas: !!notasCifradas }));
}

export async function projetosDoCofre() {
  const rows = await prisma.credencial.findMany({ where: { projeto: { not: null } }, select: { projeto: true }, distinct: ["projeto"] });
  return rows.map((r) => r.projeto!).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export async function criarCredencial(e: CredencialEntrada, origem: OrigemCofre) {
  const titulo = txt(e.titulo, LIMITE.titulo);
  if (!titulo) throw new Error("Dê um título para a credencial.");
  if (!e.senha) throw new Error("Informe a senha.");
  if (e.senha.length > LIMITE.senha) throw new Error("Senha longa demais.");
  const chave = chaveAtual();
  const c = await prisma.credencial.create({
    data: {
      titulo,
      url: txt(e.url, LIMITE.url),
      usuario: txt(e.usuario, LIMITE.usuario),
      senhaCifrada: cifrar(e.senha, chave),
      notasCifradas: e.notas?.trim() ? cifrar(e.notas.slice(0, LIMITE.notas), chave) : null,
      projeto: txt(e.projeto, LIMITE.rotulo),
      modulo: txt(e.modulo, LIMITE.rotulo),
      tags: (e.tags ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 10),
    },
    select: { id: true, titulo: true },
  });
  await log(c.id, c.titulo, "criou", origem);
  return c.id;
}

export async function editarCredencial(id: string, e: CredencialEntrada, origem: OrigemCofre) {
  const atual = await prisma.credencial.findUnique({ where: { id }, select: { id: true } });
  if (!atual) throw new Error("Credencial não encontrada.");
  const titulo = txt(e.titulo, LIMITE.titulo);
  if (!titulo) throw new Error("Dê um título para a credencial.");
  if (e.senha && e.senha.length > LIMITE.senha) throw new Error("Senha longa demais.");
  const chave = chaveAtual();
  const c = await prisma.credencial.update({
    where: { id },
    data: {
      titulo,
      url: txt(e.url, LIMITE.url),
      usuario: txt(e.usuario, LIMITE.usuario),
      ...(e.senha ? { senhaCifrada: cifrar(e.senha, chave) } : {}),
      ...(e.notas !== undefined ? { notasCifradas: e.notas.trim() ? cifrar(e.notas.slice(0, LIMITE.notas), chave) : null } : {}),
      projeto: txt(e.projeto, LIMITE.rotulo),
      modulo: txt(e.modulo, LIMITE.rotulo),
      tags: (e.tags ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 10),
    },
    select: { id: true, titulo: true },
  });
  await log(c.id, c.titulo, "editou", origem);
}

export async function apagarCredencial(id: string, origem: OrigemCofre) {
  const c = await prisma.credencial.findUnique({ where: { id }, select: { id: true, titulo: true } });
  if (!c) throw new Error("Credencial não encontrada.");
  // O log fica (credencialId vira vazio ao apagar)
  await log(c.id, c.titulo, "apagou", origem);
  await prisma.credencial.delete({ where: { id } });
}

/** Única saída com a senha aberta. Grava no histórico. */
export async function revelarCredencial(id: string, acao: "revelou" | "copiou", origem: OrigemCofre) {
  const c = await prisma.credencial.findUnique({
    where: { id },
    select: { id: true, titulo: true, usuario: true, url: true, senhaCifrada: true, notasCifradas: true },
  });
  if (!c) throw new Error("Credencial não encontrada.");
  const chave = chaveAtual();
  const senha = decifrar(c.senhaCifrada, chave);
  const notas = c.notasCifradas ? decifrar(c.notasCifradas, chave) : null;
  await prisma.credencial.update({ where: { id }, data: { ultimaRevelacao: new Date() } });
  await log(c.id, c.titulo, acao, origem);
  return { titulo: c.titulo, usuario: c.usuario, url: c.url, senha, notas };
}

export async function historicoCredencial(id: string, limite = 50) {
  return prisma.credencialLog.findMany({
    where: { credencialId: id },
    orderBy: { quando: "desc" },
    take: limite,
    select: { acao: true, origem: true, quando: true },
  });
}

/** Revelações feitas pelo MCP na última hora (limite do conector). */
export async function revelacoesMcpUltimaHora() {
  return prisma.credencialLog.count({
    where: { origem: "mcp", acao: "revelou", quando: { gte: new Date(Date.now() - 3600_000) } },
  });
}

// ---------- Importação (ex.: exportação CSV do Gerenciador de Senhas do Google) ----------

export interface LinhaImportada {
  titulo: string;
  url: string | null;
  usuario: string | null;
  senha: string;
  notas: string | null;
}

const chaveDuplicata = (url: string | null, usuario: string | null) => {
  let host = (url ?? "").trim().toLowerCase();
  try {
    if (host) host = new URL(host.includes("://") ? host : `https://${host}`).hostname.replace(/^www\./, "");
  } catch {}
  return `${host}|${(usuario ?? "").trim().toLowerCase()}`;
};

export async function importarCredenciais(linhas: LinhaImportada[], projeto: string | null, origem: OrigemCofre) {
  const existentes = await prisma.credencial.findMany({ select: { url: true, usuario: true } });
  const vistos = new Set(existentes.map((e) => chaveDuplicata(e.url, e.usuario)));
  const chave = chaveAtual();
  let criadas = 0;
  let duplicadas = 0;
  let invalidas = 0;
  for (const l of linhas) {
    if (!l.senha || l.senha.length > LIMITE.senha || !(l.titulo || l.url)) {
      invalidas++;
      continue;
    }
    const k = chaveDuplicata(l.url, l.usuario);
    if (vistos.has(k)) {
      duplicadas++;
      continue;
    }
    vistos.add(k);
    const c = await prisma.credencial.create({
      data: {
        titulo: (txt(l.titulo, LIMITE.titulo) ?? txt(l.url, LIMITE.titulo))!,
        url: txt(l.url, LIMITE.url),
        usuario: txt(l.usuario, LIMITE.usuario),
        senhaCifrada: cifrar(l.senha, chave),
        notasCifradas: l.notas?.trim() ? cifrar(l.notas.slice(0, LIMITE.notas), chave) : null,
        projeto: txt(projeto, LIMITE.rotulo),
        tags: ["google"],
      },
      select: { id: true, titulo: true },
    });
    await log(c.id, c.titulo, "importou", origem);
    criadas++;
  }
  return { criadas, duplicadas, invalidas };
}
