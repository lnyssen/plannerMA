import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { readUploadedFile } from "@/lib/storage/local";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Non autorisé", { status: 401 });

  const { id } = await params;
  const attachment = await db.attachment.findUnique({ where: { id } });
  if (!attachment || attachment.kind !== "FILE" || !attachment.storageKey) {
    return new NextResponse("Introuvable", { status: 404 });
  }

  const bytes = await readUploadedFile(attachment.storageKey).catch(() => null);
  if (!bytes) return new NextResponse("Fichier introuvable sur le serveur", { status: 404 });

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": attachment.mimeType || "application/octet-stream",
      "Content-Disposition": `inline; filename="${encodeURIComponent(attachment.name)}"`,
      "Cache-Control": "private, max-age=0, no-cache",
    },
  });
}
