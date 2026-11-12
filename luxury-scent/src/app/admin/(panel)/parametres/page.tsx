import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { SettingsForm } from "@/components/admin/settings-form";

export default async function SettingsPage() {
  await requireAdmin(["OWNER", "ADMIN"]);
  const s = await getSettings();
  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Paramètres</h1>
          <p>Identité, coordonnées, informations légales, TVA, réassurance et référencement. Les changements sont appliqués immédiatement sur le site.</p>
        </div>
      </div>
      <SettingsForm s={s} />
    </>
  );
}
