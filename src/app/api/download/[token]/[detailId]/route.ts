import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyOrderAccessToken } from "@/lib/order-access";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string; detailId: string }> }) {
  const { token, detailId } = await params;
  const access = verifyOrderAccessToken(token);
  if (!access || !z.uuid().safeParse(detailId).success) return NextResponse.json({ error: "Enlace no válido." }, { status: 404 });

  const admin = createAdminClient();
  const { data: order } = await admin.from("orders").select("id,customer_id,status").eq("id", access.orderId).maybeSingle();
  if (!order || order.status !== "delivered") return NextResponse.json({ error: "El pedido todavía no está disponible para descarga." }, { status: 403 });
  const { data: detail } = await admin.from("order_details").select("product_id,download_expires_at").eq("id", detailId).eq("order_id", order.id).maybeSingle();
  if (!detail || !detail.download_expires_at || new Date(detail.download_expires_at).getTime() <= Date.now()) {
    return NextResponse.json({ error: "El enlace de descarga venció." }, { status: 410 });
  }
  const { data: customer } = await admin.from("customers").select("company_id").eq("id", order.customer_id).maybeSingle();
  if (!customer) return NextResponse.json({ error: "Pedido no encontrado." }, { status: 404 });
  const { data: product } = await admin.from("products").select("file_url").eq("id", detail.product_id).eq("company_id", customer.company_id).maybeSingle();
  if (!product?.file_url) return NextResponse.json({ error: "Este producto no tiene un archivo configurado." }, { status: 404 });

  if (product.file_url.startsWith("https://")) return NextResponse.redirect(product.file_url);
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "digital-products";
  const { data: signedUrl, error } = await admin.storage.from(bucket).createSignedUrl(product.file_url.replace(/^\/+/, ""), 60, { download: true });
  if (error || !signedUrl) return NextResponse.json({ error: "No fue posible preparar la descarga." }, { status: 500 });
  return NextResponse.redirect(signedUrl.signedUrl);
}