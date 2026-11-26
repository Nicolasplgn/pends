"use client";

// Criar/editar credencial, com gerador de senha forte (crypto.getRandomValues).
import { useEffect, useState } from "react";
import type { Module } from "@prisma/client";
import { Eye, EyeOff, RefreshCw, X } from "lucide-react";
import { salvarCredencialCofre } from "@/app/actions";
import type { CofreItem } from "./CofreView";

const MIN = "abcdefghijkmnopqrstuvwxyz";
const MAI = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const NUM = "23456789";
const SIM = "!@#$%&*-_=+?";

/** Senha forte com pelo menos um de cada tipo, sorteada com crypto.getRandomValues. */
export function gerarSenha(tamanho = 20) {
  const todos = MIN + MAI + NUM + SIM;
  const rnd = (n: number) => {
    const a = new Uint32Array(1);
    // rejeição para não enviesar
    const lim = Math.floor(0x100000000 / n) * n;
    do crypto.getRandomValues(a); while (a[0] >= lim);
    return a[0] % n;
  };
  const chars = [MIN, MAI, NUM, SIM].map((g) => g[rnd(g.length)]);
  while (chars.length < tamanho) chars.push(todos[rnd(todos.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

function forca(s: string) {
  if (!s) return null;
  let pts = Math.min(s.length, 24) / 4;
  [/[a-z]/, /[A-Z]/, /\d/, /[^a-zA-Z0-9]/].forEach((r) => { if (r.test(s)) pts += 1; });
  if (pts >= 8) return { label: "forte", cls: "bg-emerald-500", w: "100%" };
  if (pts >= 5.5) return { label: "média", cls: "bg-amber-500", w: "60%" };
  return { label: "fraca", cls: "bg-rose-500", w: "30%" };
}

const input = "w-full bg-[#050811] border border-slate-800 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-emerald-500";
const label = "text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1";

export function CredencialModal({
  isOpen, onClose, onSaved, inicial, projetos, modules,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (msg: string) => void;
  inicial: CofreItem | null;
  projetos: string[];
  modules: Module[];
}) {
  const [titulo, setTitulo] = useState("");
  const [url, setUrl] = useState("");
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [verSenha, setVerSenha] = useState(false);
  const [notas, setNotas] = useState("");
  const [notasMexidas, setNotasMexidas] = useState(false);
  const [projeto, setProjeto] = useState("");
  const [modulo, setModulo] = useState("");
  const [tags, setTags] = useState("");
  const [erro, setErro] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setTitulo(inicial?.titulo ?? "");
    setUrl(inicial?.url ?? "");
    setUsuario(inicial?.usuario ?? "");
    setSenha("");
    setVerSenha(false);
    setNotas("");
    setNotasMexidas(false);
    setProjeto(inicial?.projeto ?? "");
    setModulo(inicial?.modulo ?? "");
    setTags((inicial?.tags ?? []).join(", "));
    setErro("");
  }, [isOpen, inicial]);

  if (!isOpen) return null;
  const f = forca(senha);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim()) return setErro("Dê um título.");
    if (!inicial && !senha) return setErro("Informe ou gere a senha.");
    setBusy(true);
    setErro("");
    try {
      const r = await salvarCredencialCofre(inicial?.id ?? null, {
        titulo, url, usuario, projeto, modulo,
        senha: senha || undefined,
        notas: inicial ? (notasMexidas ? notas : undefined) : notas,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      });
      if (!r.ok) return setErro(r.erro);
      setSenha("");
      onSaved(inicial ? "Credencial atualizada" : "Credencial guardada");
      onClose();
    } catch {
      setErro("Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <form onSubmit={salvar} onClick={(e) => e.stopPropagation()} className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl border border-slate-800 bg-[#0a0f1d] shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">{inicial ? "Editar acesso" : "Novo acesso"}</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer" aria-label="Fechar"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-3.5">
          <div>
            <label className={label}>Título</label>
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Painel da hospedagem" className={input} autoFocus />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={label}>URL</label>
              <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." className={input} inputMode="url" />
            </div>
            <div>
              <label className={label}>Usuário</label>
              <input value={usuario} onChange={(e) => setUsuario(e.target.value)} placeholder="login ou e-mail" className={input} autoComplete="off" />
            </div>
          </div>
          <div>
            <label className={label}>Senha {inicial && <span className="normal-case font-normal text-slate-500">(em branco mantém a atual)</span>}</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={verSenha ? "text" : "password"}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder={inicial ? "••••••" : "senha"}
                  autoComplete="new-password"
                  className={`${input} font-mono pr-9`}
                />
                <button type="button" onClick={() => setVerSenha((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white cursor-pointer" aria-label={verSenha ? "Esconder" : "Mostrar"}>
                  {verSenha ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <button
                type="button"
                onClick={() => { setSenha(gerarSenha()); setVerSenha(true); }}
                className="shrink-0 flex items-center gap-1.5 px-3 rounded-lg border border-slate-700 text-xs text-slate-300 hover:text-white cursor-pointer"
                title="Gerar senha forte (20 caracteres)"
              >
                <RefreshCw size={13} /> Gerar
              </button>
            </div>
            {f && (
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-1 flex-1 rounded-full bg-slate-800 overflow-hidden"><div className={`h-full ${f.cls}`} style={{ width: f.w }} /></div>
                <span className="text-[10px] font-mono text-slate-400">{f.label}</span>
              </div>
            )}
          </div>
          <div>
            <label className={label}>Notas {inicial && <span className="normal-case font-normal text-slate-500">(em branco mantém as atuais)</span>}</label>
            <textarea
              value={notas}
              onChange={(e) => { setNotas(e.target.value); setNotasMexidas(true); }}
              rows={3}
              placeholder="Perguntas de segurança, PIN, códigos de recuperação... (cifrado)"
              className={`${input} resize-none`}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={label}>Projeto</label>
              <input value={projeto} onChange={(e) => setProjeto(e.target.value)} list="cofre-projetos" placeholder="Ex.: Wave" className={input} />
              <datalist id="cofre-projetos">{projetos.map((p) => <option key={p} value={p} />)}</datalist>
            </div>
            <div>
              <label className={label}>Módulo</label>
              <select value={modulo} onChange={(e) => setModulo(e.target.value)} className={input}>
                <option value="">Nenhum</option>
                {modules.map((m) => <option key={m.id} value={m.title}>{m.title}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>Tags</label>
              <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="banco, cliente" className={input} />
            </div>
          </div>
          {erro && <p className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">{erro}</p>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-800">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-800 text-xs text-slate-400 hover:text-white cursor-pointer">Cancelar</button>
          <button type="submit" disabled={busy} className="px-5 py-2 rounded-lg bg-emerald-500 text-slate-950 text-xs font-bold hover:bg-emerald-400 disabled:opacity-60 cursor-pointer">
            {busy ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </div>
  );
}
