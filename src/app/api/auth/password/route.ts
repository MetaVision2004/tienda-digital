import { NextResponse } from "next/server";
import { z } from "zod";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getStaffSession } from "@/lib/staff-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const passwordSchema = z.object({ password: z.string().min(12).max(128), nonce: z.string().trim().min(1).max(128).optional() });

export async function POST(request: Request) {
  const staff = await getStaffSession();
  if (!staff) return NextResponse.json({ error: "El enlace ya no es válido. Inicia sesión de nuevo." }, { status: 401 });
  const rateLimit = await consumeRateLimit("password-update", staff.id, 5, 3600);
  if (rateLimit === null) return NextResponse.json({ error: "Cambio de contraseña temporalmente no disponible." }, { status: 503 });
  if (!rateLimit) return NextResponse.json({ error: "Demasiados intentos. Espera antes de volver a intentarlo." }, { status: 429 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Solicitud no válida." }, { status: 400 }); }
  const parsed = passwordSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "La contraseña debe tener entre 12 y 128 caracteres." }, { status: 400 });

  const attributes = parsed.data.nonce
    ? { password: parsed.data.password, nonce: parsed.data.nonce }
    : { password: parsed.data.password };
  const { error } = await (await createSupabaseServerClient()).auth.updateUser(attributes);
  if (error) return NextResponse.json({ error: "No se pudo actualizar la contraseña. Verifica el código e inténtalo otra vez." }, { status: 400 });
  return NextResponse.json({ ok: true });
}