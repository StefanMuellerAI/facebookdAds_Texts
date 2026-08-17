import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Facebook Ads Textgenerator",
  description:
    "Langen Werbetext schreiben, per Knopfdruck Mittel- und Kurzversion generieren, als JSON exportieren und wieder laden.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
