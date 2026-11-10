"use client";

import { useEffect, useState } from "react";
import { X, Archive, Search, RotateCcw, ChevronDown, ChevronRight } from "lucide-react";
import { getArchivedCards, restoreArchivedCard } from "../../actions";

type Data = Awaited<ReturnType<typeof getArchivedCards>>;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onRestored: () => void;
}

const fmt = (d: Date | string | null) =>
  d ? new Date(d).toLocaleDateString("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "2-digit" }) : "—";

/** Busca nos cards arquivados (linha compacta) e restaura se precisar. */
export function ArchiveModal({ isOpen, onClose, onRestored }: Props) {
  const [query, setQuery] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => {
      getArchivedCards(query).then(setData).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [isOpen, query]);

  if (!isOpen) return null;

  async function restore(id: string) {
    setBusy(id);
    try {
      await restoreArchivedCard(id);
      setData((d) => d && { total: d.total - 1, items: d.items.filter((i) => i.id !== id) });
      onRestored();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm sm:p-4" onClick={onClose}>
      <div
        className="w-full sm:max-w-2xl max-h-[90dvh] flex flex-col rounded-t-3xl sm:rounded-3xl border border-slate-800 bg-[#0a0f1d] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h2 className="flex items-center gap-2 text-sm font-bold text-white uppercase tracking-wider font-mono">
            <Archive size={15} className="text-emerald-400" /> Arquivo
            {data && <span className="text-[10px] text-slate-500">{data.total}</span>}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-3 overflow-y-auto pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <p className="text-[11px] text-slate-500 font-mono">
            Concluídos há mais de 14 dias vêm pra cá sozinhos, numa linha só (sem o histórico de movimentos), pra o banco ficar leve.
          </p>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por título, anotação, responsável ou módulo…"
              className="w-full bg-[#050811] border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-sm text-white outline-none focus:border-blue-500"
            />
          </div>

          {!data ? (
            <p className="text-center text-xs text-slate-500 font-mono py-8">carregando…</p>
          ) : data.items.length === 0 ? (
            <p className="text-center text-xs text-slate-500 font-mono py-8">{query ? "Nada encontrado." : "O arquivo está vazio."}</p>
          ) : (
            <div className="rounded-2xl border border-slate-800 divide-y divide-slate-800/80 overflow-hidden">
              {data.items.map((a) => (
                <div key={a.id} className="px-3 py-2.5">
                  <div className="flex items-start gap-2">
                    <button
                      type="button"
                      onClick={() => setOpen((o) => (o === a.id ? null : a.id))}
                      className="flex-1 min-w-0 flex items-start gap-2 text-left cursor-pointer"
                      aria-expanded={open === a.id}
                    >
                      {open === a.id ? <ChevronDown size={14} className="mt-0.5 text-slate-500 shrink-0" /> : <ChevronRight size={14} className="mt-0.5 text-slate-500 shrink-0" />}
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: a.moduleColor ?? "#64748b" }} />
                          <span className="text-[13px] text-slate-200 truncate">{a.title}</span>
                        </span>
                        <span className="block text-[10px] font-mono text-slate-500 truncate">
                          {a.moduleTitle ?? "Geral"} · concluído {fmt(a.completedAt)}
                          {a.assignee ? ` · com ${a.assignee}` : ""}
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      disabled={busy === a.id}
                      onClick={() => void restore(a.id)}
                      className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-700 text-[10px] font-mono text-slate-300 hover:text-white disabled:opacity-50 cursor-pointer"
                      title="Voltar para o quadro (etapa final)"
                    >
                      <RotateCcw size={11} /> restaurar
                    </button>
                  </div>
                  {open === a.id && (
                    <p className="mt-2 ml-6 text-[11px] text-slate-400 whitespace-pre-wrap leading-relaxed">
                      {a.notes || "Sem anotações."}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
