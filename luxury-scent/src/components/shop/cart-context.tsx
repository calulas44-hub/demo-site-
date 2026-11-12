"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export interface ClientCartLine {
  variantId: string;
  productId: string;
  name: string;
  slug: string;
  subtitle: string | null;
  brand: string | null;
  variantLabel: string;
  imageUrl: string | null;
  unitPrice: number;
  regularPrice: number;
  quantity: number;
  stock: number;
  total: number;
}

export interface ClientUpsellOffer {
  title: string;
  text: string;
  rate: number;
  maxPrice: number;
  suggestions: { slug: string; name: string; variantId: string; variantLabel: string; imageUrl: string | null; price: number; discountedPrice: number }[];
}

export interface ClientCart {
  lines: ClientCartLine[];
  subtotal: number;
  discount: { variantId: string; amount: number; label: string } | null;
  total: number;
  upsellOffer: ClientUpsellOffer | null;
  count: number;
  freeShippingThreshold: number | null;
  freeShippingRemaining: number | null;
  warnings: string[];
}

interface CartContextValue {
  cart: ClientCart;
  isOpen: boolean;
  setCart: (cart: ClientCart) => void;
  open: () => void;
  close: () => void;
  toast: string | null;
  showToast: (message: string) => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ initialCart, children }: { initialCart: ClientCart; children: React.ReactNode }) {
  const [cart, setCartState] = useState<ClientCart>(initialCart);
  const [isOpen, setOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => setCartState(initialCart), [initialCart]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  const setCart = useCallback((c: ClientCart) => setCartState(c), []);
  const open = useCallback(() => setOpen(true), []);
  const close = useCallback(() => setOpen(false), []);
  const showToast = useCallback((m: string) => setToast(m), []);

  const value = useMemo(() => ({ cart, isOpen, setCart, open, close, toast, showToast }), [cart, isOpen, setCart, open, close, toast, showToast]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart doit être utilisé dans CartProvider.");
  return ctx;
}
