// Disparo diário dos lembretes. A Vercel Cron chama esta rota com
// "Authorization: Bearer <CRON_SECRET>" (ver vercel.json).

import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { sendDailyDigest } from "@/lib/reminders";
import { spawnDueCardCharges } from "@/lib/pends/core";

export const dynamic = "force-dynamic";

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const charges = await spawnDueCardCharges(); // assinaturas no cartão que caem hoje
    const result = await sendDailyDigest();
    return NextResponse.json({ ...result, charges });
  } catch (err) {
    console.error("Erro no cron de lembretes:", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
