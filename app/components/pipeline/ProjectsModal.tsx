"use client";

import { useState } from "react";
import { X, FolderKanban, Pencil, Trash2, Check } from "lucide-react";
import type { Project } from "@prisma/client";
import { deleteProject, saveProject } from "../../actions";

const COLORS = ["#8B5CF6", "#3B82F6", "#06B6D4", "#10B981", "#F59E0B", "#EC4899", "#F43F5E", "#64748B"];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  projects: (Project & { _count?: { cards: number } })[];
  onChanged: () => void;
}

export function ProjectsModal({ isOpen, onClose, projects, onChanged }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  function startNew() {
    setEditing("new");
    setTitle("");
    setColor(COLORS[projects.length % COLORS.length]);
    setError("");
  }

  async function save() {
    try {
      await saveProject({ id: editing === "new" ? undefined : editing ?? undefined, title, color });
      setEditing(null);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm sm:p-4" onClick={onClose}>
      <div className="w-full sm:max-w-md max-h-[90dvh] flex flex-col rounded-t-3xl sm:rounded-3xl border border-slate-800 bg-[#0a0f1d] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h2 className="flex items-center gap-2 text-sm font-bold text-white uppercase tracking-wider font-mono">
            <FolderKanban size={15} className="text-violet-400" /> Projetos
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer" aria-label="Fechar"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-3 overflow-y-auto pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <p className="text-[11px] text-slate-500 font-mono">Cliente ou frente de trabalho (Wave, Gambine…). Cada card pode ter um projeto, e o relatório sai por projeto.</p>

          {projects.map((p) =>
            editing === p.id ? (
              <EditRow key={p.id} title={title} setTitle={setTitle} color={color} setColor={setColor} onSave={save} onCancel={() => setEditing(null)} />
            ) : (
              <div key={p.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-slate-800 bg-[#050811]">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                <span className="flex-1 min-w-0 text-sm text-slate-100 truncate">{p.title}</span>
                <span className="text-[10px] font-mono text-slate-500">{p._count?.cards ?? 0} cards</span>
                <button onClick={() => { setEditing(p.id); setTitle(p.title); setColor(p.color); setError(""); }} className="p-1.5 text-slate-500 hover:text-white cursor-pointer" aria-label="Editar"><Pencil size={13} /></button>
                <button
                  onClick={async () => {
                    if (!confirm(`Excluir o projeto "${p.title}"? Os cards continuam, só ficam sem projeto.`)) return;
                    await deleteProject(p.id);
                    onChanged();
                  }}
                  className="p-1.5 text-slate-500 hover:text-rose-400 cursor-pointer"
                  aria-label="Excluir"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            )
          )}

          {editing === "new" ? (
            <EditRow title={title} setTitle={setTitle} color={color} setColor={setColor} onSave={save} onCancel={() => setEditing(null)} />
          ) : (
            <button onClick={startNew} className="w-full py-2.5 rounded-xl border-2 border-dashed border-slate-700 hover:border-violet-500/60 text-slate-400 hover:text-violet-300 text-xs font-bold font-mono cursor-pointer">
              + Novo projeto
            </button>
          )}
          {error && <p className="text-xs text-rose-400">{error}</p>}
        </div>
      </div>
    </div>
  );
}

function EditRow({ title, setTitle, color, setColor, onSave, onCancel }: {
  title: string; setTitle: (v: string) => void; color: string; setColor: (v: string) => void; onSave: () => void; onCancel: () => void;
}) {
  return (
    <div className="rounded-xl border border-violet-500/40 bg-violet-500/5 p-3 space-y-2.5">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") onSave(); if (e.key === "Escape") onCancel(); }}
        placeholder="Nome do projeto"
        className="w-full bg-[#050811] border border-slate-800 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
      />
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5">
          {COLORS.map((c) => (
            <button key={c} type="button" onClick={() => setColor(c)} aria-label={`Cor ${c}`}
              className={`w-6 h-6 rounded-full cursor-pointer ${color === c ? "ring-2 ring-white ring-offset-2 ring-offset-[#0a0f1d]" : ""}`}
              style={{ backgroundColor: c }} />
          ))}
        </div>
        <div className="flex gap-1">
          <button onClick={onCancel} className="px-2 py-1 text-xs text-slate-400 cursor-pointer">cancelar</button>
          <button onClick={onSave} className="flex items-center gap-1 px-3 py-1 rounded-lg bg-violet-500 text-white text-xs font-bold cursor-pointer"><Check size={12} /> Salvar</button>
        </div>
      </div>
    </div>
  );
}
