/**
 * AppLayout — Global layout with minimal navigation header
 * Clean Light Design: subtle top bar, no section numbers
 */

import { Link, useLocation } from "wouter";
import { Presentation, MessageSquare, BarChart3 } from "lucide-react";
import type { ReactNode } from "react";

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [location] = useLocation();

  const navItems = [
    { href: "/chat", label: "Чат", icon: MessageSquare },
    { href: "/analytics", label: "Аналитика", icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Navigation header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="container flex items-center justify-between h-12">
          {/* Logo */}
          <Link href="/chat" className="flex items-center gap-2.5 group">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center group-hover:bg-primary/90 transition-colors">
              <Presentation className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <span className="text-sm font-semibold tracking-tight text-foreground">
              AI Slides
            </span>
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
                    flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors
                    ${
                      isActive
                        ? "text-foreground bg-secondary font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                    }
                  `}
                >
                  <item.icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1">{children}</main>
    </div>
  );
}
