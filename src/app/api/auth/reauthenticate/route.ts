import { NextResponse } from "next/server";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getStaffSession } from "@/lib/staff-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST() {
  const staff = await getStaffSession();
  if (!staff) return NextResponse.json({ error: "Inicia sesión para continuar." }, { status: 401 });

  const rateLimit = await consumeRateLimit("reauthenticate", staff.id, 3, 900);
  if (rateLimit === null) return NextResponse.json({ error: "Verificación temporalmente no disponible." }, { status: 503 });
  if (!rateLimit) return NextResponse.json({ error: "Espera antes de solicitar otro código." }, { status: 429 });

  const { error } = await (await createSupabaseServerClient()).auth.reauthenticate();
  if (error) return NextResponse.json({ error: "No se pudo enviar el código de verificación." }, { status: 503 });
  return NextResponse.json({ ok: true, message: "Enviamos un código a tu correo confirmado." });
}