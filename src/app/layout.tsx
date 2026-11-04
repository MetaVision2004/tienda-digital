import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Marea Digital | Ideas para descargar",
  description: "Recursos digitales, cursos y herramientas para crear mejor.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
