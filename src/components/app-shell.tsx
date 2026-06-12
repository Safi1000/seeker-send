import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Upload,
  ListChecks,
  ShieldAlert,
  Activity,
  Settings,
  Moon,
  Sun,
  Boxes,
} from "lucide-react";
import type { ReactNode } from "react";
import { useTheme } from "./theme-provider";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/upload", label: "Upload RFQ", icon: Upload },
  { to: "/verification", label: "Verification Queue", icon: ShieldAlert },
  { to: "/progress", label: "Search Progress", icon: Activity },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { theme, toggle } = useTheme();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-border bg-sidebar text-sidebar-foreground md:flex md:flex-col">
          <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Boxes className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold">Procura AI</div>
              <div className="text-xs text-muted-foreground">Procurement Assistant</div>
            </div>
          </div>
          <nav className="flex-1 space-y-1 px-3 py-4">
            {nav.map((n) => {
              const active = n.to === "/" ? pathname === "/" : pathname.startsWith(n.to);
              const Icon = n.icon;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-sidebar-border p-4 text-xs text-muted-foreground">
            <div className="font-medium text-sidebar-foreground">Operations Team</div>
            <div>buyer@acme.com</div>
          </div>
        </aside>

        <main className="flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur">
            <div className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-muted-foreground md:hidden" />
              <span className="text-sm font-medium text-muted-foreground">
                {nav.find((n) => (n.to === "/" ? pathname === "/" : pathname.startsWith(n.to)))?.label ?? "Procura AI"}
              </span>
            </div>
            <button
              onClick={toggle}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-foreground hover:bg-accent"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </header>
          <div className="flex-1 p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}