"use client";

import { useState, useEffect } from "react";
import type { Module } from "@prisma/client";

interface CreateCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  modules: Module[];
  targetColumnId: string;
  defaultModuleId?: string;
  onCreate: (
    columnId: string,
    title: string,
    moduleId: string,
    priority: string,
    desc: string,
    dueDate: string
  ) => Promise<void>;
}

export function CreateCardModal({
  isOpen,
  onClose,
  modules,
  targetColumnId,
  defaultModuleId = "",
  onCreate,
}: CreateCardModalProps) {
  const [title, setTitle] = useState("");
  const [moduleId, setModuleId] = useState(defaultModuleId);
  const [priority, setPriority] = useState("Normal");
  const [dueDate, setDueDate] = useState("");
  const [desc, setDesc] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setModuleId(defaultModuleId);
      setTitle("");
      setDesc("");
      setDueDate("");
      setPriority("Normal");
    }
  }, [isOpen, defaultModuleId]);

  if (!isOpen) return null;

  async function handleSubmit() {
    if (!title.trim() || !targetColumnId || loading) return;
    setLoading(true);
    try {
      await onCreate(targetColumnId, title.trim(), moduleId, priority, desc, dueDate);
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div 
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-[#0f172a] border border-slate-800 p-6 rounded-3xl w-full max-w-lg shadow-2xl text-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-bold text-white mb-4 uppercase tracking-wider font-mono">Nova Pendência</h3>
        <div className="space-y-4">
          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase font-mono block mb-1">Título</label>
            <input 
              className="w-full bg-[#070a12] border border-slate-800 p-2.5 rounded-xl text-sm text-white outline-none focus:border-blue-500" 
              placeholder="Ex: Pagar fatura da energia" 
              value={title} 
              onChange={(e) => setTitle(e.target.value)} 
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase font-mono block mb-1">Módulo</label>
              <select 
                className="w-full bg-[#070a12] border border-slate-800 p-2.5 rounded-xl text-xs text-white outline-none focus:border-blue-500 cursor-pointer" 
                value={moduleId} 
                onChange={(e) => setModuleId(e.target.value)}
              >
                <option value="">Selecione um módulo</option>
                {modules.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase font-mono block mb-1">Prioridade</label>
              <select 
                className="w-full bg-[#070a12] border border-slate-800 p-2.5 rounded-xl text-xs text-white outline-none focus:border-blue-500 cursor-pointer" 
                value={priority} 
                onChange={(e) => setPriority(e.target.value)}
              >
                <option>Baixa</option>
                <option>Normal</option>
                <option>Alta</option>
                <option>Urgente</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase font-mono block mb-1">Data Limite / Vencimento</label>
            <input 
              type="date" 
              className="w-full bg-[#070a12] border border-slate-800 p-2.5 rounded-xl text-xs text-white outline-none focus:border-blue-500 font-mono" 
              value={dueDate} 
              onChange={(e) => setDueDate(e.target.value)} 
            />
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase font-mono block mb-1">Descrição</label>
            <textarea 
              rows={3} 
              className="w-full bg-[#070a12] border border-slate-800 p-2.5 rounded-xl text-xs text-white outline-none focus:border-blue-500 resize-none" 
              placeholder="Detalhes opcionais..." 
              value={desc} 
              onChange={(e) => setDesc(e.target.value)} 
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button 
            type="button" 
            onClick={onClose} 
            className="px-4 py-2 text-xs font-bold text-slate-400 hover:bg-slate-800 rounded-xl cursor-pointer"
          >
            Cancelar
          </button>
          <button 
            type="button" 
            disabled={loading}
            onClick={() => { void handleSubmit(); }} 
            className="px-4 py-2 bg-blue-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-blue-500 cursor-pointer"
          >
            {loading ? "Criando..." : "Criar"}
          </button>
        </div>
      </div>
    </div>
  );
}