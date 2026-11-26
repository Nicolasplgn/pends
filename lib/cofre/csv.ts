// lib/cofre/csv.ts
// Lê o CSV exportado pelo Gerenciador de Senhas do Google / Chrome
// (cabeçalho: name,url,username,password,note). Aceita também variações comuns
// (title, login, notes) e CSV com aspas, vírgulas e quebras de linha dentro do campo.

import type { LinhaImportada } from "./service";

/** CSV → linhas de campos (RFC 4180). */
export function lerCsv(texto: string): string[][] {
  const linhas: string[][] = [];
  let campo = "";
  let linha: string[] = [];
  let aspas = false;
  const s = texto.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (aspas) {
      if (ch === '"') {
        if (s[i + 1] === '"') { campo += '"'; i++; } else aspas = false;
      } else campo += ch;
      continue;
    }
    if (ch === '"') aspas = true;
    else if (ch === ",") { linha.push(campo); campo = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      linha.push(campo); campo = "";
      if (linha.some((c) => c !== "")) linhas.push(linha);
      linha = [];
    } else campo += ch;
  }
  linha.push(campo);
  if (linha.some((c) => c !== "")) linhas.push(linha);
  return linhas;
}

const COLUNAS: Record<keyof LinhaImportada, string[]> = {
  titulo: ["name", "title", "nome", "titulo", "título"],
  url: ["url", "website", "site", "origin"],
  usuario: ["username", "login", "user", "usuario", "usuário", "email"],
  senha: ["password", "senha"],
  notas: ["note", "notes", "nota", "notas"],
};

export interface ResultadoCsv {
  linhas: LinhaImportada[];
  erro?: string;
}

export function lerCsvDeSenhas(texto: string): ResultadoCsv {
  const tabela = lerCsv(texto);
  if (tabela.length < 2) return { linhas: [], erro: "O arquivo não tem linhas de senha." };
  const cab = tabela[0].map((h) => h.trim().toLowerCase());
  const idx = (k: keyof LinhaImportada) => cab.findIndex((h) => COLUNAS[k].includes(h));
  const iSenha = idx("senha");
  if (iSenha === -1) return { linhas: [], erro: "Não achei a coluna de senha (password). Use o CSV exportado pelo Google." };
  const iTitulo = idx("titulo"), iUrl = idx("url"), iUsuario = idx("usuario"), iNotas = idx("notas");
  const get = (row: string[], i: number) => (i >= 0 ? (row[i] ?? "").trim() : "");
  const linhas = tabela.slice(1).map((row) => {
    const url = get(row, iUrl) || null;
    let titulo = get(row, iTitulo);
    if (!titulo && url) {
      try { titulo = new URL(url.includes("://") ? url : `https://${url}`).hostname.replace(/^www\./, ""); } catch { titulo = url; }
    }
    return {
      titulo,
      url,
      usuario: get(row, iUsuario) || null,
      senha: iSenha >= 0 ? row[iSenha] ?? "" : "",
      notas: get(row, iNotas) || null,
    };
  });
  return { linhas };
}
