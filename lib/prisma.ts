import { PrismaClient } from '@prisma/client';

/**
 * O Neon grátis "dorme" depois de alguns minutos parado e leva alguns segundos
 * pra acordar. O padrão do Prisma desiste em 5 s ("Can't reach database server"),
 * então aqui damos mais tempo para conectar e para esperar uma conexão livre.
 */
function databaseUrl() {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (!url.searchParams.has('connect_timeout')) url.searchParams.set('connect_timeout', '20');
    if (!url.searchParams.has('pool_timeout')) url.searchParams.set('pool_timeout', '20');
    return url.toString();
  } catch {
    return raw;
  }
}

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({ datasources: { db: { url: databaseUrl() } } });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
