import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { createOrderAccessToken, hasOrderAccessSecret } from "@/lib/order-access";
import { hasSupabaseServerConfig } from "@/lib/env-server";
import { consumeRateLimit, getClientAddress } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

const checkoutSchema = z.object({
  idempotencyKey: z.uuid(),
  fullName: z.string().trim().min(2).max(120),
  email: z.email().max(254).transform((email) => email.toLowerCase()),
  items: z.array(z.object({ productId: z.uuid(), quantity: z.number().int().min(1).max(10) })).min(1).max(20),
});

export async function POST(request: Request) {
  const companyId = process.env.STORE_COMPANY_ID;
  if (!hasSupabaseServerConfig() || !companyId || !hasOrderAccessSecret()) {
    return NextResponse.json({ error: "La tienda todavía no está configurada para recibir pedidos." }, { status: 503 });
  }

  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(request.url).host) {
    return NextResponse.json({ error: "Solicitud no permitida." }, { status: 403 });
  }

  const rateLimit = await consumeRateLimit("checkout", getClientAddress(request.headers), 8, 3600);
  if (rateLimit === null) return NextResponse.json({ error: "El checkout está temporalmente no disponible." }, { status: 503 });
  if (!rateLimit) return NextResponse.json({ error: "Demasiados intentos. Espera antes de crear otro pedido." }, { status: 429 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "El formato de la solicitud no es válido." }, { status: 400 });
  }
  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Revisa el nombre, el correo y los productos del pedido." }, { status: 400 });

  const { idempotencyKey, fullName, email, items } = parsed.data;
  const quantities = new Map<string, number>();
  for (const item of items) quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
  if ([...quantities.values()].some((quantity) => quantity > 10)) {
    return NextResponse.json({ error: "La cantidad máxima por producto es 10." }, { status: 400 });
  }

  const normalizedItems = [...quantities.entries()]
    .map(([productId, quantity]) => ({ productId, quantity }))
    .sort((left, right) => left.productId.localeCompare(right.productId));
  const requestHash = createHash("sha256")
    .update(JSON.stringify({ fullName, email, items: normalizedItems }))
    .digest("hex");

  const { data, error } = await createAdminClient().rpc("create_checkout_order", {
    p_company_id: companyId!,
    p_full_name: fullName,
    p_email: email,
    p_items: normalizedItems.map((item) => ({ productId: item.productId, quantity: item.quantity })),
    p_request_key: idempotencyKey,
    p_request_hash: requestHash,
  });

  if (error) {
    if (error.code === "P0002") return NextResponse.json({ error: "Uno o más productos ya no están disponibles." }, { status: 409 });
    if (error.code === "23505") return NextResponse.json({ error: "La clave de compra ya se usó con otros datos. Inicia de nuevo el checkout." }, { status: 409 });
    if (error.code === "22023" || error.code === "22003") return NextResponse.json({ error: "Revisa los datos y cantidades del pedido." }, { status: 400 });
    console.error(JSON.stringify({ event: "checkout_rpc_failed", code: error.code }));
    return NextResponse.json({ error: "No fue posible crear el pedido." }, { status: 500 });
  }

  const order = Array.isArray(data) ? data[0] : null;
  if (!order?.order_id) return NextResponse.json({ error: "No fue posible crear el pedido." }, { status: 500 });

  return NextResponse.json({ orderId: order.order_id, accessToken: createOrderAccessToken(order.order_id, new Date(order.order_created_at).getTime()), total: Number(order.total) }, { status: order.created ? 201 : 200 });
}