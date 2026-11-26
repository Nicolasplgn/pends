// lib/eu.ts
// Busca o resumo do conector pessoal "Eu" (https://eu-mcp.vercel.app/api/resumo).
// Só roda no servidor (é chamado por uma Server Action, nunca pelo navegador). Autentica com o token OIDC da Vercel deste projeto (sem chave/segredo).
// Nunca lança erro para quem chama: devolve um estado ("ok", "dev", "oidc_desligado", "indisponivel").

import { unstable_cache } from "next/cache";
import { getVercelOidcToken } from "@vercel/oidc";
import type { EuResultado, EuResumo } from "../app/types/eu";

const EU_URL = "https://eu-mcp.vercel.app/api/resumo";
const TIMEOUT_MS = 5000;

/** Último sucesso nesta instância do servidor (para o card de "indisponível"). */
let ultimoSucesso: string | null = null;

class OidcIndisponivel extends Error {}

async function tokenOidc() {
  try {
    return await getVercelOidcToken();
  } catch (e) {
    throw new OidcIndisponivel(e instanceof Error ? e.message : "sem token OIDC");
  }
}

/** Confere o mínimo do formato para a tela não quebrar com uma resposta inesperada. */
function normalizar(raw: unknown): EuResumo {
  const r = (raw ?? {}) as Partial<EuResumo>;
  const arr = <T,>(v: unknown) => (Array.isArray(v) ? (v as T[]) : []);
  return {
    atualizado_em: typeof r.atualizado_em === "string" ? r.atualizado_em : null,
    avisos: arr(r.avisos),
    discos: arr(r.discos),
    historico_discos: arr(r.historico_discos),
    projetos: arr(r.projetos),
    semana: r.semana && typeof r.semana === "object" ? { periodo: r.semana.periodo ?? "", por_dia: r.semana.por_dia ?? {} } : { periodo: "", por_dia: {} },
    github: r.github ?? null,
    claude_code: r.claude_code ?? null,
    linkedin: r.linkedin ?? null,
  };
}

const buscarResumo = unstable_cache(
  async (): Promise<{ dados: EuResumo; buscadoEm: string }> => {
    const token = await tokenOidc();
    const res = await fetch(EU_URL, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`o Eu respondeu ${res.status}`);
    const dados = normalizar(await res.json());
    const buscadoEm = new Date().toISOString();
    ultimoSucesso = buscadoEm;
    return { dados, buscadoEm };
  },
  ["eu-resumo-v1"],
  { revalidate: 300 } // cache de 5 minutos
);

export async function obterResumoEu(): Promise<EuResultado> {
  const naVercel = process.env.VERCEL === "1";
  // Em dev o token só existe depois de `vercel env pull` (VERCEL_OIDC_TOKEN, vale 12 h)
  if (!naVercel && !process.env.VERCEL_OIDC_TOKEN) {
    return { estado: "dev", motivo: "Sem VERCEL_OIDC_TOKEN neste ambiente (rode `vercel env pull`)." };
  }
  try {
    const { dados, buscadoEm } = await buscarResumo();
    return { estado: "ok", dados, buscadoEm };
  } catch (e) {
    if (e instanceof OidcIndisponivel) {
      return naVercel
        ? { estado: "oidc_desligado", motivo: e.message }
        : { estado: "dev", motivo: "Token OIDC local vencido ou inválido (rode `vercel env pull` de novo)." };
    }
    const motivo =
      e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")
        ? "demorou mais de 5 s"
        : e instanceof Error
          ? e.message.slice(0, 120)
          : "erro desconhecido";
    console.error("Conector Eu indisponível:", e);
    return { estado: "indisponivel", motivo, ultimoSucesso };
  }
}
