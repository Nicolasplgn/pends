"use client";

import { useEffect, useState } from "react";
import type { Module } from "@prisma/client";

interface ModuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingModule: Module | null;
  onSave: (title: string, color: string) => Promise<void>;
}

export function ModuleModal({
  isOpen,
  onClose,
  editingModule,
  onSave,
}: ModuleModalProps) {
  const [title, setTitle] = useState("");
  const [color, setColor] = useState("#3B82F6");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editingModule) {
      setTitle(editingModule.title);
      setColor(editingModule.color);
    } else {
      setTitle("");
      setColor("#3B82F6");
    }
  }, [editingModule, isOpen]);

  if (!isOpen) return null;

  async function handleSubmit() {
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      await onSave(title.trim(), color);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div 
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 sm:p-4"
      onClick={onClose}
    >
      <div 
        className="bg-[#0f172a] border border-slate-800 p-6 rounded-3xl w-96 shadow-2xl text-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-bold text-white mb-4 uppercase tracking-wider font-mono">
          {editingModule ? "Editar Módulo" : "Novo Módulo"}
        </h3>
        <div className="space-y-4">
          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase font-mono block mb-1">
              Nome do Módulo
            </label>
            <input 
              className="w-full bg-[#070a12] border border-slate-800 p-2.5 rounded-xl text-sm text-white outline-none focus:border-blue-500" 
              placeholder="Ex: Finanças..." 
              value={title} 
              onChange={(e) => setTitle(e.target.value)} 
            />
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase font-mono block mb-1">
              Cor (Hexadecimal)
            </label>
            <div className="flex items-center gap-3">
              <input 
                type="color" 
                value={color} 
                onChange={(e) => setColor(e.target.value)} 
                className="w-10 h-10 rounded-xl bg-transparent border-0 cursor-pointer p-0" 
              />
              <input 
                type="text" 
                value={color} 
                onChange={(e) => setColor(e.target.value)} 
                placeholder="#3B82F6" 
                className="flex-1 bg-[#070a12] border border-slate-800 p-2 rounded-xl text-xs font-mono uppercase text-white outline-none focus:border-blue-500" 
              />
            </div>
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
            disabled={saving}
            onClick={() => { void handleSubmit(); }} 
            className="px-4 py-2 bg-blue-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-blue-500 cursor-pointer"
          >
            {saving ? "Salvando..." : editingModule ? "Salvar" : "Criar"}
          </button>
        </div>
      </div>
    </div>
  );
}