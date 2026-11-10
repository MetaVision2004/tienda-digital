import { NextResponse } from "next/server";
import { z } from "zod";
import { consumeRateLimit, getClientAddress } from "@/lib/rate-limit";
import { verifyOrderAccessToken } from "@/lib/order-access";
import { isCompanyStoragePath } from "@/lib/storage-path";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request, { params }: { params: Promise<{ token: string; detailId: string }> }) {
  const rateLimit = await consumeRateLimit("download", getClientAddress(request.headers), 30, 3600);
  if (rateLimit === null) return NextResponse.json({ error: "Descargas temporalmente no disponibles." }, { status: 503 });
  if (!rateLimit) return NextResponse.json({ error: "Límite de descargas alcanzado. Inténtalo más tarde." }, { status: 429 });

  const { token, detailId } = await params;
  const access = verifyOrderAccessToken(token);
  if (!access || !z.uuid().safeParse(detailId).success) return NextResponse.json({ error: "Enlace no válido." }, { status: 404 });

  const admin = createAdminClient();
  const { data: order } = await admin.from("orders").select("id,company_id,status,delivered_at").eq("id", access.orderId).maybeSingle();
  if (!order || order.status !== "delivered") return NextResponse.json({ error: "El pedido todavía no está disponible para descarga." }, { status: 403 });
  if (!order.delivered_at || Date.now() >= new Date(order.delivered_at).getTime() + 30 * 24 * 60 * 60 * 1000) {
    return NextResponse.json({ error: "El enlace de descarga venció." }, { status: 410 });
  }
  const { data: detail } = await admin.from("order_details").select("product_id,download_expires_at").eq("id", detailId).eq("order_id", order.id).maybeSingle();
  if (!detail || !detail.download_expires_at || new Date(detail.download_expires_at).getTime() <= Date.now()) {
    return NextResponse.json({ error: "El enlace de descarga venció." }, { status: 410 });
  }
  const { data: product } = await admin.from("products").select("file_url").eq("id", detail.product_id).eq("company_id", order.company_id).maybeSingle();
  if (!product?.file_url || !isCompanyStoragePath(product.file_url, order.company_id)) return NextResponse.json({ error: "Este producto no tiene un archivo privado configurado." }, { status: 404 });

  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "digital-products";
  const { data: signedUrl, error } = await admin.storage.from(bucket).createSignedUrl(product.file_url, 60, { download: true });
  if (error || !signedUrl) return NextResponse.json({ error: "No fue posible preparar la descarga." }, { status: 500 });
  return NextResponse.redirect(signedUrl.signedUrl);
}