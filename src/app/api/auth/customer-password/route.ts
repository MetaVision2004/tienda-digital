import { NextResponse } from "next/server";
import { z } from "zod";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getCustomerSession } from "@/lib/customer-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const passwordSchema = z.object({ password: z.string().min(12).max(128) });

export async function POST(request: Request) {
  const customer = await getCustomerSession();
  if (!customer) return NextResponse.json({ error: "El enlace ya no es válido. Inicia sesión de nuevo." }, { status: 401 });

  const rateLimit = await consumeRateLimit("customer-password-update", customer.userId, 5, 3600);
  if (rateLimit === null) return NextResponse.json({ error: "Cambio de contraseña temporalmente no disponible." }, { status: 503 });
  if (!rateLimit) return NextResponse.json({ error: "Demasiados intentos. Espera antes de volver a intentarlo." }, { status: 429 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Solicitud no válida." }, { status: 400 }); }
  const parsed = passwordSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "La contraseña debe tener entre 12 y 128 caracteres." }, { status: 400 });

  const { error } = await (await createSupabaseServerClient()).auth.updateUser({ password: parsed.data.password });
  if (error) return NextResponse.json({ error: "No se pudo actualizar la contraseña." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
