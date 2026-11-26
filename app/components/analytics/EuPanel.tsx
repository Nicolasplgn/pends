"use client";

// Seção "Eu" do Analytics: dados do conector pessoal (avisos, discos, projetos da semana,
// GitHub/Claude Code/LinkedIn). Os dados vêm de uma Server Action; o Analytics nunca quebra por ela.

import { useEffect, useMemo, useState } from "react";
import type { Project } from "@prisma/client";
import {
  AlertTriangle, CheckCircle2, Clock, Cpu, ExternalLink, GitBranch, GitCommit, HardDrive, Info, Linkedin, RefreshCw,
  Sparkles, UserRound, WifiOff,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getEuResumo } from "../../actions";
import type { EuAviso, EuPrioridade, EuProjeto, EuResultado, EuStatusProjeto, KanbanColumn } from "../../types";
import { isCardOverdue } from "../../types";

interface EuPanelProps {
  columns: KanbanColumn[];
  projects: Project[];
  onFilterProject: (projectId: string) => void;
}

const HORA = 3600_000;

function haQuanto(iso: string | null, agora: number) {
  if (!iso) return null;
  const ms = agora - new Date(iso).getTime();
  if (Number.isNaN(ms)) return null;
  const min = Math.max(0, Math.round(ms / 60_000));
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `há ${h} h`;
  return `há ${Math.round(h / 24)} dias`;
}

const PRIORIDADE: Record<EuPrioridade, { label: string; cls: string; ordem: number }> = {
  alta: { label: "Alta", cls: "bg-rose-500/15 text-rose-300 border-rose-500/40", ordem: 0 },
  media: { label: "Média", cls: "bg-amber-500/15 text-amber-300 border-amber-500/40", ordem: 1 },
  baixa: { label: "Baixa", cls: "bg-slate-800 text-slate-400 border-slate-700", ordem: 2 },
};

const STATUS: Record<EuStatusProjeto, string> = {
  ativo: "bg-emerald-500/15 text-emerald-300",
  recente: "bg-blue-500/15 text-blue-300",
  parado: "bg-amber-500/15 text-amber-300",
  antigo: "bg-slate-800 text-slate-400",
  desconhecido: "bg-slate-800 text-slate-500",
};

const DISCO_COR: Record<string, string> = { "C:": "#38bdf8", "D:": "#a78bfa" };

const norm = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").trim().toLowerCase();

function Painel({ titulo, icon, children, direita }: { titulo: string; icon: React.ReactNode; children: React.ReactNode; direita?: React.ReactNode }) {
  return (
    <div className="bg-[#0b101f] border border-slate-800/90 rounded-3xl p-4 sm:p-5 min-w-0">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h4 className="text-xs font-bold text-white uppercase tracking-wide font-mono flex items-center gap-2">{icon} {titulo}</h4>
        {direita}
      </div>
      {children}
    </div>
  );
}

