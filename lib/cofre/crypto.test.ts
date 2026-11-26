// Testes da criptografia do cofre (rode com `npm run test:cofre`).
// Usa só valores de teste: nenhuma credencial de verdade.
import { test } from "node:test";
import assert from "node:assert/strict";
import { CofreError, cifrar, decifrar, derivarChave } from "./crypto";
import { lerCsvDeSenhas } from "./csv";

const chave = derivarChave("segredo-de-teste-1");
const outraChave = derivarChave("segredo-de-teste-2");

test("cifra e decifra de volta o mesmo texto", () => {
  const texto = "senha-teste-Áé#123 🔐";
  const c = cifrar(texto, chave);
  assert.equal(decifrar(c, chave), texto);
});

test("o texto aberto não aparece no valor gravado", () => {
  const texto = "texto-que-nao-pode-aparecer";
  const c = cifrar(texto, chave);
  assert.ok(c.startsWith("v1."));
  assert.ok(!c.includes(texto));
  assert.ok(!Buffer.from(c.slice(3), "base64url").toString("utf8").includes(texto));
});

test("IV diferente a cada vez: o mesmo texto gera valores diferentes", () => {
  const a = cifrar("mesmo-texto", chave);
  const b = cifrar("mesmo-texto", chave);
  assert.notEqual(a, b);
  const iv = (v: string) => Buffer.from(v.slice(3), "base64url").subarray(0, 12).toString("hex");
  assert.notEqual(iv(a), iv(b));
  assert.equal(decifrar(a, chave), decifrar(b, chave));
});

test("falha com a chave errada, sem vazar nada na mensagem", () => {
  const c = cifrar("texto-secreto-de-teste", chave);
  assert.throws(() => decifrar(c, outraChave), (e: unknown) => {
    assert.ok(e instanceof CofreError);
    assert.ok(!(e as Error).message.includes("texto-secreto-de-teste"));
    return true;
  });
});

test("falha se o registro for adulterado", () => {
  const c = cifrar("texto-de-teste", chave);
  const bruto = Buffer.from(c.slice(3), "base64url");
  bruto[bruto.length - 1] ^= 0xff;
  assert.throws(() => decifrar("v1." + bruto.toString("base64url"), chave), CofreError);
});

test("a mesma origem sempre deriva a mesma chave, e origens diferentes não", () => {
  assert.ok(derivarChave("segredo-de-teste-1").equals(chave));
  assert.ok(!chave.equals(outraChave));
  assert.equal(chave.length, 32);
});

test("sem segredo não deriva chave", () => {
  assert.throws(() => derivarChave(""), CofreError);
});

// ---------- Leitura do CSV do Google (dados fictícios) ----------

test("lê o CSV do Google com aspas, vírgula e quebra de linha no campo", () => {
  const csv =
    "\uFEFFname,url,username,password,note\r\n" +
    'exemplo.com,https://exemplo.com/login,ana@teste.dev,"senha,com""aspas",\r\n' +
    ',https://www.outro.test/,joao,teste-123,"nota em\nduas linhas"\r\n';
  const r = lerCsvDeSenhas(csv);
  assert.equal(r.erro, undefined);
  assert.equal(r.linhas.length, 2);
  assert.equal(r.linhas[0].senha, 'senha,com"aspas');
  assert.equal(r.linhas[0].usuario, "ana@teste.dev");
  assert.equal(r.linhas[1].titulo, "outro.test");
  assert.equal(r.linhas[1].notas, "nota em\nduas linhas");
});

test("CSV sem coluna de senha é recusado", () => {
  const r = lerCsvDeSenhas("name,url\nx,https://x.test\n");
  assert.ok(r.erro);
  assert.equal(r.linhas.length, 0);
});
