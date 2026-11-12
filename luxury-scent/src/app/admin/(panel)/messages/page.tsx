import { prisma } from "@/lib/db";
import { ConfirmButton } from "@/components/admin/ui";
import { deleteMessageAction, markMessageReadAction } from "@/lib/admin-actions/content";

export default async function MessagesPage() {
  const messages = await prisma.contactMessage.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Messages de contact</h1>
          <p>Reçus via le formulaire du site.</p>
        </div>
      </div>
      <div className="panel">
        {messages.length === 0 && <p className="muted">Aucun message.</p>}
        {messages.map((m) => (
          <div key={m.id} style={{ padding: "1rem 0", borderBottom: "1px solid var(--a-line)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
              <div>
                <strong>{m.name}</strong> · <a href={`mailto:${m.email}`}>{m.email}</a>
                {!m.read && <span className="pill pill--gold" style={{ marginLeft: ".5rem" }}>Nouveau</span>}
                <div className="muted small">
                  {m.createdAt.toLocaleString("fr-FR")}
                  {m.subject ? ` · ${m.subject}` : ""}
                </div>
              </div>
              <div style={{ display: "flex", gap: ".4rem" }}>
                <form action={markMessageReadAction}>
                  <input type="hidden" name="id" value={m.id} />
                  <input type="hidden" name="read" value={m.read ? "0" : "1"} />
                  <button type="submit" className="btn-a btn-a--ghost btn-a--sm">
                    {m.read ? "Marquer non lu" : "Marquer lu"}
                  </button>
                </form>
                <form action={deleteMessageAction}>
                  <input type="hidden" name="id" value={m.id} />
                  <ConfirmButton message="Supprimer ce message ?">Supprimer</ConfirmButton>
                </form>
              </div>
            </div>
            <p style={{ marginTop: ".6rem", whiteSpace: "pre-line" }}>{m.message}</p>
          </div>
        ))}
      </div>
    </>
  );
}
