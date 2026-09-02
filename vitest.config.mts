import path from "node:path";
import { defineConfig } from "vitest/config";

// Les tests existants (src/lib/planning/__tests__) importent en relatif et
// n'avaient jamais eu besoin de cet alias — les nouveaux tests sur les
// actions (src/lib/actions) importent leurs dépendances via "@/..." comme le
// reste de l'appli, d'où ce fichier.
export default defineConfig({
  test: {
    // Les tests de people/password-reset hachent de vrais mots de passe avec
    // bcrypt (coût 12, ~250 ms l'unité) plutôt que de le simuler — c'est ce
    // qui vérifie que le mot de passe généré correspond bien au hash stocké.
    // Sous charge (serveur de dev ou build en parallèle), quelques-uns
    // dépassaient les 5 s par défaut et échouaient sans qu'aucun code n'ait
    // changé. La marge évite ces faux négatifs sans rien affaiblir.
    testTimeout: 20_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
});
