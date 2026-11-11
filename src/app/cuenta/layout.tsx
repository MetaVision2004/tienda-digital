import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mi cuenta | Marea Digital",
  robots: { index: false, follow: false },
};

export default function CustomerAccountLayout({ children }: LayoutProps<"/cuenta">) {
  return children;
}
