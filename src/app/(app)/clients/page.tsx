import { listClientsWithCounts } from "@/lib/data/clients";
import { ClientsView } from "./clients-view";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ open?: string }>;
}) {
  const [clients, { open }] = await Promise.all([listClientsWithCounts(), searchParams]);
  return <ClientsView clients={clients} initialOpenClientId={open ?? null} />;
}
