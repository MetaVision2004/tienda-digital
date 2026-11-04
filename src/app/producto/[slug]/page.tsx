import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Layers3, Sparkles } from "lucide-react";
import AddToCartButton from "@/components/add-to-cart-button";
import { formatCurrency, safeImageUrl } from "@/lib/catalog-model";
import { getProductBySlug } from "@/lib/storefront-data";

async function ProductContent({ params }: PageProps<"/producto/[slug]">) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const imageUrl = safeImageUrl(product.image_url);
  const productTypeLabels = { download: "Descarga digital", license: "Licencia", course: "Curso", subscription: "Suscripción" };
  return <main className="product-detail-page">
    <header className="receipt-header"><Link className="brand" href="/"><span className="brand-mark"><Layers3 size={17} /></span><span>marea<small>archivo digital</small></span></Link><Link className="text-link" href="/#catalogo"><ArrowLeft size={14} /> Volver a la colección</Link></header>
    <article className="product-detail">
      <div className={`detail-art ${imageUrl ? "has-image" : ""}`} data-tone={(product.category_id ?? 0) % 4} role={imageUrl ? "img" : undefined} aria-label={imageUrl ? `Portada de ${product.name}` : undefined} style={imageUrl ? { backgroundImage: `url(${JSON.stringify(imageUrl)})` } : undefined}>
        {!imageUrl && <div className="art-caption"><small>{product.product_type}</small><strong>{product.name}</strong><span>Marea / Digital</span></div>}
        {product.is_featured && <span className="detail-badge"><Sparkles size={13} /> Selección destacada</span>}
      </div>
      <div className="detail-copy">
        <div className="detail-kickers"><span className="eyebrow">{productTypeLabels[product.product_type]}</span>{product.is_new && <span className="new-badge">Novedad</span>}</div>
        <h1>{product.name}</h1>
        <p className="detail-description">{product.description || "Un recurso digital para avanzar a tu ritmo."}</p>
        <div className="detail-price">{product.compare_at_price && product.compare_at_price > product.price && <del>{formatCurrency(product.compare_at_price)}</del>}<strong>{formatCurrency(product.price)}</strong></div>
        <p className="detail-delivery">Entrega digital · Sin envío físico</p>
        <AddToCartButton productId={product.id} />
        <Link className="text-link detail-back" href="/#catalogo">Seguir explorando <ArrowRight size={14} /></Link>
      </div>
    </article>
  </main>;
}

export default function ProductPage(props: PageProps<"/producto/[slug]">) {
  return <Suspense fallback={<main className="storefront-loading" aria-label="Cargando producto"><span className="brand-mark">M</span><p>Preparando el producto...</p></main>}><ProductContent {...props} /></Suspense>;
}