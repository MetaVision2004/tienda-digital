"use client";

import { useState, type FormEvent } from "react";
import { ArrowDownRight, ArrowRight, Check, ChevronRight, CircleHelp, Layers3, Minus, Plus, Search, ShieldCheck, ShoppingBag, Sparkles, X } from "lucide-react";
import { categoryLabel, formatCurrency, type StoreCategory, type StoreProduct } from "@/lib/catalog-model";

type StorefrontProps = { products: StoreProduct[]; categories: StoreCategory[]; demo: boolean };
type OrderResult = { orderId: string; accessToken: string; total: number };

export default function Storefront({ products, categories, demo }: StorefrontProps) {
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [order, setOrder] = useState<OrderResult | null>(null);
  const cartItems = products.filter((product) => cart[product.id]);
  const cartCount = Object.values(cart).reduce((sum, quantity) => sum + quantity, 0);
  const total = cartItems.reduce((sum, product) => sum + product.price * cart[product.id], 0);
  const filteredProducts = products.filter((product) => {
    const matchesCategory = activeCategory === null || product.category_id === activeCategory;
    const matchesSearch = `${product.name} ${product.description ?? ""}`.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  function changeQuantity(productId: string, delta: number) {
    setCart((current) => {
      const next = { ...current };
      const quantity = (next[productId] ?? 0) + delta;
      if (quantity <= 0) delete next[productId];
      else next[productId] = Math.min(quantity, 10);
      return next;
    });
  }

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    const formData = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: formData.get("fullName"), email: formData.get("email"), items: cartItems.map((product) => ({ productId: product.id, quantity: cart[product.id] })) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "No fue posible crear el pedido.");
      setOrder(result as OrderResult);
      setCart({});
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Ocurrió un error inesperado.");
    } finally {
      setSubmitting(false);
    }
  }

  return <>
    <header className="site-header">
      <a className="brand" href="#inicio" aria-label="Marea Digital, inicio"><span className="brand-mark"><Layers3 size={17} strokeWidth={2.2} /></span><span>marea<small>archivo digital</small></span></a>
      <nav className="header-nav" aria-label="Navegación principal"><a href="#catalogo">Explorar</a><a href="#beneficios">La tienda</a><a href="/admin/login">Acceso equipo</a></nav>
      <div className="header-actions"><button className="icon-button" type="button" aria-label={`Abrir carrito, ${cartCount} productos`} onClick={() => { setOrder(null); setCartOpen(true); }}><ShoppingBag size={17} /><span className="cart-count">{cartCount}</span></button></div>
    </header>

    <main id="inicio">
      <section className="hero">
        <div className="hero-copy"><span className="eyebrow">Ideas que toman forma</span><h1>Tu próximo gran proyecto <em>empieza aquí.</em></h1><p>Recursos digitales creados con intención: aprende algo nuevo, encuentra tu método y pon las ideas en movimiento.</p><div className="hero-links"><a className="button-primary" href="#catalogo">Explorar colección <ArrowRight size={16} /></a><a className="text-link" href="#beneficios">Conoce Marea <ArrowDownRight size={15} /></a></div></div>
        <div className="hero-photo" role="img" aria-label="Espacio de trabajo creativo con herramientas digitales"><div className="hero-stamp"><span>Hecho para tus ideas</span></div><div className="photo-label"><strong>Menos vueltas.<br />Más cosas hechas.</strong><span>01 / Colección actual</span></div></div>
      </section>
      <section className="trust-strip" id="beneficios" aria-label="Beneficios de la tienda"><span className="trust-item"><Sparkles size={15} /> Selección curada</span><span className="trust-item"><ShieldCheck size={15} /> Compra segura</span><span className="trust-item"><ArrowDownRight size={15} /> Acceso digital</span><span className="trust-item"><CircleHelp size={15} /> Ayuda cuando la necesitas</span></section>
      <section className="catalog-section" id="catalogo">
        <div className="section-heading"><div><span className="eyebrow">Encuentra tu siguiente paso</span><h2>Una buena idea<br />merece herramientas.</h2></div><p>Guías, cursos y recursos listos para acompañarte del primer borrador al resultado final.</p></div>
        <div className="catalog-tools"><div className="category-list" aria-label="Filtrar por categoría"><button className={`category-chip ${activeCategory === null ? "active" : ""}`} type="button" onClick={() => setActiveCategory(null)}>Todo</button>{categories.map((category) => <button key={category.id} className={`category-chip ${activeCategory === category.id ? "active" : ""}`} type="button" onClick={() => setActiveCategory(category.id)}>{categoryLabel(category.name)}</button>)}</div><label className="search-field"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar en la colección" aria-label="Buscar productos" /></label></div>
        <div className="product-grid">{filteredProducts.map((product, index) => {
          const category = categories.find((item) => item.id === product.category_id);
          return <article className="product-card" key={product.id} style={{ animationDelay: `${index * 55}ms` }}><div className="product-art" data-tone={index % 4}><div className="art-caption"><small>{category ? categoryLabel(category.name) : "Recurso digital"}</small><strong>{product.name}</strong><span>Marea / Digital</span></div></div><div className="product-info"><div><h3>{product.name}</h3><p>{product.description || "Un recurso digital para avanzar a tu ritmo."}</p></div><span className="product-price">{formatCurrency(product.price)}</span></div><button className="product-add" type="button" aria-label={`Añadir ${product.name} al carrito`} onClick={() => { changeQuantity(product.id, 1); setOrder(null); }}><Plus size={16} /></button></article>;
        })}{filteredProducts.length === 0 && <div className="empty-state"><strong>No encontramos ese recurso.</strong>Prueba otra búsqueda o categoría.</div>}</div>
        {demo && <div className="preview-note"><CircleHelp size={17} /><span>Estás viendo una colección de muestra. Conecta Supabase para cargar tus productos y habilitar pedidos reales.</span></div>}
      </section>
    </main>

    <footer className="site-footer"><a className="brand" href="#inicio"><span className="brand-mark"><Layers3 size={16} /></span><span>marea<small>archivo digital</small></span></a><span>Recursos para hacer que las ideas sucedan.</span><div className="footer-links"><a href="/admin/login">Equipo</a><a href="#inicio">Volver arriba <ChevronRight size={13} /></a></div></footer>

    {cartOpen && <><button className="drawer-backdrop" type="button" aria-label="Cerrar carrito" onClick={() => setCartOpen(false)} /><aside className="cart-drawer" aria-label="Carrito de compras">
      <div className="drawer-heading"><h2>{order ? "Pedido recibido" : "Tu selección"}</h2><button className="icon-button" type="button" aria-label="Cerrar" onClick={() => setCartOpen(false)}><X size={17} /></button></div>
      {order ? <div className="checkout-success"><Check size={34} /><span className="status-pill">Pedido pendiente de pago</span><h3>Ya está en marcha.</h3><p>Tu pedido {order.orderId.slice(0, 8)} se registró por {formatCurrency(order.total)}. El equipo actualizará su estado cuando confirme el pago.</p><a className="button-primary" href={`/orders/${order.accessToken}`}>Consultar pedido <ArrowRight size={15} /></a></div> : <>
        <div className="drawer-items">{cartItems.length === 0 ? <div className="empty-state"><strong>Tu carrito está listo para una idea.</strong>Agrega un recurso de la colección.</div> : cartItems.map((product) => <div className="cart-line" key={product.id}><div><strong>{product.name}</strong><small>{formatCurrency(product.price)} · {formatCurrency(product.price * cart[product.id])}</small></div><div className="quantity-control"><button type="button" aria-label={`Quitar una unidad de ${product.name}`} onClick={() => changeQuantity(product.id, -1)}><Minus size={13} /></button><span>{cart[product.id]}</span><button type="button" aria-label={`Agregar una unidad de ${product.name}`} onClick={() => changeQuantity(product.id, 1)}><Plus size={13} /></button></div></div>)}</div>
        {cartItems.length > 0 && <><div className="drawer-total"><span>Total del pedido</span><strong>{formatCurrency(total)}</strong></div>{demo ? <button className="button-primary" type="button" disabled>Conecta Supabase para comprar</button> : <form className="checkout-form" onSubmit={submitOrder}><h3>¿A quién preparamos el pedido?</h3><label className="form-control">Nombre completo<input name="fullName" autoComplete="name" required maxLength={120} /></label><label className="form-control">Correo electrónico<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button-primary" type="submit" disabled={submitting}>{submitting ? "Registrando pedido..." : "Crear pedido"} <ArrowRight size={15} /></button><small>El pedido quedará pendiente; esta tienda aún no procesa pagos.</small></form>}</>}
      </>}
    </aside></>}
  </>;
}