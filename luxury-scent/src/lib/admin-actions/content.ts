"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { logAdminAction, requireAdmin } from "@/lib/auth";
import { announcementSchema, firstError, formToObject, homeSectionSchema, pageSchema } from "@/lib/validators";
import { cleanHtml } from "@/lib/sanitize";
import { uniqueSlug } from "@/lib/slug";
import { mediaUrlFromForm } from "@/lib/storage";
import type { FormState } from "@/lib/shop-actions";

function revalidateShop() {
  revalidatePath("/", "layout");
}

function splitIds(v: string | undefined): string[] {
  return (v ?? "")
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// ------------------------------------------------------------------ Sections d'accueil

export async function saveHomeSectionAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const parsed = homeSectionSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, message: firstError(parsed.error) };
  const d = parsed.data;
  const productIds = formData.getAll("productIds").map(String).filter(Boolean);
  const data: Record<string, unknown> = {
    productIds: productIds.length ? productIds : splitIds(d.productIds),
    align: formData.get("align") ? String(formData.get("align")) : undefined,
    theme: formData.get("theme") ? String(formData.get("theme")) : undefined,
    imageSide: formData.get("imageSide") ? String(formData.get("imageSide")) : undefined,
    layout: ["framed", "below", "cover"].includes(String(formData.get("layout"))) ? String(formData.get("layout")) : undefined,
  };
  let imageUrl: string | null | undefined;
  let imageMobileUrl: string | null | undefined;
  try {
    imageUrl = mediaUrlFromForm(formData, "imageUrl");
    imageMobileUrl = mediaUrlFromForm(formData, "imageMobileUrl");
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Image refusée." };
  }
  const payload = {
    type: d.type,
    title: d.title,
    subtitle: d.subtitle,
    text: d.text,
    buttonLabel: d.buttonLabel,
    buttonUrl: d.buttonUrl,
    position: d.position,
    active: d.active,
    data: JSON.stringify(data),
    ...(imageUrl !== undefined ? { imageUrl } : {}),
    ...(imageMobileUrl !== undefined ? { imageMobileUrl } : {}),
  };
  if (id) await prisma.homeSection.update({ where: { id }, data: payload });
  else {
    const max = await prisma.homeSection.aggregate({ _max: { position: true } });
    await prisma.homeSection.create({ data: { ...payload, position: d.position || (max._max.position ?? 0) + 1 } });
  }
  await logAdminAction(admin.id, "homeSection", id || null, id ? "UPDATE" : "CREATE", { type: d.type, title: d.title });
  revalidateShop();
  redirect("/admin/accueil?ok=1");
}

export async function homeSectionOpAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const op = String(formData.get("op") ?? "");
  const s = await prisma.homeSection.findUnique({ where: { id } });
  if (!s) return;
  if (op === "delete") await prisma.homeSection.delete({ where: { id } });
  else if (op === "toggle") await prisma.homeSection.update({ where: { id }, data: { active: !s.active } });
  else if (op === "up" || op === "down") {
    const all = await prisma.homeSection.findMany({ orderBy: { position: "asc" } });
    const idx = all.findIndex((x) => x.id === id);
    const swap = op === "up" ? idx - 1 : idx + 1;
    if (swap >= 0 && swap < all.length) {
      const reordered = [...all];
      [reordered[idx], reordered[swap]] = [reordered[swap], reordered[idx]];
      await prisma.$transaction(reordered.map((r, i) => prisma.homeSection.update({ where: { id: r.id }, data: { position: i + 1 } })));
    }
  }
  await logAdminAction(admin.id, "homeSection", id, op.toUpperCase());
  revalidateShop();
}

// ------------------------------------------------------------------ Annonces

export async function saveAnnouncementAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const parsed = announcementSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, message: firstError(parsed.error) };
  const d = parsed.data;
  const startsAt = formData.get("startsAt") ? new Date(String(formData.get("startsAt"))) : null;
  const endsAt = formData.get("endsAt") ? new Date(String(formData.get("endsAt"))) : null;
  const data = { text: d.text, url: d.url, position: d.position, active: d.active, startsAt, endsAt };
  if (id) await prisma.announcement.update({ where: { id }, data });
  else await prisma.announcement.create({ data });
  await logAdminAction(admin.id, "announcement", id || null, id ? "UPDATE" : "CREATE");
  revalidateShop();
  redirect("/admin/accueil?ok=1#annonces");
}

export async function deleteAnnouncementAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  await prisma.announcement.delete({ where: { id } }).catch(() => null);
  await logAdminAction(admin.id, "announcement", id, "DELETE");
  revalidateShop();
}

// ------------------------------------------------------------------ Pages

export async function savePageAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const parsed = pageSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, message: firstError(parsed.error) };
  const d = parsed.data;
  const existing = id ? await prisma.page.findUnique({ where: { id } }) : null;
  const slug = existing?.system ? existing.slug : await uniqueSlug(d.slug || d.title, async (s) => Boolean(await prisma.page.findFirst({ where: { slug: s, NOT: id ? { id } : undefined } })));
  const data = { title: d.title, slug, content: cleanHtml(d.content) ?? "", seoTitle: d.seoTitle, seoDescription: d.seoDescription, showInFooter: d.showInFooter, position: d.position, published: d.published };
  const row = id ? await prisma.page.update({ where: { id }, data }) : await prisma.page.create({ data });
  await logAdminAction(admin.id, "page", row.id, id ? "UPDATE" : "CREATE", { title: d.title });
  revalidateShop();
  return { ok: true, message: "Page enregistrée." };
}

export async function deletePageAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin(["OWNER", "ADMIN"]);
  const id = String(formData.get("id") ?? "");
  const page = await prisma.page.findUnique({ where: { id } });
  if (!page || page.system) return;
  await prisma.page.delete({ where: { id } });
  await logAdminAction(admin.id, "page", id, "DELETE", { title: page.title });
  revalidateShop();
  redirect("/admin/pages");
}

// ------------------------------------------------------------------ Messages et newsletter

export async function markMessageReadAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const read = formData.get("read") !== "0";
  await prisma.contactMessage.update({ where: { id }, data: { read } }).catch(() => null);
  revalidatePath("/admin/messages");
}

export async function deleteMessageAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  await prisma.contactMessage.delete({ where: { id } }).catch(() => null);
  revalidatePath("/admin/messages");
}

export async function deleteSubscriberAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  await prisma.newsletterSubscriber.delete({ where: { id } }).catch(() => null);
  revalidatePath("/admin/newsletter");
}
