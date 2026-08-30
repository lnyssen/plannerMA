import { listClientsWithCounts } from "@/lib/data/clients";
import { ClientsView } from "./clients-view";

export default async function ClientsPage() {
  const clients = await listClientsWithCounts();
  return <ClientsView clients={clients} />;
}
