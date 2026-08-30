// Stockage de fichiers — développement uniquement.
//
// Écrit sur le disque local du serveur, hors de `public/` (donc pas servi
// directement, seulement via la route protégée par session
// `src/app/api/attachments/[id]/route.ts`). Ne convient pas à la production
// : système de fichiers éphémère sur la plupart des hébergeurs, ne
// fonctionne pas à plusieurs instances. En production, cette fonction est le
// seul endroit à remplacer par un client S3 (Infomaniak Public Cloud Object
// Storage, voir .env.example et README) — le reste du code (actions,
// composants) n'a pas à changer.

import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const UPLOAD_DIR = path.join(process.cwd(), ".data", "uploads");
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 Mo

export async function saveUploadedFile(bytes: Buffer): Promise<string> {
  await mkdir(UPLOAD_DIR, { recursive: true });
  const key = randomUUID();
  await writeFile(path.join(UPLOAD_DIR, key), bytes);
  return key;
}

export async function readUploadedFile(storageKey: string): Promise<Buffer> {
  return readFile(path.join(UPLOAD_DIR, storageKey));
}

export async function deleteUploadedFile(storageKey: string): Promise<void> {
  await rm(path.join(UPLOAD_DIR, storageKey), { force: true });
}
