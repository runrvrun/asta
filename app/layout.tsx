import type { Metadata, Viewport } from "next";
import { Montserrat, Open_Sans } from "next/font/google";
import { Toaster } from "@/components/ui";
import { StoreHydrator } from "@/lib/store";
import "./globals.css";

const montserrat = Montserrat({ subsets: ["latin"], weight: ["500", "600", "700", "800"], variable: "--font-montserrat" });
const openSans = Open_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-open-sans" });

export const metadata: Metadata = {
  title: { default: "Asta — Sistem Manajemen Aset", template: "%s · Asta" },
  description: "Asta: sistem manajemen aset terpadu untuk pesawat, helikopter, kendaraan, persenjataan, tanah, dan bangunan.",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = { themeColor: "#0B2A4A", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${montserrat.variable} ${openSans.variable}`}>
      <body>
        <StoreHydrator />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
