import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "庫存管理 V2", template: "%s｜庫存管理 V2" },
  description: "單人內部使用的雲端庫存管理系統",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-Hant"><body>{children}</body></html>;
}
