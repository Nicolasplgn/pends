"use client";

import { useEffect, useState } from "react";
import type { Module } from "@prisma/client";
import { 
  AlertTriangle, Trash2, X, AlignLeft, MessageSquare, Send 
} from "lucide-react";
import type { CardDetails } from "../../types";
import { isCardOverdue } from "../../types";
import { 
  getCardDetails, updateCardDetails, addComment, deleteCard 
} from "../../actions";

interface CardDetailModalProps {
  cardId: string | null;
  isOpen: boolean;
  onClose: () => void;
  modules: Module[];
  onReload: () => void;
}

export function CardDetailModal({
  cardId,
  isOpen,
  onClose,
  modules,
  onReload,
}: CardDetailModalProps) {
  const [data, setData] = useState<CardDetails | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [priority, setPriority] = useState("Normal");
  const [dueDate, setDueDate] = useState("");
  const [moduleId, setModuleId] = useState("");
  const [commentText, setCommentText] = useState("");

  useEffect(() => {
    if (!isOpen || !cardId) return;
    let cancelled = false;

    getCardDetails(cardId).then((card) => {
      if (cancelled || !card) return;
      setData(card);
      setTitle(card.title);
      setDesc(card.description || "");
      setPriority(card.priority);
      setDueDate(card.dueDate ? new Date(card.dueDate).toISOString().split("T")[0] : "");
      setModuleId(card.moduleId || "");
      setLoadedFor(cardId);
    });

    return () => {
      cancelled = true;
    };
  }, [isOpen, cardId]);

  const loading = !cardId || loadedFor !== cardId;

  async function handleSave(overrides?: {
    title?: string;
    desc?: string;
    priority?: string;
    dueDate?: string;
    moduleId?: string;
  }) {
    if (!cardId) return;
    await updateCardDetails(
      cardId,
      overrides?.title ?? title,
      overrides?.desc ?? desc,
      overrides?.priority ?? priority,
      overrides?.dueDate ?? dueDate,
      overrides?.moduleId ?? moduleId
    );
    onReload();
  }

  async function handleAddComment() {
    if (!cardId || !commentText.trim()) return;
    await addComment(cardId, commentText);
    setCommentText("");
    const updated = await getCardDetails(cardId);
    setData(updated);
  }

  async function handleDelete() {
    if (!cardId) return;
    if (confirm("Deseja realmente apagar esta pendência?")) {
      await deleteCard(cardId);
      onClose();
      onReload();
    }
  }

  if (!isOpen) return null;

  const overdue = isCardOverdue(data?.dueDate, data?.completed);

  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 sm:p-4"
      onClick={onClose}
    >
      <div 
        className="bg-[#0f172a] border border-slate-800 w-full max-w-2xl rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[90vh] overflow-hidden text-slate-200 pb-[env(safe-area-inset-bottom)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-slate-800/80 flex items-center justify-between bg-[#0a0f1d]">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase bg-blue-950 text-blue-300 border border-blue-800 px-2.5 py-1 rounded">
              FICHA #{cardId?.substring(0, 6)}
            </span>
            <span className="text-xs text-slate-500 font-mono">Etapa: {data?.column?.title}</span>
            {data?.completed ? (
              <span className="text-[10px] font-mono uppercase bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded">
                ✓ Concluída
              </span>
            ) : overdue ? (
              <span className="text-[10px] font-mono uppercase bg-red-950 text-red-400 border border-red-800 px-2 py-0.5 rounded flex items-center gap-1">
                <AlertTriangle size={11} /> Vencida
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleDelete} className="p-2 text-slate-500 hover:text-red-400 rounded cursor-pointer"><Trash2 size={16}/></button>
            <button type="button" onClick={onClose} className="p-2 text-slate-500 hover:text-white rounded cursor-pointer"><X size={18}/></button>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500 font-mono">Carregando detalhes...</div>
        ) : (
          <div className="p-6 overflow-y-auto space-y-5 flex-1">
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase font-mono block mb-1">Título da Pendência</label>
              <input 
                className="w-full bg-[#070a12] border border-slate-800 p-2.5 rounded-xl text-base font-semibold text-white outline-none focus:border-blue-500"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => { void handleSave(); }}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase font-mono block mb-1">Módulo</label>
                <select 
                  className="w-full bg-[#070a12] border border-slate-800 p-2 rounded-xl text-xs text-white outline-none cursor-pointer"
                  value={moduleId}
                  onChange={(e) => { 
                    const val = e.target.value; 
                    setModuleId(val); 
                    void handleSave({ moduleId: val }); 
                  }}
                >
                  <option value="">Sem Módulo</option>
                  {modules.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase font-mono block mb-1">Prioridade</label>
                <select 
                  className="w-full bg-[#070a12] border border-slate-800 p-2 rounded-xl text-xs text-white outline-none cursor-pointer"
                  value={priority}
                  onChange={(e) => { 
                    const val = e.target.value; 
                    setPriority(val); 
                    void handleSave({ priority: val }); 
                  }}
                >
                  <option>Baixa</option>
                  <option>Normal</option>
                  <option>Alta</option>
                  <option>Urgente</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase font-mono block mb-1">Prazo / Vencimento</label>
                <input 
                  type="date"
                  className={`w-full bg-[#070a12] border p-2 rounded-xl text-xs font-mono outline-none ${
                    overdue ? "border-red-500 text-red-400 font-bold" : "border-slate-800 text-white"
                  }`}
                  value={dueDate}
                  onChange={(e) => { 
                    const val = e.target.value; 
                    setDueDate(val); 
                    void handleSave({ dueDate: val }); 
                  }}
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase font-mono flex items-center gap-1.5 mb-1.5">
                <AlignLeft size={14} className="text-blue-400"/> Descrição e Informações Adicionais
              </label>
              <textarea 
                rows={4}
                className="w-full bg-[#070a12] border border-slate-800 p-3 rounded-xl text-xs leading-relaxed text-slate-200 outline-none focus:border-blue-500 resize-none"
                placeholder="Insira detalhes..."
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                onBlur={() => { void handleSave(); }}
              />
            </div>

            <div className="border-t border-slate-800/80 pt-4">
              <label className="text-[11px] font-bold text-slate-400 uppercase font-mono flex items-center gap-1.5 mb-3">
                <MessageSquare size={14} className="text-emerald-400"/> Observações / Histórico
              </label>
              
              <div className="space-y-2 mb-3 max-h-40 overflow-y-auto">
                {(data?.comments ?? []).map((c) => (
                  <div key={c.id} className="p-2.5 bg-[#070a12] border border-slate-800/80 rounded-xl text-xs">
                    <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                      <span className="font-bold text-blue-400">{c.user}</span>
                      <span>{new Date(c.createdAt).toLocaleTimeString('pt-BR')}</span>
                    </div>
                    <p className="text-slate-300">{c.text}</p>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <input 
                  className="flex-1 bg-[#070a12] border border-slate-800 p-2 rounded-xl text-xs text-white outline-none focus:border-blue-500"
                  placeholder="Escrever uma observação..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void handleAddComment(); }}
                />
                <button type="button" onClick={() => { void handleAddComment(); }} className="bg-blue-600 hover:bg-blue-500 text-white p-2 rounded-xl cursor-pointer">
                  <Send size={15}/>
                </button>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}