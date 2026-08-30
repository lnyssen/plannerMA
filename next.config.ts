import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Kanban, Semaine et Gantt vivent maintenant en onglets d'un seul écran
  // « Planning » (voir src/app/(app)/planning/) — redirige les anciens liens
  // (marque-pages, historique de navigateur) plutôt que de renvoyer un 404.
  async redirects() {
    return [
      { source: "/kanban", destination: "/planning?vue=kanban", permanent: true },
      { source: "/semaine", destination: "/planning?vue=semaine", permanent: true },
      { source: "/gantt", destination: "/planning?vue=gantt", permanent: true },
    ];
  },
};

export default nextConfig;
