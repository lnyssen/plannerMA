// Déclencheur du récap quotidien — pas de planificateur applicatif interne
// (pas de node-cron qui tournerait dans le même processus que Next.js, fragile
// en environnement PaaS où plusieurs instances peuvent démarrer). En
// production, le planificateur d'Infomaniak Jelastic (ou tout cron externe)
// appelle cette route une fois par jour ouvré avec le secret partagé.

import { NextResponse } from "next/server";
import { checkMilestoneAlerts, checkProjectPaceAlerts, runDailyDigest } from "@/lib/mail/notify";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const provided = request.headers.get("x-cron-secret");
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const [digest, paceAlerts, milestoneAlerts] = await Promise.all([
    runDailyDigest(),
    checkProjectPaceAlerts(),
    checkMilestoneAlerts(),
  ]);
  return NextResponse.json({ ...digest, ...paceAlerts, jalonsSignales: milestoneAlerts.alerted });
}
