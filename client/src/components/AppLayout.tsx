/**
 * AppLayout — Global layout with navigation header
 * Swiss Precision: Minimal top bar with horizontal divider, section numbers
 */

import { Link, useLocation } from "wouter";
import { Presentation, Clock, Plus } from "lucide-react";
import type { ReactNode } from "react";

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Создать", icon: Plus, section: "01" },
    { href: "/history", label: "История", icon: Clock, section: "02" },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navigation header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm">
        <div className="container flex items-center justify-between h-14">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-8 h-8 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
              <Presentation className="w-4 h-4 text-primary" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-tight leading-none" style={{ fontFamily: "var(--font-heading)" }}>
                AI Slides
              </span>
              <span className="text-[10px] text-muted-foreground font-mono leading-none mt-0.5">
                generator v1.0
              </span>
            </div>
          </Link>

          {/* Navigation */}
          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const isActive =
                item.href === "/"
                  ? location === "/"
                  : location.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors
                    ${
                      isActive
                        ? "text-foreground bg-secondary"
                        : "text-muted-foreground hover:text-foreground"
                    }
                  `}
                >
                  <span className="font-mono text-[10px] text-primary/60">
                    {item.section}
                  </span>
                  <item.icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Swiss divider */}
        <div className="swiss-divider" />
      </header>

      {/* Main content */}
      <main className="flex-1">{children}</main>
    </div>
  );
}
