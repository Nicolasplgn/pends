"use client";

import { useState } from "react";
import { loginAction } from "../../actions";

interface LoginScreenProps {
  onLogin: () => void;
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await loginAction(email, password);
      if (res.success) {
        onLogin();
      } else {
        setError(res.error || "Credenciais inválidas.");
      }
    } catch {
      setError("Erro ao autenticar com o servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-[#050811] font-mono text-slate-200 p-4">
      <div className="bg-[#0b101d] border border-blue-900/40 p-6 sm:p-8 rounded-3xl w-full max-w-md shadow-2xl relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-blue-600/15 rounded-full blur-2xl" />
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-blue-600 text-white rounded-2xl flex items-center justify-center font-black tracking-wider shadow-lg shadow-blue-500/20">
            P
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white font-sans">PENDS // HUB</h1>
            <span className="text-[10px] text-blue-400 font-mono">SYS.VER.8.2 // SECURE_AUTH</span>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-2.5 rounded-xl text-xs mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 font-sans">
          <div>
            <label className="text-[11px] uppercase font-bold text-slate-400 block mb-1">E-mail</label>
            <input 
              type="email" 
              required
              className="w-full bg-[#070a12] border border-slate-800 rounded-xl p-3 text-sm text-white focus:border-blue-500 outline-none transition-all"
              placeholder="seu-email@dominio.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="text-[11px] uppercase font-bold text-slate-400 block mb-1">Senha</label>
            <input 
              type="password" 
              required
              className="w-full bg-[#070a12] border border-slate-800 rounded-xl p-3 text-sm text-white focus:border-blue-500 outline-none transition-all"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-3 rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-600/20 cursor-pointer"
          >
            {loading ? "Verificando..." : "Acessar Sistema"}
          </button>
        </form>
      </div>
    </div>
  );
}