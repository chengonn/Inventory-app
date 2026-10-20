import type { Metadata } from "next";
import "./globals.css";
import { getLocale } from "@/lib/i18n/server";
import { LanguageProvider } from "@/components/language-provider";

export async function generateMetadata(): Promise<Metadata> {
  const en = (await getLocale()) === "en";
  return {
    title: {
      default: en ? "Inventory V2" : "庫存管理 V2",
      template: en ? "%s | Inventory V2" : "%s｜庫存管理 V2",
    },
    description: en
      ? "Cloud inventory management portfolio demo"
      : "雲端庫存管理系統",
    robots: { index: false, follow: false },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body>
        <LanguageProvider initialLocale={locale}>{children}</LanguageProvider>
      </body>
    </html>
  );
}
