import { NextResponse } from "next/server";
import { z } from "zod";
import { consumeRateLimit, getClientAddress } from "@/lib/rate-limit";
import { getSiteUrl } from "@/lib/site-url";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const emailSchema = z.object({ email: z.email().max(254).transform((email) => email.toLowerCase()) });

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(request.url).host) return NextResponse.json({ error: "Solicitud no permitida." }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Solicitud no válida." }, { status: 400 }); }
  const parsed = emailSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Escribe un correo válido." }, { status: 400 });

  const address = getClientAddress(request.headers);
  const ipLimit = await consumeRateLimit("recovery-ip", address, 5, 900);
  const emailLimit = ipLimit === true ? await consumeRateLimit("recovery-email", parsed.data.email, 3, 3600) : ipLimit;
  if (ipLimit === null || emailLimit === null) return NextResponse.json({ error: "Recuperación temporalmente no disponible." }, { status: 503 });
  if (!ipLimit || !emailLimit) return NextResponse.json({ error: "Demasiadas solicitudes. Inténtalo más tarde." }, { status: 429 });

  const callback = new URL("/auth/callback?next=%2Fadmin%2Fpassword", getSiteUrl()).toString();
  await (await createSupabaseServerClient()).auth.resetPasswordForEmail(parsed.data.email, { redirectTo: callback });

  return NextResponse.json({ ok: true, message: "Si existe una cuenta autorizada con ese correo, recibirás instrucciones." });
}