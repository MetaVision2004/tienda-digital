import { NextResponse } from "next/server";
import { z } from "zod";
import { createOrderAccessToken } from "@/lib/order-access";
import { createAdminClient } from "@/lib/supabase/admin";

const checkoutSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.email().max(254).transform((email) => email.toLowerCase()),
  items: z.array(z.object({ productId: z.uuid(), quantity: z.number().int().min(1).max(10) })).min(1).max(20),
});

export async function POST(request: Request) {
  const companyId = process.env.STORE_COMPANY_ID;
  const hasSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && companyId);
  if (!hasSupabase || !process.env.ORDER_ACCESS_SECRET || process.env.ORDER_ACCESS_SECRET.length < 32) {
    return NextResponse.json({ error: "La tienda todavía no está configurada para recibir pedidos." }, { status: 503 });
  }

  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(request.url).host) {
    return NextResponse.json({ error: "Solicitud no permitida." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "El formato de la solicitud no es válido." }, { status: 400 });
  }
  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Revisa el nombre, el correo y los productos del pedido." }, { status: 400 });

  const { fullName, email, items } = parsed.data;
  const quantities = new Map<string, number>();
  for (const item of items) quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
  if ([...quantities.values()].some((quantity) => quantity > 10)) {
    return NextResponse.json({ error: "La cantidad máxima por producto es 10." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const productIds = [...quantities.keys()];
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id,name,price")
    .eq("company_id", companyId!)
    .eq("is_active", true)
    .in("id", productIds);

  if (productsError) return NextResponse.json({ error: "No fue posible validar el catálogo." }, { status: 500 });
  if (!products || products.length !== productIds.length) {
    return NextResponse.json({ error: "Uno o más productos ya no están disponibles." }, { status: 409 });
  }

  const productMap = new Map(products.map((product) => [product.id, product]));
  const total = products.reduce((sum, product) => sum + Number(product.price) * quantities.get(product.id)!, 0);
  if (!Number.isFinite(total) || total > 99_999_999.99) {
    return NextResponse.json({ error: "El total del pedido está fuera del rango permitido." }, { status: 400 });
  }

  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .upsert({ company_id: companyId!, full_name: fullName, email }, { onConflict: "company_id,email" })
    .select("id")
    .single();
  if (customerError || !customer) return NextResponse.json({ error: "No fue posible registrar los datos del cliente." }, { status: 500 });

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({ customer_id: customer.id, status: "pending", total })
    .select("id")
    .single();
  if (orderError || !order) return NextResponse.json({ error: "No fue posible crear el pedido." }, { status: 500 });

  const details = [...quantities].map(([productId, quantity]) => ({
    order_id: order.id,
    product_id: productId,
    quantity,
    unit_price: Number(productMap.get(productId)!.price),
  }));
  const { error: detailError } = await supabase.from("order_details").insert(details);
  if (detailError) {
    await supabase.from("orders").delete().eq("id", order.id);
    return NextResponse.json({ error: "No fue posible completar las líneas del pedido." }, { status: 500 });
  }

  return NextResponse.json({ orderId: order.id, accessToken: createOrderAccessToken(order.id), total }, { status: 201 });
}