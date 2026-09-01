import path from "node:path";
import { defineConfig } from "vitest/config";

// Les tests existants (src/lib/planning/__tests__) importent en relatif et
// n'avaient jamais eu besoin de cet alias — les nouveaux tests sur les
// actions (src/lib/actions) importent leurs dépendances via "@/..." comme le
// reste de l'appli, d'où ce fichier.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
});
