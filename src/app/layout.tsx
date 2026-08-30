import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Studio planner — Média Animation",
  description: "Planning et attribution de tâches pour les studios de Média Animation asbl.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
