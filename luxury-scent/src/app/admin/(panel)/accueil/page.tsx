import Link from "next/link";
import { prisma } from "@/lib/db";
import { HOME_SECTION_LABELS, type HomeSectionType } from "@/lib/constants";
import { AnnouncementForm, HomeSectionForm } from "@/components/admin/home-forms";
import { ConfirmButton } from "@/components/admin/ui";
import { deleteAnnouncementAction, homeSectionOpAction } from "@/lib/admin-actions/content";

export default async function HomeAdminPage({ searchParams }: { searchParams: Promise<{ modifier?: string; annonce?: string; ok?: string }> }) {
  const sp = await searchParams;
  const [sections, announcements, products] = await Promise.all([
    prisma.homeSection.findMany({ orderBy: { position: "asc" } }),
    prisma.announcement.findMany({ orderBy: { position: "asc" } }),
    prisma.product.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" }, select: { id: true, name: true, subtitle: true } }),
  ]);
  const parse = (s: string | null) => {
    try {
      return s ? (JSON.parse(s) as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  };
  const editing = sp.modifier ? sections.find((s) => s.id === sp.modifier) : undefined;
  const editingAnnouncement = sp.annonce ? announcements.find((a) => a.id === sp.annonce) : undefined;

  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Page d&apos;accueil</h1>
          <p>Composez l&apos;accueil par sections : ordre, textes, images et boutons.</p>
        </div>
        <Link href="/" target="_blank" rel="noopener" className="btn-a btn-a--ghost">
          Voir l&apos;accueil ↗
        </Link>
      </div>
      {sp.ok && <p className="msg msg--ok">Modifications enregistrées et publiées.</p>}
      <div className="grid-side">
        <div>
          <div className="panel">
            <h2>Sections</h2>
            <div className="sections-list">
              {sections.map((s, i) => (
                <div key={s.id} className={`section-row${s.active ? "" : " is-off"}`}>
                  {s.imageUrl ? <img src={s.imageUrl} alt="" /> : <span style={{ width: 70, height: 48, background: "#eee", borderRadius: 3 }} />}
                  <div>
                    <div className="section-row__type">{HOME_SECTION_LABELS[s.type as HomeSectionType] ?? s.type}</div>
                    <Link href={`/admin/accueil?modifier=${s.id}`} className="row-link">
                      {s.title || s.subtitle || "(sans titre)"}
                    </Link>
                    {!s.active && <span className="pill pill--warn" style={{ marginLeft: ".5rem" }}>Masquée</span>}
                  </div>
                  <div className="section-row__actions">
                    <form action={homeSectionOpAction}>
                      <input type="hidden" name="id" value={s.id} />
                      <button type="submit" name="op" value="up" className="btn-a btn-a--ghost btn-a--sm" disabled={i === 0} aria-label="Monter">
                        ↑
                      </button>
                    </form>
                    <form action={homeSectionOpAction}>
                      <input type="hidden" name="id" value={s.id} />
                      <button type="submit" name="op" value="down" className="btn-a btn-a--ghost btn-a--sm" disabled={i === sections.length - 1} aria-label="Descendre">
                        ↓
                      </button>
                    </form>
                    <form action={homeSectionOpAction}>
                      <input type="hidden" name="id" value={s.id} />
                      <button type="submit" name="op" value="toggle" className="btn-a btn-a--ghost btn-a--sm">
                        {s.active ? "Masquer" : "Afficher"}
                      </button>
                    </form>
                    <form action={homeSectionOpAction}>
                      <input type="hidden" name="id" value={s.id} />
                      <input type="hidden" name="op" value="delete" />
                      <ConfirmButton message="Supprimer cette section ?">×</ConfirmButton>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <h2>Bandeau d&apos;annonces</h2>
            <table className="tbl">
              <tbody>
                {announcements.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <Link href={`/admin/accueil?annonce=${a.id}#annonces`} className="row-link">
                        {a.text}
                      </Link>
                      {a.url && <span className="muted small"> → {a.url}</span>}
                    </td>
                    <td>
                      <span className={`pill ${a.active ? "pill--ok" : "pill--err"}`}>{a.active ? "Active" : "Inactive"}</span>
                    </td>
                    <td className="ta-r">
                      <form action={deleteAnnouncementAction}>
                        <input type="hidden" name="id" value={a.id} />
                        <ConfirmButton message="Supprimer cette annonce ?">Supprimer</ConfirmButton>
                      </form>
                    </td>
                  </tr>
                ))}
                {announcements.length === 0 && (
                  <tr>
                    <td className="muted">Aucune annonce.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          {editing && (
            <p>
              <Link href="/admin/accueil" className="btn-a btn-a--ghost btn-a--sm">
                + Nouvelle section
              </Link>
            </p>
          )}
          <HomeSectionForm key={editing?.id ?? "new"} section={editing ? { ...editing, data: parse(editing.data) } : undefined} products={products} />
          <AnnouncementForm key={editingAnnouncement?.id ?? "new-a"} announcement={editingAnnouncement} />
        </div>
      </div>
    </>
  );
}
