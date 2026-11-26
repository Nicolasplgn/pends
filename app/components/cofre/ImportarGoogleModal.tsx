"use client";

// Importa o CSV exportado pelo Gerenciador de Senhas do Google (ou do Chrome).
// O arquivo é lido no navegador e enviado direto para o servidor, que cifra tudo antes de gravar.
import { useEffect, useRef, useState } from "react";
import { FileUp, ShieldAlert, X } from "lucide-react";
import { importarSenhasCofre } from "@/app/actions";

export function ImportarGoogleModal({
  isOpen, onClose, onDone, projetos, precisaReauth,
}: {
  isOpen: boolean;
  onClose: () => void;
  onDone: (msg: string) => void;
  projetos: string[];
  /** Abre a confirmação de senha e chama `depois` quando liberar */
  precisaReauth: (depois: () => void) => void;
}) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [projeto, setProjeto] = useState("");
  const [erro, setErro] = useState("");
  const [busy, setBusy] = useState(false);
  const [resultado, setResultado] = useState<{ criadas: number; duplicadas: number; invalidas: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setArquivo(null);
    setProjeto("");
    setErro("");
    setResultado(null);
  }, [isOpen]);

  if (!isOpen) return null;

  async function importar() {
    if (!arquivo) return;
    if (arquivo.size > 2_000_000) return setErro("Arquivo grande demais (máx. 2 MB).");
    setBusy(true);
    setErro("");
    try {
      const texto = await arquivo.text();
      const r = await importarSenhasCofre(texto, projeto.trim() || null);
      if (!r.ok) {
        if (r.precisaReauth) precisaReauth(() => void importar());
        else setErro(r.erro);
        return;
      }
      setResultado(r);
      onDone(`${r.criadas} acesso(s) importado(s)`);
    } catch {
      setErro("Não foi possível importar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl border border-slate-800 bg-[#0a0f1d] shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">Importar senhas do Google</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer" aria-label="Fechar"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4 text-sm">
          <ol className="list-decimal pl-5 space-y-1 text-xs text-slate-300">
            <li>Abra <b>passwords.google.com</b> (ou <b>chrome://password-manager</b> no Chrome).</li>
            <li>Vá em <b>Configurações → Exportar senhas</b> e confirme. O Google baixa um arquivo <b>.csv</b>.</li>
            <li>Escolha esse arquivo aqui embaixo e clique em <b>Importar</b>.</li>
          </ol>

          <div
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-3 rounded-xl border border-dashed border-slate-700 hover:border-emerald-500/60 p-4 cursor-pointer"
          >
            <FileUp size={20} className="text-emerald-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-white text-sm truncate">{arquivo ? arquivo.name : "Escolher o arquivo .csv"}</p>
              <p className="text-[11px] text-slate-500">Colunas: name, url, username, password, note</p>
            </div>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { setArquivo(e.target.files?.[0] ?? null); setResultado(null); }} />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Projeto (opcional, para todos)</label>
            <input value={projeto} onChange={(e) => setProjeto(e.target.value)} list="cofre-projetos-import" placeholder="deixe vazio para importar sem projeto" className="w-full bg-[#050811] border border-slate-800 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-emerald-500" />
            <datalist id="cofre-projetos-import">{projetos.map((p) => <option key={p} value={p} />)}</datalist>
          </div>

          <p className="flex gap-2 text-[11px] text-amber-200/90 bg-amber-500/10 border border-amber-500/30 rounded-lg p-2.5">
            <ShieldAlert size={14} className="shrink-0 mt-px" />
            O CSV do Google tem as senhas abertas. Depois de importar, apague o arquivo da pasta Downloads (e da lixeira).
          </p>

          {resultado && (
            <p className="text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2">
              {resultado.criadas} importado(s) · {resultado.duplicadas} já existiam (mesmo site e usuário) · {resultado.invalidas} sem senha/endereço ignorado(s).
            </p>
          )}
          {erro && <p className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">{erro}</p>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-800">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-800 text-xs text-slate-400 hover:text-white cursor-pointer">{resultado ? "Fechar" : "Cancelar"}</button>
          {!resultado && (
            <button type="button" onClick={() => void importar()} disabled={busy || !arquivo} className="px-5 py-2 rounded-lg bg-emerald-500 text-slate-950 text-xs font-bold hover:bg-emerald-400 disabled:opacity-50 cursor-pointer">
              {busy ? "Importando..." : "Importar"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
