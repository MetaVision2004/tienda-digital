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
  const ipLimit = await consumeRateLimit("magic-link-ip", address, 5, 900);
  const emailLimit = ipLimit === true ? await consumeRateLimit("magic-link-email", parsed.data.email, 5, 900) : ipLimit;
  if (ipLimit === null || emailLimit === null) return NextResponse.json({ error: "Acceso temporalmente no disponible." }, { status: 503 });
  if (!ipLimit || !emailLimit) return NextResponse.json({ error: "Demasiadas solicitudes. Inténtalo más tarde." }, { status: 429 });

  const callback = new URL("/auth/callback?next=%2Fadmin", getSiteUrl()).toString();
  await (await createSupabaseServerClient()).auth.signInWithOtp({
    email: parsed.data.email,
    options: { shouldCreateUser: false, emailRedirectTo: callback },
  });

  return NextResponse.json({ ok: true, message: "Si el correo está autorizado, recibirás un enlace de acceso." });
}