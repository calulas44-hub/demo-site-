"use server";

import { prisma } from "./db";
import { contactSchema, emailSchema, firstError, formToObject } from "./validators";
import { sendContactNotification } from "./email";

export interface FormState {
  ok: boolean;
  message: string;
}

export async function subscribeNewsletterAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { ok: false, message: "Adresse e-mail invalide." };
  await prisma.newsletterSubscriber.upsert({ where: { email: parsed.data }, create: { email: parsed.data }, update: {} });
  return { ok: true, message: "Merci, votre inscription est confirmée." };
}

export async function contactAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = contactSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, message: firstError(parsed.error) };
  const d = parsed.data;
  await prisma.contactMessage.create({ data: { name: d.name, email: d.email, subject: d.subject, message: d.message } });
  await sendContactNotification(d.name, d.email, d.subject, d.message);
  return { ok: true, message: "Merci, votre message a bien été envoyé. Nous vous répondons sous 48 h ouvrées." };
}
