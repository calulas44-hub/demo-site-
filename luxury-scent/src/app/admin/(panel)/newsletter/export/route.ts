import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  if (!(await getAdminSession())) return new Response("Non autorisé", { status: 401 });
  const subs = await prisma.newsletterSubscriber.findMany({ orderBy: { createdAt: "asc" } });
  const csv = "﻿email;date_inscription\r\n" + subs.map((s) => `${s.email};${s.createdAt.toISOString().slice(0, 10)}`).join("\r\n");
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="newsletter.csv"' } });
}
