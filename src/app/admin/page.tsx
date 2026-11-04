import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowLeft, ArrowUpRight, CircleCheck, Layers3, LogOut, PackagePlus, ShoppingBag } from "lucide-react";
import { categoryLabel, formatCurrency } from "@/lib/catalog-model";
import { requireStaff } from "@/lib/staff-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import ProductFileInput from "@/components/product-file-input";
import { saveProduct, signOut, updateOrder } from "./actions";

const statuses = ["pending", "paid", "delivered", "cancelled", "refunded"] as const;
const statusLabels: Record<string, string> = { pending: "Pendiente", paid: "Pagado", delivered: "Entregado", cancelled: "Cancelado", refunded: "Reembolsado" };
const notices: Record<string, string> = { "product-saved": "Producto guardado.", "order-updated": "Pedido actualizado.", "invalid-product": "Revisa los datos del producto.", "invalid-order": "No se pudo validar el pedido.", "order-not-found": "No se encontró el pedido de esta empresa.", "save-failed": "No se pudieron guardar los cambios." };

async function AdminContent({ searchParams }: PageProps<"/admin">) {
  await connection();
  const staff = await requireStaff();
  const canManageProducts = staff.roles.some((role) => ["admin", "seller"].includes(role));
  const admin = createAdminClient();
  const [categoryResult, productResult, customerResult] = await Promise.all([
    admin.from("categories").select("id,name").order("name"),
    admin.from("products").select("id,category_id,name,description,price,product_type,file_url,is_active,created_at").eq("company_id", staff.companyId).order("created_at", { ascending: false }),
    admin.from("customers").select("id,full_name,email").eq("company_id", staff.companyId),
  ]);
  const customers = customerResult.data ?? [];
  const customerById = new Map(customers.map((customer) => [customer.id, customer]));
  const customerIds = customers.map((customer) => customer.id);
  const orderResult = customerIds.length ? await admin.from("orders").select("id,customer_id,status,total,created_at").in("customer_id", customerIds).order("created_at", { ascending: false }).limit(50) : { data: [], error: null };
  const orders = orderResult.data ?? [];
  const orderIds = orders.map((order) => order.id);
  const detailResult = orderIds.length ? await admin.from("order_details").select("id,order_id,product_id,quantity,unit_price,license_key").in("order_id", orderIds) : { data: [], error: null };
  const details = detailResult.data ?? [];
  const productIds = [...new Set(details.map((detail) => detail.product_id))];
  const detailProducts = productIds.length ? await admin.from("products").select("id,name,product_type").eq("company_id", staff.companyId).in("id", productIds) : { data: [], error: null };
  const productNames = new Map((detailProducts.data ?? []).map((product) => [product.id, product]));
  const params = await searchParams;
  const notice = typeof params.notice === "string" ? notices[params.notice] : undefined;
  const pendingCount = orders.filter((order) => order.status === "pending").length;
  const paidTotal = orders.filter((order) => ["paid", "delivered"].includes(order.status)).reduce((sum, order) => sum + Number(order.total), 0);

  return <main className="admin-shell">
    <header className="admin-header"><Link className="brand" href="/"><span className="brand-mark"><Layers3 size={17} /></span><span>marea<small>gestión de tienda</small></span></Link><div className="admin-user"><span>{staff.fullName} <small>{staff.roles.join(" · ")}</small></span><form action={signOut}><button className="icon-button" type="submit" aria-label="Cerrar sesión" title="Cerrar sesión"><LogOut size={16} /></button></form></div></header>
    <div className="admin-content">
      <div className="admin-title-row"><div><Link className="text-link" href="/"><ArrowLeft size={14} /> Ver tienda</Link><h1>Panel de control</h1><p>Pedidos y catálogo de {staff.fullName}.</p></div><Link className="button-primary" href="/#catalogo">Abrir tienda <ArrowUpRight size={15} /></Link></div>
      {notice && <p className="admin-notice" role="status">{notice}</p>}
      <section className="metric-row" aria-label="Resumen de la tienda"><article><span>Pedidos recientes</span><strong>{orders.length}</strong><small>últimos 50 registros</small></article><article><span>Pendientes</span><strong>{pendingCount}</strong><small>requieren seguimiento</small></article><article><span>Ventas confirmadas</span><strong>{formatCurrency(paidTotal)}</strong><small>pagados y entregados</small></article><article><span>Productos activos</span><strong>{(productResult.data ?? []).filter((product) => product.is_active).length}</strong><small>en el catálogo</small></article></section>

      <section className="admin-section"><div className="admin-section-heading"><div><span className="eyebrow">Actividad reciente</span><h2>Pedidos</h2></div><span className="admin-count"><ShoppingBag size={14} /> {orders.length}</span></div>
        {orders.length ? <div className="order-list">{orders.map((order) => {
          const customer = customerById.get(order.customer_id);
          const orderDetails = details.filter((detail) => detail.order_id === order.id);
          return <article className="order-row" key={order.id}><div className="order-summary"><div><strong>{customer?.full_name ?? "Cliente"}</strong><span>{customer?.email ?? ""}</span><small>{new Date(order.created_at).toLocaleString("es", { dateStyle: "medium", timeStyle: "short" })} · #{order.id.slice(0, 8)}</small></div><span className={`order-status status-${order.status}`}>{statusLabels[order.status] ?? order.status}</span><strong className="order-total">{formatCurrency(Number(order.total))}</strong></div>
            <form className="order-edit" action={updateOrder}><input type="hidden" name="order_id" value={order.id} /><div className="order-lines">{orderDetails.map((detail) => <label className="order-line" key={detail.id}><span>{productNames.get(detail.product_id)?.name ?? "Producto"} <small>× {detail.quantity} · {formatCurrency(Number(detail.unit_price))}</small></span><input name={`licenseKey_${detail.id}`} defaultValue={detail.license_key ?? ""} placeholder="Clave de licencia (opcional)" aria-label={`Clave de licencia para ${productNames.get(detail.product_id)?.name ?? "producto"}`} /></label>)}</div><div className="order-actions"><label className="sr-only" htmlFor={`status-${order.id}`}>Estado del pedido</label><select id={`status-${order.id}`} name="status" defaultValue={order.status}>{statuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select><button className="button-quiet" type="submit"><CircleCheck size={15} /> Guardar pedido</button></div></form>
          </article>;
        })}</div> : <div className="admin-empty">Todavía no hay pedidos registrados.</div>}
      </section>

      <section className="admin-section"><div className="admin-section-heading"><div><span className="eyebrow">Colección</span><h2>Productos</h2></div><span className="admin-count"><Layers3 size={14} /> {(productResult.data ?? []).length}</span></div>
        {canManageProducts ? <>
          <form className="product-editor new-product" action={saveProduct}><div className="editor-heading"><PackagePlus size={17} /><strong>Agregar un producto</strong></div><div className="editor-fields"><label className="form-control">Nombre<input name="name" required maxLength={120} /></label><label className="form-control">Precio<input name="price" type="number" min="0" step="0.01" required /></label><label className="form-control">Categoría<select name="category_id"><option value="">Sin categoría</option>{(categoryResult.data ?? []).map((category) => <option key={category.id} value={category.id}>{categoryLabel(category.name)}</option>)}</select></label><label className="form-control">Tipo<select name="product_type"><option value="download">Descarga</option><option value="license">Licencia</option><option value="course">Curso</option><option value="subscription">Suscripción</option></select></label><label className="form-control editor-wide">Descripción<textarea name="description" maxLength={2000} rows={2} /></label><label className="form-control editor-wide">Archivo digital<ProductFileInput /></label><label className="check-control"><input type="checkbox" name="is_active" defaultChecked /> Publicar en tienda</label></div><button className="button-primary" type="submit">Crear producto <PackagePlus size={15} /></button></form>
          <div className="managed-products">{(productResult.data ?? []).map((product) => <form className="product-editor" action={saveProduct} key={product.id}><input type="hidden" name="id" value={product.id} /><div className="editor-heading"><strong>{product.name}</strong><span className={product.is_active ? "active-label" : "inactive-label"}>{product.is_active ? "Publicado" : "Oculto"}</span></div><div className="editor-fields"><label className="form-control">Nombre<input name="name" defaultValue={product.name} required maxLength={120} /></label><label className="form-control">Precio<input name="price" type="number" min="0" step="0.01" defaultValue={product.price} required /></label><label className="form-control">Categoría<select name="category_id" defaultValue={product.category_id ?? ""}><option value="">Sin categoría</option>{(categoryResult.data ?? []).map((category) => <option key={category.id} value={category.id}>{categoryLabel(category.name)}</option>)}</select></label><label className="form-control">Tipo<select name="product_type" defaultValue={product.product_type}><option value="download">Descarga</option><option value="license">Licencia</option><option value="course">Curso</option><option value="subscription">Suscripción</option></select></label><label className="form-control editor-wide">Descripción<textarea name="description" defaultValue={product.description ?? ""} maxLength={2000} rows={2} /></label><label className="form-control editor-wide">Archivo digital<ProductFileInput defaultValue={product.file_url ?? ""} /></label><label className="check-control"><input type="checkbox" name="is_active" defaultChecked={product.is_active} /> Publicar en tienda</label></div><button className="button-quiet" type="submit">Guardar cambios</button></form>)}</div>
        </> : <p className="admin-empty">Tu rol permite consultar pedidos. Un administrador o vendedor puede editar el catálogo.</p>}
      </section>
      <p className="admin-footnote">Los pedidos se registran pendientes de pago. Confirma el pago antes de marcarlos como pagados o entregados.</p>
    </div>
  </main>;
}

export default function AdminPage(props: PageProps<"/admin">) {
  return <Suspense fallback={<main className="storefront-loading" aria-label="Cargando panel"><span className="brand-mark">M</span><p>Preparando el panel...</p></main>}><AdminContent {...props} /></Suspense>;
}