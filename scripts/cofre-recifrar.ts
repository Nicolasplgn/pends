// npm run cofre:recifrar
// Recifra o cofre quando o AUTH_SECRET muda: abre cada registro com a chave ANTIGA e grava com a NOVA.
//
// Uso (PowerShell):
//   $env:AUTH_SECRET_ANTIGO="<valor antigo>"; $env:AUTH_SECRET="<valor novo>"; $env:DATABASE_URL="<banco>"; npm run cofre:recifrar
// Primeiro roda em modo de teste (não grava nada). Para gravar de verdade, acrescente:  -- --gravar
//
// Nada é impresso além de contagens: nenhuma senha, nota ou chave aparece na saída.

import { PrismaClient } from "@prisma/client";
import { cifrar, decifrar, derivarChave } from "../lib/cofre/crypto";

async function main() {
  const antigo = process.env.AUTH_SECRET_ANTIGO ?? "";
  const novo = process.env.AUTH_SECRET ?? "";
  const gravar = process.argv.includes("--gravar");
  if (!antigo || !novo) {
    console.error("Defina AUTH_SECRET_ANTIGO (valor anterior) e AUTH_SECRET (valor novo).");
    process.exit(1);
  }
  if (antigo === novo) {
    console.log("Os dois segredos são iguais: nada a fazer.");
    return;
  }
  const chaveAntiga = derivarChave(antigo);
  const chaveNova = derivarChave(novo);
  const prisma = new PrismaClient();
  try {
    const todos = await prisma.credencial.findMany({ select: { id: true, senhaCifrada: true, notasCifradas: true } });
    // Abre tudo antes de gravar: se algum falhar, não grava nada
    const novos = todos.map((c, i) => {
      try {
        return {
          id: c.id,
          senhaCifrada: cifrar(decifrar(c.senhaCifrada, chaveAntiga), chaveNova),
          notasCifradas: c.notasCifradas ? cifrar(decifrar(c.notasCifradas, chaveAntiga), chaveNova) : null,
        };
      } catch {
        throw new Error(`O registro ${i + 1} de ${todos.length} não abriu com o AUTH_SECRET_ANTIGO. Nada foi gravado.`);
      }
    });
    if (!gravar) {
      console.log(`Teste OK: ${novos.length} credencial(is) abrem com a chave antiga. Rode com "-- --gravar" para recifrar.`);
      return;
    }
    await prisma.$transaction(novos.map((n) => prisma.credencial.update({ where: { id: n.id }, data: { senhaCifrada: n.senhaCifrada, notasCifradas: n.notasCifradas } })));
    console.log(`Pronto: ${novos.length} credencial(is) recifradas com o AUTH_SECRET novo.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : "Falha ao recifrar.");
  process.exit(1);
});
