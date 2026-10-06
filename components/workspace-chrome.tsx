"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { displayFont, bodyFont } from "./workspace-fonts";
export { workspaceFontClasses } from "./workspace-fonts";
import { HouseIcon, FolderIcon, UsersIcon, UserIcon } from "@phosphor-icons/react";
import type { Screen } from "./workspace-page";

export function WorkspaceChrome({ screen, children }: { screen: Screen; children: ReactNode }) {
  const navigation = [
    { href: "/", label: "Home", Icon: HouseIcon, active: screen === "dashboard" },
    { href: "/projects", label: "Projects", Icon: FolderIcon, active: screen === "projects" || screen === "project" },
    { href: "/team", label: "Team", Icon: UsersIcon, active: screen === "team" || screen === "member" },
  ];

  return (
    <div className={`lab-shell workspace-shell ${displayFont.variable} ${bodyFont.variable}`}>
      <a className="skip-link" href="#workspace-main">Skip to content</a>
      <header className="workspace-topbar">
        <Link href="/" className="workspace-name">Venture Engineering Lab Tracker</Link>
        <Link href="/account" prefetch={false} className={`workspace-account${screen === "account" ? " active" : ""}`} aria-current={screen === "account" ? "page" : undefined}>
          <UserIcon size={24} weight="regular" aria-hidden="true" />
          <span>Account</span>
        </Link>
      </header>
      <aside className="workspace-sidebar">
        <nav aria-label="Main navigation">
          {navigation.map(({ href, label, Icon, active }) => (
            <Link key={href} href={href} prefetch={false} className={active ? "active" : ""} aria-current={active ? "page" : undefined}>
              <Icon size={28} weight="regular" aria-hidden="true" />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
      </aside>
      {children}
    </div>
  );
}
