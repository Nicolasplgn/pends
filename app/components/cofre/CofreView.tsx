"use client";

// Aba "Cofre": acessos (título, usuário, URL, projeto) com a senha sempre escondida.
// Revelar/Copiar pedem a senha do Pends de novo (vale 5 min). A senha revelada some em 30 s.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Module } from "@prisma/client";
import {
  Copy, Eye, EyeOff, ExternalLink, FileUp, History, KeyRound, Lock, LockOpen, Pencil, Plus, Search, Trash2, X,
} from "lucide-react";
import {
  apagarCredencialCofre, getCofre, historicoCredencialCofre, revelarCredencialCofre, trancarCofre,
} from "@/app/actions";
import { ConfirmModal } from "../shared/ConfirmModal";
import { CredencialModal } from "./CredencialModal";
import { ImportarGoogleModal } from "./ImportarGoogleModal";
import { ReauthModal } from "./ReauthModal";

type CofreData = Awaited<ReturnType<typeof getCofre>>;
export type CofreItem = CofreData["credenciais"][number];
type LogItem = Awaited<ReturnType<typeof historicoCredencialCofre>>[number];

const host = (url: string | null) => {
  if (!url) return null;
  try { return new URL(url.includes("://") ? url : `https://${url}`).hostname.replace(/^www\./, ""); } catch { return url; }
};
const href = (url: string) => (url.includes("://") ? url : `https://${url}`);
const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const ACAO: Record<string, string> = {
  criou: "criou", revelou: "revelou a senha", copiou: "copiou a senha", editou: "editou", apagou: "apagou", importou: "importou",
};

