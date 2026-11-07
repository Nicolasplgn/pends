"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Module } from "@prisma/client";
import { X, ArrowDownRight, ArrowUpRight, Layers, CheckCircle2 } from "lucide-react";
import { createTransaction, updateTransaction, type TxScope } from "@/app/actions";
import type { FinanceTx, PayMethod, TxType } from "../../../types";
import { PAY_METHOD_LABEL } from "../../../types";
import { brl, moneyToInput, parseMoney, toInputDate, todayInputDate } from "../format";
import { MethodIcon } from "../ui";

export interface TxModalDefaults {
  type?: TxType;
  dueDate?: string;
}

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (target: { year: number; month: number }, message: string) => void;
  initialData?: FinanceTx | null;
  defaults?: TxModalDefaults;
  modules: Module[];
}

const METHODS: PayMethod[] = ["PIX", "BOLETO", "CREDIT_CARD", "DEBIT"];

const inputCls =
  "w-full bg-[#050811] border border-slate-800 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-blue-500 transition-colors";
const labelCls = "text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1";

export function TransactionModal({ isOpen, onClose, onSaved, initialData, defaults, modules }: TransactionModalProps) {
  const isEdit = !!initialData;
  const [type, setType] = useState<TxType>("EXPENSE");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [category, setCategory] = useState("");
  const [method, setMethod] = useState<PayMethod>("PIX");
  const [paid, setPaid] = useState(false);
  const [notes, setNotes] = useState("");

  const [isInstallment, setIsInstallment] = useState(false);
  const [installments, setInstallments] = useState(10);
  const [startAt, setStartAt] = useState(1);
  const [amountMode, setAmountMode] = useState<"PARCEL" | "TOTAL">("TOTAL");
  const [scope, setScope] = useState<TxScope>("one");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const descRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError("");
    setScope("one");
    if (initialData) {
      setType(initialData.type as TxType);
      setDescription(initialData.description.replace(/\s*\(\d+\/\d+\)\s*$/, ""));
      setAmount(moneyToInput(initialData.amount));
      setDueDate(toInputDate(initialData.dueDate));
      setCategory(initialData.category);
      setMethod((initialData.paymentMethod as PayMethod) || "PIX");
      setPaid(initialData.paid);
      setNotes(initialData.notes ?? "");
      setIsInstallment(initialData.isInstallment);
    } else {
      setType(defaults?.type ?? "EXPENSE");
      setDescription("");
      setAmount("");
      setDueDate(defaults?.dueDate ?? todayInputDate());
      setCategory(modules[0]?.title ?? "Geral");
      setMethod("PIX");
      // Entrada nasce como recebida (salário que caiu, pix recebido…); conta nasce em aberto
      setPaid((defaults?.type ?? "EXPENSE") === "INCOME");
      setNotes("");
      setIsInstallment(false);
      setInstallments(10);
      setStartAt(1);
      setAmountMode("TOTAL");
    }
    setTimeout(() => descRef.current?.focus(), 50);
  }, [isOpen, initialData, defaults, modules]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  const parsedAmount = parseMoney(amount);
  const preview = useMemo(() => {
    if (!isInstallment || isEdit || !(parsedAmount > 0) || installments < 2) return null;
    const count = installments - startAt + 1;
    const parcel = amountMode === "TOTAL" ? parsedAmount / installments : parsedAmount;
    return { count, parcel, remaining: parcel * count, total: parcel * installments };
  }, [isInstallment, isEdit, parsedAmount, installments, startAt, amountMode]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) return setError("Dá um nome pro lançamento.");
    if (!(parsedAmount > 0)) return setError("Valor inválido.");
    if (!dueDate) return setError("Escolha a data.");
    setSaving(true);
    setError("");
    try {
      const base = {
        description: description.trim(),
        amount: parsedAmount,
        type,
        category: category || "Geral",
        paymentMethod: method,
        dueDate,
        notes: notes.trim() || null,
        paid,
      };
      const res = isEdit
        ? await updateTransaction(initialData!.id, base, initialData!.isInstallment ? scope : "one")
        : await createTransaction({
            ...base,
            isInstallment: isInstallment && installments > 1,
            installmentsCount: installments,
            startInstallment: startAt,
            amountMode,
          });
      onSaved(
        { year: res.year, month: res.month },
        isEdit ? "Lançamento atualizado" : preview ? `${preview.count} parcelas lançadas` : "Lançamento criado"
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  const accent = type === "INCOME" ? "emerald" : "rose";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm sm:p-4" onClick={onClose}>
      <div
        className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl border border-slate-800 bg-[#0a0f1d] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 sticky top-0 bg-[#0a0f1d] z-10">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
            {isEdit ? "Editar lançamento" : "Novo lançamento"}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {(["EXPENSE", "INCOME"] as TxType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setType(t);
                  if (!isEdit) setPaid(t === "INCOME");
                }}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-xs font-bold font-mono transition cursor-pointer ${
                  type === t
                    ? t === "INCOME"
                      ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-400"
                      : "bg-rose-500/10 border-rose-500/50 text-rose-400"
                    : "border-slate-800 text-slate-500 hover:bg-slate-900"
                }`}
              >
                {t === "INCOME" ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
                {t === "INCOME" ? "Entrada" : "Saída"}
              </button>
            ))}
          </div>

          <div>
            <label className={labelCls}>Descrição</label>
            <input
              ref={descRef}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={type === "INCOME" ? "Salário, freela, reembolso..." : "Aluguel, mercado, notebook..."}
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>
                {isInstallment && !isEdit ? (amountMode === "TOTAL" ? "Valor total" : "Valor da parcela") : isEdit && initialData?.isInstallment ? "Valor da parcela" : "Valor"}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">R$</span>
                <input
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0,00"
                  className={`${inputCls} pl-9 font-bold font-mono ${accent === "emerald" ? "text-emerald-300" : ""}`}
                />
              </div>
            </div>
            <div>
              <label className={labelCls}>{isInstallment && !isEdit ? "1ª parcela em" : "Vencimento"}</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={`${inputCls} scheme-dark`} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Módulo / categoria</label>
            <div className="flex flex-wrap gap-1.5">
              {modules.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setCategory(m.title)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition cursor-pointer ${
                    category === m.title ? "text-white bg-slate-800" : "text-slate-400 border-slate-800 hover:text-white"
                  }`}
                  style={{ borderColor: category === m.title ? m.color : undefined }}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color }} />
                  {m.title}
                </button>
              ))}
              {category && !modules.some((m) => m.title === category) && (
                <span className="px-2.5 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-300 bg-slate-800">{category}</span>
              )}
            </div>
          </div>

          <div>
            <label className={labelCls}>Forma de pagamento</label>
            <div className="grid grid-cols-4 gap-1.5">
              {METHODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs transition cursor-pointer ${
                    method === m ? "bg-slate-800 border-slate-600 text-white font-bold" : "border-slate-800 text-slate-500 hover:text-white"
                  }`}
                >
                  <MethodIcon method={m} size={12} /> {PAY_METHOD_LABEL[m]}
                </button>
              ))}
            </div>
          </div>

          {!isEdit && (
            <div className="rounded-xl border border-slate-800 bg-[#070a12] p-3 space-y-3">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-300">
                <input
                  type="checkbox"
                  checked={isInstallment}
                  onChange={(e) => setIsInstallment(e.target.checked)}
                  className="accent-violet-500"
                />
                <Layers size={13} className="text-violet-400" /> Parcelado
              </label>

              {isInstallment && (
                <>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(["TOTAL", "PARCEL"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setAmountMode(mode)}
                        className={`py-1.5 rounded-lg border text-[11px] font-mono cursor-pointer ${
                          amountMode === mode ? "border-violet-500/60 bg-violet-500/10 text-violet-300" : "border-slate-800 text-slate-500"
                        }`}
                      >
                        {mode === "TOTAL" ? "Digitei o valor total" : "Digitei o valor da parcela"}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Nº de parcelas</label>
                      <input
                        type="number"
                        min={2}
                        max={120}
                        value={installments}
                        onChange={(e) => {
                          const v = Math.max(2, Number(e.target.value) || 2);
                          setInstallments(v);
                          if (startAt > v) setStartAt(v);
                        }}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Começa na parcela</label>
                      <input
                        type="number"
                        min={1}
                        max={installments}
                        value={startAt}
                        onChange={(e) => setStartAt(Math.min(Math.max(1, Number(e.target.value) || 1), installments))}
                        className={inputCls}
                      />
                    </div>
                  </div>
                  {preview && (
                    <p className="text-[11px] font-mono text-violet-300 bg-violet-500/5 border border-violet-500/20 rounded-lg px-3 py-2">
                      {installments}x de <b>{brl(preview.parcel)}</b> · total {brl(preview.total)}
                      {startAt > 1 && <> · lançando {preview.count} restantes ({brl(preview.remaining)})</>}
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {isEdit && initialData?.isInstallment && (
            <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-3">
              <p className="text-[10px] font-bold text-violet-300 uppercase tracking-wider mb-2 font-mono">
                Parcela {initialData.installmentCurrent}/{initialData.installmentTotal} — aplicar alterações em:
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                {([
                  ["one", "Só esta"],
                  ["future", "Esta e próximas"],
                  ["all", "Todas"],
                ] as [TxScope, string][]).map(([s, label]) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setScope(s)}
                    className={`py-1.5 rounded-lg border text-[11px] cursor-pointer ${
                      scope === s ? "border-violet-500/60 bg-violet-500/15 text-white font-bold" : "border-slate-800 text-slate-400"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className={labelCls}>Observações</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Opcional: código de barras, chave pix, detalhe..."
              className={`${inputCls} resize-none text-xs`}
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 select-none">
            <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} className="accent-emerald-500" />
            <CheckCircle2 size={14} className={paid ? "text-emerald-400" : "text-slate-600"} />
            {type === "INCOME" ? "Já recebido" : "Já pago"}
            {type === "INCOME" && !isEdit && <span className="text-slate-500">(desmarque se ainda vai cair)</span>}
            {isInstallment && !isEdit && <span className="text-slate-500">(só a primeira parcela)</span>}
          </label>

          {error && <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-800 text-xs text-slate-400 hover:text-white cursor-pointer">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-lg bg-emerald-500 text-slate-950 text-xs font-bold hover:bg-emerald-400 disabled:opacity-60 transition cursor-pointer"
            >
              {saving ? "Salvando..." : isEdit ? "Salvar" : "Lançar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
