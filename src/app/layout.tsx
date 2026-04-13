import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RLK AI Diagnostic and Board Brief",
  description: "AI Strategy Diagnostic for Enterprise Leadership",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
