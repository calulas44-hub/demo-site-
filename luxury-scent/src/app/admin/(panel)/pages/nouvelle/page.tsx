import Link from "next/link";
import { PageForm } from "@/components/admin/page-form";

export default function NewPage() {
  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Nouvelle page</h1>
          <p>
            <Link href="/admin/pages">← Retour aux pages</Link>
          </p>
        </div>
      </div>
      <PageForm />
    </>
  );
}
