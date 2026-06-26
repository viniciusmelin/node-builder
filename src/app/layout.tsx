import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Synthetix Project Configurator",
  description: "Modern boilerplate generator and project configurator for professional developers.",
};

export const viewport: Viewport = {
  themeColor: "#131313",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
