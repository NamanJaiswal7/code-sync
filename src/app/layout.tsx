import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CodeSync - Collaborative Code Editor",
  description: "Real-time collaborative code editor with live cursor tracking and conflict resolution",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
