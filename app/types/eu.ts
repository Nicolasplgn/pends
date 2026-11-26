// Dados do conector pessoal "Eu" (GET https://eu-mcp.vercel.app/api/resumo).

export type EuPrioridade = "alta" | "media" | "baixa";
export type EuStatusProjeto = "ativo" | "recente" | "parado" | "antigo" | "desconhecido";

export interface EuAviso {
  prioridade: EuPrioridade;
  area: string;
  texto: string;
  sugestao?: string;
}

export interface EuDisco {
  letra: string;
  rotulo: string;
  livre_gb: number;
  total_gb: number;
  usado_pct: number;
}

/** GB livres por dia (últimos 30 dias). */
export interface EuHistoricoDisco {
  data: string;
  "C:"?: number;
  "D:"?: number;
}

export interface EuProjeto {
  nome: string;
  projeto_no_pends: string | null;
  status: EuStatusProjeto;
  stack: string[];
  ultima_atividade: string | null;
  ultimo_commit: { data: string; mensagem: string } | null;
  alteracoes_sem_commit: number;
  semana: { commits: number; sessoes_claude: number };
}

export interface EuResumo {
  atualizado_em: string | null;
  avisos: EuAviso[];
  discos: EuDisco[];
  historico_discos: EuHistoricoDisco[];
  projetos: EuProjeto[];
  semana: { periodo: string; por_dia: Record<string, string> };
  github: { login: string; repos: number; prs_abertos: { repo: string; numero: number; titulo: string; url: string }[] } | null;
  claude_code: { skills: number; agentes: number; conectores: string[] } | null;
  linkedin: { titulo: string; experiencias: number; importado_em: string } | null;
}

/** O que a seção do Analytics recebe: nunca lança erro, sempre um estado. */
export type EuResultado =
  | { estado: "ok"; dados: EuResumo; buscadoEm: string }
  | { estado: "dev"; motivo: string }
  | { estado: "oidc_desligado"; motivo: string }
  | { estado: "indisponivel"; motivo: string; ultimoSucesso: string | null };
