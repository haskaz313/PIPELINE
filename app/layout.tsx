import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Paggo Pipeline",
  description: "Sales pipeline intelligence",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
