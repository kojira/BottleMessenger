import { Link, useLocation } from "wouter";
import { SiSky } from "react-icons/si";
import { CircleIcon, Link2Icon } from "lucide-react";
import { cn } from "@/lib/utils";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navigation = [
    { name: "Dashboard", href: "/" },
    { name: "Settings", href: "/settings" },
    { name: "Messages", href: "/messages" },
  ];

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <div className="w-64 bg-sidebar border-r border-sidebar-border">
        <div className="h-16 flex items-center px-4 border-b border-sidebar-border">
          <div className="flex items-center space-x-2">
            <Link2Icon className="h-6 w-6 text-sidebar-primary" />
            <SiSky className="h-6 w-6 text-sidebar-primary" />
            <span className="font-semibold text-sidebar-foreground">Relay Bot</span>
          </div>
        </div>
        <nav className="p-4 space-y-1">
          {navigation.map((item) => (
            <Link key={item.name} href={item.href}>
              <a
                className={cn(
                  "block px-4 py-2 rounded-md text-sm font-medium",
                  location === item.href
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}
              >
                {item.name}
              </a>
            </Link>
          ))}
        </nav>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}