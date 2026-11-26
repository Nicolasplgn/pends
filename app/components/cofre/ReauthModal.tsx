"use client";

// Pede a senha do Pends de novo antes de revelar/copiar/importar (vale por 5 minutos).
import { useState } from "react";
import { Lock, X } from "lucide-react";
import { confirmarSenhaCofre } from "@/app/actions";

export function ReauthModal({ isOpen, onClose, onConfirmed }: { isOpen: boolean; onClose: () => void; onConfirmed: (ate: number) => void }) {
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [busy, setBusy] = useState(false);

  if (!isOpen) return null;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!senha) return;
    setBusy(true);
    setErro("");
    try {
      const r = await confirmarSenhaCofre(senha);
      setSenha("");
      if (r.ok) onConfirmed(r.ate);
      else setErro(r.erro);
    } catch {
      setErro("Não foi possível confirmar agora.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm grid place-items-center p-4" onClick={onClose}>
      <form onSubmit={enviar} onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl border border-slate-800 bg-[#0a0f1d] p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-3">
          <h2 className="flex items-center gap-2 text-sm font-bold text-white"><Lock size={15} className="text-emerald-400" /> Confirme sua senha</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer" aria-label="Fechar"><X size={16} /></button>
        </div>
        <p className="text-xs text-slate-400 mb-3">Para ver ou copiar senhas, digite a senha de login do Pends. Fica liberado por 5 minutos.</p>
        <input
          type="password"
          autoComplete="current-password"
          autoFocus
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          placeholder="Senha do Pends"
          className="w-full bg-[#050811] border border-slate-800 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-emerald-500"
        />
        {erro && <p className="mt-2 text-xs text-rose-300">{erro}</p>}
        <div className="flex justify-end gap-2 mt-4">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-800 text-xs text-slate-400 hover:text-white cursor-pointer">Cancelar</button>
          <button type="submit" disabled={busy || !senha} className="px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 text-xs font-bold hover:bg-emerald-400 disabled:opacity-50 cursor-pointer">
            {busy ? "Confirmando..." : "Liberar por 5 min"}
          </button>
        </div>
      </form>
    </div>
  );
}
