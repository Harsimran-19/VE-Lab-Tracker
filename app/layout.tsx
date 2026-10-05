import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Venture Engineering Lab Tracker", description: "The Venture Engineering Lab research workspace for projects, responsibilities, and weekly updates." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
