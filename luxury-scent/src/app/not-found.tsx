import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container notfound">
      <p className="eyebrow">Erreur 404</p>
      <h1>Cette page est introuvable</h1>
      <p className="lead">Le lien est peut-être incorrect ou la page a été déplacée.</p>
      <Link href="/" className="btn" style={{ marginTop: "1rem" }}>
        Retour à l&apos;accueil
      </Link>
    </div>
  );
}
