import type { Metadata } from "next";
import { getSiteUrl } from "@/lib/site-url";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  title: "Marea Digital | Ideas para descargar",
  description: "Recursos digitales, cursos y herramientas para crear mejor.",
  openGraph: {
    type: "website",
    locale: "es_ES",
    siteName: "Marea Digital",
    title: "Marea Digital | Ideas para descargar",
    description: "Recursos digitales, cursos y herramientas para crear mejor.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
