import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "YouFinder",
  description: "Un espace personnel pour explorer des niches YouTube.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="fr"><body>{children}</body></html>;
}
