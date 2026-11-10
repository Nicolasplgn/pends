"use client";

import { useEffect, useState } from "react";
import type { Project } from "@prisma/client";
import { X, FileText, Copy, Check, MessageCircle } from "lucide-react";
import { buildStatusReport } from "../../actions";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  defaultProjectId?: string | null;
}

/** Relatório de status pronto pra colar no WhatsApp/e-mail. */
export function ReportModal({ isOpen, onClose, projects, defaultProjectId }: Props) {
  const [projectId, setProjectId] = useState<string>(defaultProjectId ?? "");
  const [days, setDays] = useState(14);
  // Resultado guardado com a "chave" do pedido: se a chave mudou, está carregando
  const [result, setResult] = useState<{ key: string; text: string } | null>(null);
  const [edited, setEdited] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const reqKey = `${projectId}|${days}`;
  const loading = result?.key !== reqKey;
  const text = edited ?? (loading ? "" : result!.text);

  useEffect(() => {
    if (!isOpen) return;
    let alive = true;
    buildStatusReport(projectId || null, days).then((r) => {
      if (!alive) return;
      setEdited(null);
      setResult({ key: `${projectId}|${days}`, text: r.text });
    });
    return () => { alive = false; };
  }, [isOpen, projectId, days]);

  if (!isOpen) return null;

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm sm:p-4" onClick={onClose}>
      <div className="w-full sm:max-w-2xl max-h-[92dvh] flex flex-col rounded-t-3xl sm:rounded-3xl border border-slate-800 bg-[#0a0f1d] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h2 className="flex items-center gap-2 text-sm font-bold text-white uppercase tracking-wider font-mono">
            <FileText size={15} className="text-blue-400" /> Relatório de status
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer" aria-label="Fechar"><X size={18} /></button>
        </div>

        <div className="p-4 sm:p-5 space-y-3 overflow-y-auto">
          <div className="flex flex-wrap gap-2">
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)}
              className="flex-1 min-w-40 bg-[#050811] border border-slate-800 rounded-lg px-3 py-2 text-sm text-white outline-none">
              <option value="">Todos os projetos</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
            <select value={days} onChange={(e) => setDays(Number(e.target.value))}
              className="bg-[#050811] border border-slate-800 rounded-lg px-3 py-2 text-sm text-white outline-none" aria-label="Período dos entregues">
              <option value={7}>Entregues: 7 dias</option>
              <option value={14}>Entregues: 14 dias</option>
              <option value={30}>Entregues: 30 dias</option>
            </select>
          </div>

          <textarea
            value={loading && edited === null ? "Montando…" : text}
            onChange={(e) => setEdited(e.target.value)}
            rows={16}
            className="w-full bg-[#050811] border border-slate-800 rounded-xl p-3 text-[13px] leading-relaxed text-slate-200 font-mono outline-none focus:border-blue-500 resize-y"
          />
          <p className="text-[10px] text-slate-500 font-mono">Dá pra editar o texto antes de copiar. Os *asteriscos* viram negrito no WhatsApp.</p>
        </div>

        <div className="flex flex-wrap justify-end gap-2 px-5 py-4 border-t border-slate-800 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(text)}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-emerald-500/40 text-emerald-300 text-xs font-bold hover:bg-emerald-500/10"
          >
            <MessageCircle size={14} /> Abrir no WhatsApp
          </a>
          <button onClick={() => void copy()} disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-500 disabled:opacity-50 cursor-pointer">
            {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copiado" : "Copiar texto"}
          </button>
        </div>
      </div>
    </div>
  );
}
