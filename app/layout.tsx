import { TeamProvider } from "@/lib/team-context";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FFFC 2025",
  description: "Flag football team goals and shared materials hub.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>
        <TeamProvider>{children}</TeamProvider>
      </body>
    </html>
  );
}
