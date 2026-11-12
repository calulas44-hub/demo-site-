import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { appSecrets } from "./app-secrets";

async function getKey(): Promise<Buffer> {
  return Buffer.from((await appSecrets()).bank, "hex");
}

/** Chiffre une chaîne en AES-256-GCM. Résultat : base64(iv | tag | données). */
export async function encryptSecret(plain: string): Promise<string> {
  const key = await getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export async function decryptSecret(payload: string): Promise<string> {
  const key = await getKey();
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export function normalizeIban(input: string): string {
  return input.replace(/\s+/g, "").toUpperCase();
}

/** Validation IBAN (format + contrôle mod 97). */
export function isValidIban(input: string): boolean {
  const iban = normalizeIban(input);
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let remainder = 0;
  for (const ch of numeric) remainder = (remainder * 10 + Number(ch)) % 97;
  return remainder === 1;
}

export function isValidBic(input: string): boolean {
  return /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(input.replace(/\s+/g, "").toUpperCase());
}

export function maskIban(iban: string): string {
  const n = normalizeIban(iban);
  if (n.length < 8) return "****";
  return `${n.slice(0, 4)} **** **** **** ${n.slice(-4)}`;
}

/** Présentation par groupes de 4 caractères. */
export function formatIban(iban: string): string {
  return normalizeIban(iban).replace(/(.{4})/g, "$1 ").trim();
}