export function CofreView({ modules }: { modules: Module[] }) {
  const [data, setData] = useState<CofreData | null>(null);
  const [texto, setTexto] = useState("");
  const [projeto, setProjeto] = useState("");
  const [agora, setAgora] = useState(() => Date.now());
  const [reauthAte, setReauthAte] = useState<number | null>(null);
  const [revelada, setRevelada] = useState<{ id: string; senha: string; notas: string | null; ate: number } | null>(null);
  const [reauthOpen, setReauthOpen] = useState(false);
  const pendente = useRef<(() => void) | null>(null);
  const [editando, setEditando] = useState<CofreItem | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [apagar, setApagar] = useState<CofreItem | null>(null);
  const [historico, setHistorico] = useState<{ item: CofreItem; logs: LogItem[] | null } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const d = await getCofre({ texto, projeto });
    setData(d);
    setReauthAte(d.reauthAte);
  }, [texto, projeto]);

  // Busca com pequeno atraso enquanto digita
  useEffect(() => {
    const t = setTimeout(() => { void carregar(); }, 250);
    return () => clearTimeout(t);
  }, [carregar]);

  // Relógio para os contadores (5 min de liberação, 30 s da senha revelada)
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // A senha revelada some sozinha
  useEffect(() => {
    if (!revelada) return;
    const t = setTimeout(() => setRevelada(null), Math.max(0, revelada.ate - Date.now()));
    return () => clearTimeout(t);
  }, [revelada]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const liberado = reauthAte !== null && reauthAte > agora;

  function exigirReauth(depois: () => void) {
    pendente.current = depois;
    setReauthOpen(true);
  }

  async function revelar(item: CofreItem, modo: "revelou" | "copiou") {
    const r = await revelarCredencialCofre(item.id, modo);
    if (!r.ok) {
      if (r.precisaReauth) exigirReauth(() => void revelar(item, modo));
      else setToast(r.erro);
      return;
    }
    if (modo === "copiou") {
      try {
        await navigator.clipboard.writeText(r.senha);
        setToast(`Senha de "${item.titulo}" copiada`);
      } catch {
        setToast("O navegador não deixou copiar. Use Revelar.");
      }
    } else {
      setRevelada({ id: item.id, senha: r.senha, notas: r.notas, ate: r.esconderEm });
    }
    void carregar();
  }

  async function abrirHistorico(item: CofreItem) {
    setHistorico({ item, logs: null });
    const logs = await historicoCredencialCofre(item.id);
    setHistorico({ item, logs });
  }

  const lista = data?.credenciais ?? [];
  const projetos = useMemo(() => data?.projetos ?? [], [data]);

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-6 lg:p-8 space-y-4 bg-[#050811] text-slate-200">
      {toast && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-70 px-4 py-2.5 rounded-xl bg-[#0b101f] border border-slate-700 text-xs text-slate-100 shadow-2xl">{toast}</div>
      )}

      {/* CABEÇALHO */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid place-items-center w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"><KeyRound size={18} /></span>
          <div>
            <h2 className="text-xl font-black text-white tracking-tight">Cofre</h2>
            <p className="text-[11px] text-slate-500 font-mono">{lista.length} acesso(s) · senhas cifradas (AES-256-GCM)</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {liberado ? (
            <button
              type="button"
              onClick={async () => { await trancarCofre(); setReauthAte(null); setRevelada(null); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-xs font-semibold cursor-pointer"
              title="Trancar agora"
            >
              <LockOpen size={14} /> Liberado · {mmss(reauthAte! - agora)}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => exigirReauth(() => {})}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-800 text-slate-400 text-xs font-semibold hover:text-white cursor-pointer"
              title="Confirmar a senha para revelar e copiar por 5 minutos"
            >
              <Lock size={14} /> Trancado
            </button>
          )}
          <button type="button" onClick={() => setImportOpen(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-700 text-slate-300 text-xs font-semibold hover:text-white cursor-pointer">
            <FileUp size={14} /> Importar do Google
          </button>
          <button type="button" onClick={() => { setEditando(null); setFormOpen(true); }} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 text-slate-950 text-xs font-bold hover:bg-emerald-400 cursor-pointer">
            <Plus size={14} /> Novo acesso
          </button>
        </div>
      </div>

      {/* BUSCA E FILTRO */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar por título, site, usuário ou tag" className="w-full bg-[#0b101f] border border-slate-800 pl-8 pr-3 py-2 rounded-xl text-xs text-white placeholder:text-slate-500 outline-none focus:border-emerald-500" />
        </div>
        <select value={projeto} onChange={(e) => setProjeto(e.target.value)} className="bg-[#0b101f] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 outline-none cursor-pointer" aria-label="Filtrar por projeto">
          <option value="">Todos os projetos</option>
          {projetos.map((p) => <option key={p} value={p}>{p}</option>)}
          <option value="__sem">Sem projeto</option>
        </select>
      </div>

      {/* LISTA */}
      {!data ? (
        <div className="space-y-2 animate-pulse">{[0, 1, 2].map((i) => <div key={i} className="h-14 rounded-2xl bg-slate-900/60" />)}</div>
      ) : lista.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-800 p-10 text-center">
          <KeyRound size={28} className="mx-auto text-slate-600 mb-3" />
          <p className="text-sm text-slate-300 font-semibold">{texto || projeto ? "Nada encontrado com esse filtro." : "O cofre está vazio."}</p>
          {!texto && !projeto && <p className="text-xs text-slate-500 mt-1">Cadastre um acesso ou importe as senhas do Google.</p>}
        </div>
      ) : (
        <div className="rounded-3xl border border-slate-800 bg-[#0b101f] divide-y divide-slate-800/70 overflow-hidden">
          {lista.map((c) => {
            const aberta = revelada?.id === c.id ? revelada : null;
            const h = host(c.url);
            return (
              <div key={c.id} className="px-4 py-3 flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                <div className="min-w-0 md:w-64 shrink-0">
                  <p className="text-sm font-semibold text-white truncate">{c.titulo}</p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                    {c.projeto && <span className="text-[10px] font-mono px-1.5 py-px rounded bg-violet-500/15 text-violet-300">{c.projeto}</span>}
                    {c.tags.slice(0, 3).map((t) => <span key={t} className="text-[10px] font-mono px-1.5 py-px rounded bg-slate-800 text-slate-400">{t}</span>)}
                  </div>
                </div>
                <div className="min-w-0 flex-1 grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-3 text-xs">
                  <button
                    type="button"
                    onClick={() => { if (c.usuario) { void navigator.clipboard.writeText(c.usuario).then(() => setToast("Usuário copiado"), () => {}); } }}
                    className="text-left truncate text-slate-300 hover:text-white cursor-pointer"
                    title={c.usuario ? "Copiar usuário" : undefined}
                  >
                    {c.usuario ?? <span className="text-slate-600">sem usuário</span>}
                  </button>
                  {h ? (
                    <a href={href(c.url!)} target="_blank" rel="noopener noreferrer" className="truncate text-blue-300 hover:underline inline-flex items-center gap-1">
                      {h} <ExternalLink size={10} />
                    </a>
                  ) : <span className="text-slate-600">sem URL</span>}
                  <span className={`font-mono truncate ${aberta ? "text-emerald-300 select-all" : "text-slate-500 tracking-widest"}`} title={aberta ? undefined : "Senha escondida"}>
                    {aberta ? aberta.senha : "••••••"}
                    {aberta && <span className="ml-2 text-[10px] text-slate-500 tracking-normal">some em {mmss(aberta.ate - agora)}</span>}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => (aberta ? setRevelada(null) : void revelar(c, "revelou"))}
                    className="grid place-items-center w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                    title={aberta ? "Esconder" : "Revelar (30 s)"}
                    aria-label={aberta ? "Esconder senha" : "Revelar senha"}
                  >
                    {aberta ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                  <button type="button" onClick={() => void revelar(c, "copiou")} className="grid place-items-center w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer" title="Copiar senha" aria-label="Copiar senha">
                    <Copy size={15} />
                  </button>
                  <button type="button" onClick={() => void abrirHistorico(c)} className="grid place-items-center w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer" title="Histórico de acessos" aria-label="Histórico de acessos">
                    <History size={15} />
                  </button>
                  <button type="button" onClick={() => { setEditando(c); setFormOpen(true); }} className="grid place-items-center w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer" title="Editar" aria-label="Editar">
                    <Pencil size={14} />
                  </button>
                  <button type="button" onClick={() => setApagar(c)} className="grid place-items-center w-8 h-8 rounded-lg text-slate-500 hover:text-rose-300 hover:bg-rose-500/10 cursor-pointer" title="Apagar" aria-label="Apagar">
                    <Trash2 size={14} />
                  </button>
                </div>
                {aberta?.notas && (
                  <p className="md:basis-full text-[11px] text-slate-300 whitespace-pre-wrap bg-[#050811] border border-slate-800 rounded-lg p-2">{aberta.notas}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <CredencialModal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={(m) => { setToast(m); void carregar(); }}
        inicial={editando}
        projetos={projetos}
        modules={modules}
      />
      <ImportarGoogleModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        onDone={(m) => { setToast(m); void carregar(); }}
        projetos={projetos}
        precisaReauth={exigirReauth}
      />
      <ReauthModal
        isOpen={reauthOpen}
        onClose={() => { setReauthOpen(false); pendente.current = null; }}
        onConfirmed={(ate) => {
          setReauthAte(ate);
          setReauthOpen(false);
          const p = pendente.current;
          pendente.current = null;
          p?.();
        }}
      />
      <ConfirmModal
        isOpen={!!apagar}
        onClose={() => setApagar(null)}
        title="Apagar este acesso?"
        description={apagar ? `"${apagar.titulo}" sai do cofre de vez. O histórico de acessos fica guardado.` : ""}
        confirmText="Apagar"
        danger
        onConfirm={async () => {
          if (!apagar) return;
          const r = await apagarCredencialCofre(apagar.id);
          setApagar(null);
          setToast(r.ok ? "Acesso apagado" : r.erro);
          void carregar();
        }}
      />

      {historico && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm grid place-items-center p-4" onClick={() => setHistorico(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md max-h-[80vh] overflow-y-auto rounded-2xl border border-slate-800 bg-[#0a0f1d] p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2"><History size={15} /> {historico.item.titulo}</h3>
              <button type="button" onClick={() => setHistorico(null)} className="text-slate-400 hover:text-white cursor-pointer" aria-label="Fechar"><X size={16} /></button>
            </div>
            {!historico.logs ? (
              <p className="text-xs text-slate-500">Carregando…</p>
            ) : historico.logs.length === 0 ? (
              <p className="text-xs text-slate-500">Sem registros.</p>
            ) : (
              <ul className="space-y-1.5 text-xs">
                {historico.logs.map((l, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 border-b border-slate-800/60 pb-1.5">
                    <span className="text-slate-200">{ACAO[l.acao] ?? l.acao}</span>
                    <span className="flex items-center gap-2 text-slate-500 font-mono">
                      <span className={`px-1.5 rounded ${l.origem === "mcp" ? "bg-violet-500/15 text-violet-300" : "bg-slate-800 text-slate-400"}`}>{l.origem === "mcp" ? "Claude" : "app"}</span>
                      {new Date(l.quando).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