export function EuPanel({ columns, projects, onFilterProject }: EuPanelProps) {
  const [resultado, setResultado] = useState<EuResultado | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [agora, setAgora] = useState(() => Date.now());

  async function carregar() {
    setCarregando(true);
    try {
      setResultado(await getEuResumo());
    } catch {
      setResultado({ estado: "indisponivel", motivo: "falha ao chamar o servidor", ultimoSucesso: null });
    } finally {
      setCarregando(false);
      setAgora(Date.now());
    }
  }

  useEffect(() => {
    let vivo = true;
    getEuResumo()
      .then((r) => { if (vivo) setResultado(r); })
      .catch(() => { if (vivo) setResultado({ estado: "indisponivel", motivo: "falha ao chamar o servidor", ultimoSucesso: null }); })
      .finally(() => { if (vivo) { setCarregando(false); setAgora(Date.now()); } });
    return () => { vivo = false; };
  }, []);

  // Cards do Pends por projeto (abertas e atrasadas)
  const porProjeto = useMemo(() => {
    const m = new Map<string, { abertas: number; atrasadas: number }>();
    for (const col of columns) {
      if (col.isDone) continue;
      for (const c of col.cards) {
        if (!c.projectId || c.completed) continue;
        const v = m.get(c.projectId) ?? { abertas: 0, atrasadas: 0 };
        v.abertas++;
        if (isCardOverdue(c.dueDate)) v.atrasadas++;
        m.set(c.projectId, v);
      }
    }
    return m;
  }, [columns]);

  const projetoDoPends = (p: EuProjeto) =>
    p.projeto_no_pends ? projects.find((x) => norm(x.title) === norm(p.projeto_no_pends!)) ?? null : null;

  const cabecalho = (extra?: React.ReactNode) => (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <UserRound size={14} className="text-violet-300" />
          <span className="text-[10px] font-mono uppercase tracking-widest text-violet-300 font-black">Conector Eu</span>
        </div>
        <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">PC, projetos e avisos</h3>
      </div>
      <div className="flex items-center gap-2">
        {extra}
        <button
          type="button"
          onClick={() => void carregar()}
          disabled={carregando}
          className="grid place-items-center w-8 h-8 rounded-lg border border-slate-800 text-slate-400 hover:text-white disabled:opacity-40 cursor-pointer"
          title="Buscar de novo"
          aria-label="Buscar de novo"
        >
          <RefreshCw size={14} className={carregando ? "animate-spin" : ""} />
        </button>
      </div>
    </div>
  );

  const casca = (conteudo: React.ReactNode, extra?: React.ReactNode) => (
    <section className="bg-[#070b14] border border-violet-500/20 rounded-3xl p-4 sm:p-6 shadow-xl">
      {cabecalho(extra)}
      {conteudo}
    </section>
  );

  if (carregando && !resultado) {
    return casca(
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-pulse">
        {[0, 1, 2].map((i) => <div key={i} className="h-40 rounded-3xl bg-slate-900/60" />)}
      </div>
    );
  }

  if (!resultado || resultado.estado !== "ok") {
    const r = resultado;
    const titulo =
      r?.estado === "dev" ? "Indisponível em dev"
        : r?.estado === "oidc_desligado" ? "OIDC da Vercel desligado"
          : "Conector Eu indisponível";
    const detalhe =
      r?.estado === "oidc_desligado"
        ? "Ligue em Vercel → pends → Settings → Security → \"Secure backend access with OIDC federation\" (modo Team)."
        : r?.estado === "dev"
          ? r.motivo
          : r
            ? `Motivo: ${r.motivo}.${r.ultimoSucesso ? ` Último sucesso ${haQuanto(r.ultimoSucesso, agora)}.` : " Ainda sem sucesso nesta instância."}`
            : "";
    return casca(
      <div className="flex items-start gap-3 rounded-2xl border border-slate-800 bg-[#0b101f] p-4">
        {r?.estado === "dev" ? <Info size={18} className="text-slate-400 shrink-0 mt-0.5" /> : <WifiOff size={18} className="text-amber-400 shrink-0 mt-0.5" />}
        <div>
          <p className="text-sm font-bold text-white">{titulo}</p>
          <p className="text-xs text-slate-400 mt-0.5">{detalhe}</p>
        </div>
      </div>
    );
  }

  const d = resultado.dados;
  const idade = d.atualizado_em ? agora - new Date(d.atualizado_em).getTime() : null;
  const velho = idade !== null && idade > 48 * HORA;
  const atualizado = (
    <span className={`inline-flex items-center gap-1 text-[11px] font-mono ${velho ? "text-amber-300" : "text-slate-500"}`} title={d.atualizado_em ?? ""}>
      <Clock size={12} /> {d.atualizado_em ? `atualizado ${haQuanto(d.atualizado_em, agora)}` : "sem data de atualização"}
    </span>
  );

  const avisos = [...d.avisos].sort((a, b) => PRIORIDADE[a.prioridade]?.ordem - PRIORIDADE[b.prioridade]?.ordem);
  const discosCD = d.discos.filter((x) => /^[CD]:?$/i.test(x.letra.replace(/\\$/, "")));
  const discos = discosCD.length ? discosCD : d.discos;
  const historico = d.historico_discos.map((h) => ({ ...h, dia: h.data.slice(8, 10) + "/" + h.data.slice(5, 7) }));
  const letrasHist = (["C:", "D:"] as const).filter((l) => historico.some((h) => typeof h[l] === "number"));
  const projetosSemana = [...d.projetos].sort(
    (a, b) => b.semana.commits + b.semana.sessoes_claude - (a.semana.commits + a.semana.sessoes_claude)
  );

  const avisoItem = (a: EuAviso, i: number) => {
    const p = PRIORIDADE[a.prioridade] ?? PRIORIDADE.baixa;
    const alta = a.prioridade === "alta";
    return (
      <li key={i} className={`flex items-start gap-2.5 rounded-xl border p-2.5 ${alta ? "border-rose-500/40 bg-rose-500/5" : "border-slate-800 bg-[#0b101f]"}`}>
        {alta ? <AlertTriangle size={15} className="text-rose-400 shrink-0 mt-0.5" /> : <Info size={15} className="text-slate-500 shrink-0 mt-0.5" />}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
            <span className={`text-[10px] font-bold px-1.5 py-px rounded border font-mono ${p.cls}`}>{p.label}</span>
            <span className="text-[10px] font-mono text-slate-500 uppercase">{a.area}</span>
          </div>
          <p className={`text-[13px] ${alta ? "text-white font-semibold" : "text-slate-200"}`}>{a.texto}</p>
          {a.sugestao && <p className="text-[11px] text-slate-400 mt-0.5">→ {a.sugestao}</p>}
        </div>
      </li>
    );
  };

  return casca(
    <div className="space-y-4">
      {/* 1. AVISOS */}
      {avisos.length > 0 ? (
        <ul className="grid grid-cols-1 lg:grid-cols-2 gap-2">{avisos.map(avisoItem)}</ul>
      ) : (
        <p className="flex items-center gap-2 text-xs text-emerald-300"><CheckCircle2 size={14} /> Nenhum aviso do Eu agora.</p>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        {/* 2. DISCOS */}
        <div className="xl:col-span-2">
          <Painel titulo="Discos" icon={<HardDrive size={14} className="text-sky-400" />}>
            <div className="space-y-3">
              {discos.map((x) => {
                const cheio = x.usado_pct >= 90;
                return (
                  <div key={x.letra}>
                    <div className="flex items-baseline justify-between text-xs mb-1">
                      <span className="text-slate-200 font-semibold">{x.letra} <span className="text-slate-500 font-normal">{x.rotulo}</span></span>
                      <span className="font-mono text-slate-400">
                        <b className={cheio ? "text-rose-300" : "text-white"}>{x.livre_gb.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} GB</b> livres de {Math.round(x.total_gb)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-900 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${cheio ? "bg-rose-500" : x.usado_pct >= 75 ? "bg-amber-500" : "bg-sky-500"}`}
                        style={{ width: `${Math.min(100, Math.max(0, x.usado_pct))}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4">
              <p className="text-[10px] font-mono uppercase text-slate-500 mb-1">GB livres · 30 dias</p>
              {historico.length < 2 ? (
                <p className="text-xs text-slate-500 py-6 text-center border border-dashed border-slate-800 rounded-xl">Histórico começando</p>
              ) : (
                <div className="h-36 -ml-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={historico} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                      <defs>
                        {letrasHist.map((l) => (
                          <linearGradient key={l} id={`eu-${l[0]}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={DISCO_COR[l]} stopOpacity={0.4} />
                            <stop offset="100%" stopColor={DISCO_COR[l]} stopOpacity={0} />
                          </linearGradient>
                        ))}
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="dia" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} minTickGap={16} />
                      <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} width={34} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "rgba(10,15,29,0.92)", border: "1px solid #334155", borderRadius: 12, fontSize: 12 }}
                        formatter={(v, n) => [`${Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} GB`, n]}
                      />
                      {letrasHist.map((l) => (
                        <Area key={l} type="monotone" dataKey={l} name={l} stroke={DISCO_COR[l]} strokeWidth={2} fill={`url(#eu-${l[0]})`} connectNulls />
                      ))}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </Painel>
        </div>

        {/* 3. PROJETOS DA SEMANA */}
        <div className="xl:col-span-3">
          <Painel
            titulo="Projetos da semana"
            icon={<GitBranch size={14} className="text-emerald-400" />}
            direita={d.semana.periodo ? <span className="text-[10px] font-mono text-slate-500">{d.semana.periodo}</span> : null}
          >
            {projetosSemana.length === 0 ? (
              <p className="text-xs text-slate-500">Nenhum projeto no resumo.</p>
            ) : (
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[10px] font-mono uppercase text-slate-500 text-left">
                      <th className="px-1 py-1.5 font-medium">Projeto</th>
                      <th className="px-1 py-1.5 font-medium">Status</th>
                      <th className="px-1 py-1.5 font-medium text-right" title="Commits na semana">Commits</th>
                      <th className="px-1 py-1.5 font-medium text-right" title="Sessões do Claude na semana">Claude</th>
                      <th className="px-1 py-1.5 font-medium">Último commit</th>
                      <th className="px-1 py-1.5 font-medium">No Pends</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projetosSemana.map((p) => {
                      const pp = projetoDoPends(p);
                      const cont = pp ? porProjeto.get(pp.id) ?? { abertas: 0, atrasadas: 0 } : null;
                      return (
                        <tr key={p.nome} className="border-t border-slate-800/70 align-top">
                          <td className="px-1 py-2">
                            <p className="font-semibold text-slate-100">{p.nome}</p>
                            {p.stack.length > 0 && <p className="text-[10px] text-slate-500 truncate max-w-40">{p.stack.slice(0, 3).join(" · ")}</p>}
                            {p.alteracoes_sem_commit > 0 && (
                              <p className="text-[10px] text-amber-300">{p.alteracoes_sem_commit} alteração(ões) sem commit</p>
                            )}
                          </td>
                          <td className="px-1 py-2">
                            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${STATUS[p.status] ?? STATUS.desconhecido}`}>{p.status}</span>
                          </td>
                          <td className="px-1 py-2 text-right font-mono text-slate-200">{p.semana.commits}</td>
                          <td className="px-1 py-2 text-right font-mono text-slate-200">{p.semana.sessoes_claude}</td>
                          <td className="px-1 py-2 max-w-56">
                            {p.ultimo_commit ? (
                              <>
                                <p className="text-slate-300 truncate" title={p.ultimo_commit.mensagem}>
                                  <GitCommit size={11} className="inline mr-1 text-slate-500" />{p.ultimo_commit.mensagem}
                                </p>
                                <p className="text-[10px] text-slate-500">{haQuanto(p.ultimo_commit.data, agora)}</p>
                              </>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>
                          <td className="px-1 py-2">
                            {pp && cont ? (
                              <button
                                type="button"
                                onClick={() => onFilterProject(pp.id)}
                                className="text-left rounded-lg px-1.5 py-1 -mx-1.5 hover:bg-slate-800 cursor-pointer"
                                title={`Ver as pendências de ${pp.title} no Pipeline`}
                              >
                                <span className="inline-flex items-center gap-1 font-semibold" style={{ color: pp.color }}>
                                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: pp.color }} />
                                  {pp.title}
                                </span>
                                <span className="block text-[10px] font-mono text-slate-400">
                                  {cont.abertas} abertas{cont.atrasadas > 0 && <b className="text-rose-300"> · {cont.atrasadas} atrasadas</b>}
                                </span>
                              </button>
                            ) : p.projeto_no_pends ? (
                              <span className="text-[10px] text-slate-500" title="Projeto não encontrado no Pends">{p.projeto_no_pends}?</span>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Painel>
        </div>
      </div>

      {/* 4. RODAPÉ: GitHub · Claude Code · LinkedIn */}
      <div className="flex flex-col lg:flex-row lg:items-start gap-3 lg:gap-6 text-xs border-t border-slate-800/70 pt-3">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-slate-300 font-semibold mb-1">
            <GitBranch size={13} className="text-slate-400" /> GitHub
            {d.github && <span className="text-slate-500 font-normal">@{d.github.login} · {d.github.repos} repos</span>}
          </p>
          {!d.github ? (
            <p className="text-slate-500">Sem dados do GitHub.</p>
          ) : d.github.prs_abertos.length === 0 ? (
            <p className="text-slate-500">Nenhum PR aberto.</p>
          ) : (
            <ul className="space-y-0.5">
              {d.github.prs_abertos.slice(0, 5).map((pr) => (
                <li key={pr.url} className="truncate">
                  <a href={pr.url} target="_blank" rel="noopener noreferrer" className="text-blue-300 hover:underline inline-flex items-center gap-1">
                    {pr.repo}#{pr.numero} <ExternalLink size={10} />
                  </a>{" "}
                  <span className="text-slate-400">{pr.titulo}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="flex items-center gap-1.5 text-slate-300 shrink-0">
          <Cpu size={13} className="text-slate-400" /> Claude Code:{" "}
          {d.claude_code ? (
            <span className="text-slate-400">{d.claude_code.skills} skills · {d.claude_code.agentes} agentes · {d.claude_code.conectores.length} conectores</span>
          ) : (
            <span className="text-slate-500">sem dados</span>
          )}
        </p>
        <p className="flex items-center gap-1.5 text-slate-300 shrink-0">
          <Linkedin size={13} className="text-slate-400" /> LinkedIn:{" "}
          {d.linkedin ? (
            <span className="text-slate-400" title={d.linkedin.titulo}>importado {haQuanto(d.linkedin.importado_em, agora)} · {d.linkedin.experiencias} experiências</span>
          ) : (
            <span className="text-slate-500">não importado</span>
          )}
        </p>
      </div>
      <p className="flex items-center gap-1 text-[10px] text-slate-600 font-mono"><Sparkles size={10} /> dados do Eu em cache por 5 min</p>
    </div>,
    atualizado
  );
}
