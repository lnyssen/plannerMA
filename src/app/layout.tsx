import type { Metadata } from "next";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import "./globals.css";

export const metadata: Metadata = {
  title: "Studio planner — Média Animation",
  description: "Planning et attribution de tâches pour les studios de Média Animation asbl.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Thème lu ici (pas dans (app)/layout.tsx) pour être posé sur <html> avant
  // le premier rendu — évite un flash de thème clair avant bascule sombre.
  const session = await auth();
  const account = session?.user
    ? await db.user.findUnique({ where: { id: session.user.id }, select: { theme: true } })
    : null;
  const theme = account?.theme === "DARK" ? "dark" : "light";

  return (
    <html lang="fr" className="h-full antialiased" data-theme={theme}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
