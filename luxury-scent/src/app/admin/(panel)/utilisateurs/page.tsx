import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ADMIN_ROLE_LABELS, type AdminRole } from "@/lib/constants";
import { AdminUserForm } from "@/components/admin/user-form";
import { ConfirmButton } from "@/components/admin/ui";
import { deleteAdminUserAction } from "@/lib/admin-actions/settings";

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ modifier?: string; ok?: string }> }) {
  const me = await requireAdmin(["OWNER"]);
  const sp = await searchParams;
  const [users, audits] = await Promise.all([prisma.adminUser.findMany({ orderBy: { createdAt: "asc" } }), prisma.adminAuditLog.findMany({ orderBy: { createdAt: "desc" }, take: 60, include: { adminUser: { select: { name: true } } } })]);
  const editing = sp.modifier ? users.find((u) => u.id === sp.modifier) : undefined;
  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Utilisateurs de l&apos;administration</h1>
          <p>Comptes ayant accès à cet espace, et journal des actions.</p>
        </div>
      </div>
      {sp.ok && <p className="msg msg--ok">Utilisateur enregistré.</p>}
      <div className="grid-side">
        <div>
          <div className="panel">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Rôle</th>
                  <th>Dernière connexion</th>
                  <th>Statut</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <Link href={`/admin/utilisateurs?modifier=${u.id}`} className="row-link">
                        {u.name}
                      </Link>
                      <br />
                      <span className="muted small">{u.email}</span>
                    </td>
                    <td>{ADMIN_ROLE_LABELS[u.role as AdminRole]}</td>
                    <td>{u.lastLoginAt ? u.lastLoginAt.toLocaleString("fr-FR") : "—"}</td>
                    <td>
                      <span className={`pill ${u.active ? "pill--ok" : "pill--err"}`}>{u.active ? "Actif" : "Désactivé"}</span>
                    </td>
                    <td className="ta-r">
                      {u.id !== me.id && u.active && (
                        <form action={deleteAdminUserAction}>
                          <input type="hidden" name="id" value={u.id} />
                          <ConfirmButton message={`Désactiver l'accès de ${u.name} ?`}>Désactiver</ConfirmButton>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="panel">
            <h2>Journal des actions</h2>
            <table className="tbl">
              <tbody>
                {audits.map((a) => (
                  <tr key={a.id}>
                    <td className="small">{a.createdAt.toLocaleString("fr-FR")}</td>
                    <td className="small">{a.adminUser?.name ?? "—"}</td>
                    <td className="small">
                      <span className="pill">{a.action}</span> {a.entity}
                      {a.details && <span className="muted mono" style={{ fontSize: ".7rem", marginLeft: ".4rem" }}>{a.details.slice(0, 120)}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          {editing && (
            <p>
              <Link href="/admin/utilisateurs" className="btn-a btn-a--ghost btn-a--sm">
                + Nouvel utilisateur
              </Link>
            </p>
          )}
          <AdminUserForm key={editing?.id ?? "new"} user={editing} />
        </div>
      </div>
    </>
  );
}
