import type { Metadata } from "next";
import { redirect } from "next/navigation";
import "../admin.css";
import { hasOwner } from "@/lib/setup-code";
import { AdminSetupForm } from "@/components/admin/setup-form";

export const metadata: Metadata = { title: "Administration — Première installation", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminSetupPage() {
  if (await hasOwner()) redirect("/admin/login");
  return (
    <div className="login-wrap">
      <div className="login-box">
        <h1>Première installation</h1>
        <p className="sub">Créez votre compte administrateur</p>
        <p className="small">
          Le code d&apos;installation se trouve dans Netlify : <strong>Deploys</strong> → dernier déploiement → journal (cherchez « CODE D&apos;INSTALLATION »).
        </p>
        <AdminSetupForm />
      </div>
    </div>
  );
}
