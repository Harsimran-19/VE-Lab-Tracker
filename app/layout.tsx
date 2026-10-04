import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "VE Lab · Research workspace", description: "A calmer way to track research, share progress, and move ideas forward." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
