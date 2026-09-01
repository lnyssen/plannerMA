import { auth } from "@/auth";
import { listClientsWithCounts } from "@/lib/data/clients";
import { ClientsView } from "./clients-view";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ open?: string }>;
}) {
  const [session, clients, { open }] = await Promise.all([auth(), listClientsWithCounts(), searchParams]);
  return <ClientsView clients={clients} initialOpenClientId={open ?? null} isAdmin={session?.user.role === "ADMIN"} />;
}
