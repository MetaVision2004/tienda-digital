"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, ShoppingBag } from "lucide-react";
import { addCartItem } from "@/lib/cart-storage";

export default function AddToCartButton({ productId }: { productId: string }) {
  const router = useRouter();

  function addToCart() {
    addCartItem(productId);
    router.push("/#catalogo");
  }

  return <button className="button-primary" type="button" onClick={addToCart}>Agregar al carrito <ShoppingBag size={16} /><ArrowRight size={15} /></button>;
}