import type { Metadata } from "next";
import { redirect } from "next/navigation";
import "../admin.css";
import { getAdminSession } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { hasOwner } from "@/lib/setup-code";
import { AdminLoginForm } from "@/components/admin/login-form";

export const metadata: Metadata = { title: "Administration — Connexion", robots: { index: false, follow: false } };

export default async function AdminLoginPage() {
  if (await getAdminSession()) redirect("/admin");
  // Aucun propriétaire encore créé : première installation.
  if (!(await hasOwner())) redirect("/admin/setup");
  const s = await getSettings();
  return (
    <div className="login-wrap">
      <div className="login-box">
        <h1>{s.brandName}</h1>
        <p className="sub">Espace administrateur</p>
        <AdminLoginForm />
      </div>
    </div>
  );
}
