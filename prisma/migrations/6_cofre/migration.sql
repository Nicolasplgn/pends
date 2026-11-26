-- CreateTable
CREATE TABLE "Credencial" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "url" TEXT,
    "usuario" TEXT,
    "senhaCifrada" TEXT NOT NULL,
    "notasCifradas" TEXT,
    "projeto" TEXT,
    "modulo" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "ultimaRevelacao" TIMESTAMP(3),

    CONSTRAINT "Credencial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CredencialLog" (
    "id" TEXT NOT NULL,
    "credencialId" TEXT,
    "titulo" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "origem" TEXT NOT NULL,
    "quando" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CredencialLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Credencial_projeto_idx" ON "Credencial"("projeto");

-- CreateIndex
CREATE INDEX "CredencialLog_credencialId_quando_idx" ON "CredencialLog"("credencialId", "quando");

-- CreateIndex
CREATE INDEX "CredencialLog_origem_acao_quando_idx" ON "CredencialLog"("origem", "acao", "quando");

-- AddForeignKey
ALTER TABLE "CredencialLog" ADD CONSTRAINT "CredencialLog_credencialId_fkey" FOREIGN KEY ("credencialId") REFERENCES "Credencial"("id") ON DELETE SET NULL ON UPDATE CASCADE;

