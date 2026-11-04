import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Check, Clock3, Layers3 } from "lucide-react";
import { formatCurrency } from "@/lib/catalog-model";
import { verifyOrderAccessToken } from "@/lib/order-access";
import { createAdminClient } from "@/lib/supabase/admin";

const statusLabels: Record<string, string> = { pending: "Pendiente de pago", paid: "Pago confirmado", delivered: "Pedido entregado", cancelled: "Cancelado", refunded: "Reembolsado" };

async function OrderContent({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const access = verifyOrderAccessToken(token);
  if (!access) notFound();

  const admin = createAdminClient();
  const { data: order } = await admin.from("orders").select("id,customer_id,status,total,created_at").eq("id", access.orderId).maybeSingle();
  if (!order) notFound();
  const { data: customer } = await admin.from("customers").select("company_id,full_name").eq("id", order.customer_id).maybeSingle();
  if (!customer) notFound();
  const { data: details } = await admin.from("order_details").select("id,product_id,quantity,unit_price,license_key,download_expires_at").eq("order_id", order.id);
  const productIds = (details ?? []).map((detail) => detail.product_id);
  const { data: products } = productIds.length
    ? await admin.from("products").select("id,name,product_type,file_url").eq("company_id", customer.company_id).in("id", productIds)
    : { data: [] };
  const productMap = new Map((products ?? []).map((product) => [product.id, product]));

  return <main className="receipt-page">
    <header className="receipt-header"><Link className="brand" href="/"><span className="brand-mark"><Layers3 size={17} /></span><span>marea<small>archivo digital</small></span></Link><Link className="text-link" href="/"><ArrowLeft size={14} /> Volver a la tienda</Link></header>
    <section className="receipt-card"><span className="receipt-mark">{order.status === "delivered" ? <Check size={23} /> : <Clock3 size={23} />}</span><span className="eyebrow">Seguimiento de pedido</span><h1>{statusLabels[order.status] ?? order.status}</h1><p>Hola {customer.full_name}. Aquí tienes el resumen actualizado de tu pedido.</p><div className="receipt-meta"><span>Pedido <strong>#{order.id.slice(0, 8)}</strong></span><span>Creado <strong>{new Date(order.created_at).toLocaleDateString("es", { dateStyle: "long" })}</strong></span></div>
      <div className="receipt-items">{(details ?? []).map((detail) => {
        const product = productMap.get(detail.product_id);
        const hasDownload = order.status === "delivered" && product?.file_url && detail.download_expires_at;
        return <article className="receipt-item" key={detail.id}><div><strong>{product?.name ?? "Producto digital"}</strong><span>{detail.quantity} × {formatCurrency(Number(detail.unit_price))}</span>{order.status === "delivered" && detail.license_key && <code className="license-code">{detail.license_key}</code>}{hasDownload && <a className="download-link" href={`/api/download/${token}/${detail.id}`}>Descargar recurso <ArrowUpRight size={14} /></a>}</div><strong>{formatCurrency(Number(detail.unit_price) * detail.quantity)}</strong></article>;
      })}</div><div className="receipt-total"><span>Total</span><strong>{formatCurrency(Number(order.total))}</strong></div>
      {order.status === "pending" && <p className="receipt-note">Aún no se ha registrado el pago. El equipo actualizará este pedido cuando lo confirme.</p>}
      {order.status === "delivered" && <p className="receipt-note">Los enlaces de descarga estarán disponibles durante 30 días desde la entrega.</p>}
      {order.status === "paid" && <p className="receipt-note">El pago fue confirmado. El equipo está preparando tu entrega digital.</p>}
    </section>
  </main>;
}

export default function OrderPage({ params }: { params: Promise<{ token: string }> }) {
  return <Suspense fallback={<main className="storefront-loading" aria-label="Cargando pedido"><span className="brand-mark">M</span><p>Consultando tu pedido...</p></main>}><OrderContent params={params} /></Suspense>;
}