import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowDownToLine, ArrowLeft, Layers3, LogOut, UserRound } from "lucide-react";
import { formatCurrency } from "@/lib/catalog-model";
import { requireCustomer } from "@/lib/customer-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { signOutCustomer } from "./actions";

const statusLabels: Record<string, string> = { pending: "Pendiente de pago", paid: "Pago confirmado", delivered: "Entregado", cancelled: "Cancelado", refunded: "Reembolsado" };

async function CustomerAccountContent() {
  await connection();
  const customer = await requireCustomer();
  const admin = createAdminClient();
  const orderResult = await admin.from("orders").select("id,status,total,created_at").eq("company_id", customer.companyId).eq("customer_id", customer.id).order("created_at", { ascending: false }).limit(50);
  const orders = orderResult.data ?? [];
  const orderIds = orders.map((order) => order.id);
  const detailResult = orderIds.length
    ? await admin.from("order_details").select("order_id,product_id,quantity,unit_price").in("order_id", orderIds)
    : { data: [], error: null };
  const details = detailResult.data ?? [];
  const productIds = [...new Set(details.map((detail) => detail.product_id))];
  const productResult = productIds.length
    ? await admin.from("products").select("id,name").eq("company_id", customer.companyId).in("id", productIds)
    : { data: [], error: null };
  const productNames = new Map((productResult.data ?? []).map((product) => [product.id, product.name]));

  return <main className="admin-shell"><header className="admin-header"><Link className="brand" href="/"><span className="brand-mark"><Layers3 size={17} /></span><span>marea<small>mi cuenta</small></span></Link><form action={signOutCustomer}><button className="icon-button" type="submit" aria-label="Cerrar sesión" title="Cerrar sesión"><LogOut size={16} /></button></form></header><div className="admin-content"><div className="admin-title-row"><div><Link className="text-link" href="/"><ArrowLeft size={14} /> Volver a la tienda</Link><h1>Hola, {customer.fullName}.</h1><p>{customer.email}</p></div><Link className="button-primary" href="/#catalogo"><ArrowDownToLine size={15} /> Explorar recursos</Link></div>
    <section className="admin-section"><div className="admin-section-heading"><div><span className="eyebrow"><UserRound size={14} /> Tu actividad</span><h2>Mis pedidos</h2></div><span className="admin-count">{orders.length} recientes</span></div>
      {orderResult.error || detailResult.error || productResult.error ? <div className="admin-empty">No fue posible cargar tus pedidos.</div> : orders.length === 0 ? <div className="admin-empty">Todavía no tienes pedidos asociados a esta cuenta.</div> : <div className="order-list">{orders.map((order) => <article className="order-row" key={order.id}><div className="order-summary"><div><strong>Pedido #{order.id.slice(0, 8)}</strong><small>{new Date(order.created_at).toLocaleString("es", { dateStyle: "medium", timeStyle: "short" })}</small></div><span className={`order-status status-${order.status}`}>{statusLabels[order.status] ?? order.status}</span><strong className="order-total">{formatCurrency(Number(order.total))}</strong></div><div className="order-lines">{details.filter((detail) => detail.order_id === order.id).map((detail) => <div className="order-line" key={`${detail.order_id}-${detail.product_id}`}><span>{productNames.get(detail.product_id) ?? "Producto digital"} <small>× {detail.quantity} · {formatCurrency(Number(detail.unit_price))}</small></span></div>)}</div></article>)}</div>}
    </section></div></main>;
}

export default function CustomerAccountPage() {
  return <Suspense fallback={<main className="storefront-loading" aria-label="Cargando cuenta"><span className="brand-mark">M</span><p>Cargando tus pedidos...</p></main>}><CustomerAccountContent /></Suspense>;
}
