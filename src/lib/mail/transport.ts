// Envoi de courriels — abstraction volontairement mince, sur le même
// principe que src/lib/storage/local.ts pour les pièces jointes : un seul
// endroit à changer le jour où SMTP_HOST est renseigné en production
// (Infomaniak Mail ou autre), pas de réécriture ailleurs.
//
// Sans SMTP_HOST configuré (développement local), aucun courriel réel ne
// part : le message est écrit dans .data/mail/ (gitignored, comme
// .data/uploads/) et journalisé en console, pour pouvoir vérifier le
// contenu sans dépendre d'un serveur SMTP.

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import nodemailer, { type Transporter } from "nodemailer";

const DEV_MAIL_DIR = path.join(process.cwd(), ".data", "mail");

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

let transporter: Transporter | null | undefined;

function getTransporter(): Transporter | null {
  if (transporter !== undefined) return transporter;
  const host = process.env.SMTP_HOST;
  if (!host) {
    transporter = null;
    return transporter;
  }
  transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? "587"),
    secure: false,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
  });
  return transporter;
}

export async function sendMail(message: MailMessage): Promise<void> {
  const from = process.env.SMTP_FROM || "Planning Média Animation <planning@media-animation.be>";
  const real = getTransporter();

  if (!real) {
    await mkdir(DEV_MAIL_DIR, { recursive: true });
    const filename = `${Date.now()}-${message.to.replace(/[^a-z0-9@.]/gi, "_")}.txt`;
    await writeFile(
      path.join(DEV_MAIL_DIR, filename),
      `À : ${message.to}\nSujet : ${message.subject}\n\n${message.text}\n`,
      "utf8",
    );
    console.log(`[mail] SMTP_HOST non configuré — courriel écrit dans .data/mail/${filename}`);
    return;
  }

  await real.sendMail({ from, to: message.to, subject: message.subject, text: message.text, html: message.html });
}
