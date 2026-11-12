import type { Metadata } from "next";
import Link from "next/link";
import { CartPageLines } from "@/components/shop/cart-page-lines";

export const metadata: Metadata = { title: "Mon panier", robots: { index: false } };

export default function CartPage() {
  return (
    <div className="container">
      <header className="page-title">
        <p className="eyebrow">Votre sélection</p>
        <h1>Mon panier</h1>
      </header>
      <CartPageLines />
      <p className="prose-center" style={{ margin: "3rem 0 5rem" }}>
        <Link href="/parfums" className="link-line">
          Continuer mes achats
        </Link>
      </p>
    </div>
  );
}
