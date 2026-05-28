"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Menu, X, Anchor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useAuth } from "../../contexts/AuthContext";
import { useSocket } from "../../contexts/SocketContext";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";
import { HeaderUserMenu } from "./_components/HeaderUserMenu";
import { HeaderMobileMenu } from "./_components/HeaderMobileMenu";

function readDemoMode(): boolean {
  return (
    typeof window !== "undefined" &&
    localStorage.getItem("helmwise_demo_mode") === "true"
  );
}

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { user, signOut } = useAuth();
  const { connected, agentStatuses } = useSocket();
  const pathname = usePathname();
  // Demo mode lives in localStorage; read it during render so it always
  // reflects the latest value (usePathname re-renders this on navigation).
  const isDemoMode = readDemoMode();

  useEffect(() => {
    // `mounted` must start false to match the server render and only flip true
    // after hydration — this gates theme-dependent UI to avoid a hydration
    // mismatch, so it cannot be initialized to true.
    // oxlint-disable-next-line react-doctor/no-initialize-state
    setMounted(true);

    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const isAuthenticated = user || isDemoMode;
  const isLandingPage = pathname === "/";

  const navigation = [
    { name: "Dashboard", href: "/dashboard", requireAuth: true },
    { name: "Plan Passage", href: "/planner", requireAuth: true },
    { name: "My Passages", href: "/passages", requireAuth: true },
    // Public community + tools — keep visible to logged-out visitors so they
    // discover the platform value before signup.
    { name: "Anchorages", href: "/anchorages", requireAuth: false },
    { name: "Anchor Watch", href: "/anchor", requireAuth: false },
    { name: "Provisioning", href: "/provisioning", requireAuth: false },
    { name: "Pricing", href: "/pricing", requireAuth: false },
  ];

  const landingAnchors = [
    { name: "Capabilities", href: "#capabilities" },
    { name: "Process", href: "#process" },
    { name: "Pricing", href: "#pricing" },
  ];

  const desktopNavItems =
    isLandingPage && !isAuthenticated
      ? landingAnchors
      : navigation.filter((item) => !item.requireAuth || isAuthenticated);

  const activeAgents = Object.keys(agentStatuses).length;
  const displayName = user?.email?.split("@")[0] || (isDemoMode ? "Demo" : "");

  const handleSignOut = () => {
    if (isDemoMode) {
      localStorage.removeItem("helmwise_demo_mode");
      window.location.href = "/login";
    } else {
      signOut();
    }
  };

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full transition-all duration-300",
        isLandingPage
          ? scrolled
            ? "border-b border-white/[0.06]"
            : ""
          : scrolled
            ? "glass-heavy shadow-maritime"
            : "bg-background/80 backdrop-blur-sm",
      )}
      style={
        isLandingPage
          ? {
              background: scrolled
                ? "rgba(5, 8, 15, 0.92)"
                : "rgba(5, 8, 15, 0.0)",
              backdropFilter: scrolled ? "blur(20px)" : "none",
              WebkitBackdropFilter: scrolled ? "blur(20px)" : "none",
            }
          : undefined
      }
    >
      <nav
        data-testid="header-nav"
        className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 lg:px-8"
      >
        {/* Logo */}
        <div className="flex items-center gap-8">
          <Link
            href="/"
            data-testid="header-logo"
            className="flex items-center gap-2.5 group"
          >
            <div className="relative">
              <div
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center transition-shadow",
                  isLandingPage
                    ? "bg-white/[0.08] border border-white/[0.12]"
                    : "bg-gradient-to-br from-primary to-ocean-deep shadow-maritime group-hover:shadow-maritime-lg",
                )}
              >
                <Anchor
                  className={cn(
                    "h-5 w-5",
                    isLandingPage ? "text-seafoam" : "text-primary-foreground",
                  )}
                />
              </div>
              {isAuthenticated && connected && (
                <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-success rounded-full border-2 border-background" />
              )}
            </div>
            <span
              className={cn(
                "font-display text-xl font-bold tracking-tight",
                isLandingPage ? "text-white" : "",
              )}
            >
              Helmwise
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex lg:items-center lg:gap-1">
            {desktopNavItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                  isLandingPage
                    ? pathname === item.href
                      ? "text-seafoam bg-white/[0.06]"
                      : "text-white/60 hover:text-white/90 hover:bg-white/[0.05]"
                    : pathname === item.href
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                )}
              >
                {item.name}
              </Link>
            ))}
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {/* Demo Mode Indicator */}
          {isDemoMode && (
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-brass-100 dark:bg-brass-900/30 text-brass-700 dark:text-brass-400 text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-brass-500" />
              <span>Demo Mode</span>
            </div>
          )}

          {/* Agent Status Indicator */}
          {isAuthenticated && activeAgents > 0 && (
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/10 text-success text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              <span>{activeAgents} agents active</span>
            </div>
          )}

          {/* Theme Toggle - hidden on landing page */}
          {mounted && !isLandingPage && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="h-9 w-9 rounded-lg"
              title={
                resolvedTheme === "dark"
                  ? "Switch to light mode"
                  : "Switch to dark mode"
              }
            >
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Toggle theme</span>
            </Button>
          )}

          {isAuthenticated ? (
            <HeaderUserMenu
              displayName={displayName}
              isDemoMode={isDemoMode}
              userEmail={user?.email}
              onSignOut={handleSignOut}
            />
          ) : (
            <div className="hidden lg:flex items-center gap-2">
              <Link href="/login">
                <Button
                  variant="ghost"
                  className={cn(
                    "h-9 px-4 text-sm",
                    isLandingPage &&
                      "text-white/70 hover:text-white hover:bg-white/[0.06]",
                  )}
                >
                  Log In
                </Button>
              </Link>
              <Link href="/signup">
                {isLandingPage ? (
                  <span className="btn-seafoam h-9 px-5 text-xs">
                    Start Free Trial
                  </span>
                ) : (
                  <Button className="btn-primary h-9 px-4 text-sm">
                    Start Free Trial
                  </Button>
                )}
              </Link>
            </div>
          )}

          {/* Mobile menu button */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden h-10 w-10"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-menu"
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>
        </div>
      </nav>

      {/* Mobile menu */}
      <HeaderMobileMenu
        open={mobileMenuOpen}
        navigation={navigation}
        isAuthenticated={!!isAuthenticated}
        isDemoMode={isDemoMode}
        pathname={pathname}
        mounted={mounted}
        resolvedTheme={resolvedTheme}
        onToggleTheme={toggleTheme}
        onSignOut={handleSignOut}
        onClose={() => setMobileMenuOpen(false)}
      />
    </header>
  );
}
