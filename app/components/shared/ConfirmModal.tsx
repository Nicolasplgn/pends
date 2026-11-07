"use client";

import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => Promise<void> | void;
}

export function ConfirmModal({
  isOpen,
  onClose,
  title,
  description,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  danger = false,
  onConfirm,
}: ConfirmModalProps) {
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  async function handleConfirm() {
    setLoading(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-[#0b101f] border border-slate-800 w-full max-w-md rounded-3xl shadow-2xl p-6 text-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3.5 mb-4">
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
            danger ? "bg-red-500/15 border border-red-500/30 text-red-400" : "bg-amber-500/15 border border-amber-500/30 text-amber-400"
          }`}>
            <AlertTriangle size={20} />
          </div>
          <div>
            <h3 className="text-base font-bold text-white uppercase font-mono tracking-wide">
              {title}
            </h3>
            <p className="text-xs text-slate-400 mt-1 font-sans leading-relaxed">
              {description}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800/80">
          <button 
            type="button" 
            onClick={onClose} 
            className="px-4 py-2.5 text-xs font-bold font-mono text-slate-400 hover:bg-slate-800 rounded-xl cursor-pointer"
          >
            {cancelText}
          </button>
          <button 
            type="button" 
            disabled={loading}
            onClick={handleConfirm} 
            className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider font-mono shadow-lg transition-all cursor-pointer ${
              danger 
                ? "bg-red-600 hover:bg-red-500 text-white shadow-red-600/20" 
                : "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20"
            }`}
          >
            {loading ? "Aguarde..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}