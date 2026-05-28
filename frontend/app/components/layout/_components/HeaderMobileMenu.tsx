"use client";

import Link from "next/link";
import { Sun, Moon } from "lucide-react";
import { Button } from "../../ui/button";
import { cn } from "../../../lib/utils";

interface NavItem {
  name: string;
  href: string;
  requireAuth: boolean;
}

interface HeaderMobileMenuProps {
  open: boolean;
  navigation: NavItem[];
  isAuthenticated: boolean;
  isDemoMode: boolean;
  pathname: string;
  mounted: boolean;
  resolvedTheme?: string;
  onToggleTheme: () => void;
  onSignOut: () => void;
  onClose: () => void;
}

export function HeaderMobileMenu({
  open,
  navigation,
  isAuthenticated,
  isDemoMode,
  pathname,
  mounted,
  resolvedTheme,
  onToggleTheme,
  onSignOut,
  onClose,
}: HeaderMobileMenuProps) {
  return (
    <div
      id="mobile-menu"
      className={cn(
        "lg:hidden overflow-hidden transition-all duration-300",
        open ? "max-h-screen" : "max-h-0",
      )}
    >
      <div className="glass-heavy border-t border-border px-4 py-6 space-y-4">
        {/* Demo Mode Banner Mobile */}
        {isDemoMode && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brass-100 dark:bg-brass-900/30 text-brass-700 dark:text-brass-400 text-sm">
            <span className="w-2 h-2 rounded-full bg-brass-500" />
            <span>Demo Mode Active</span>
          </div>
        )}

        {navigation.flatMap((item) =>
          !item.requireAuth || isAuthenticated
            ? [
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "block px-4 py-3 rounded-lg text-base font-medium transition-colors",
                    pathname === item.href
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                  )}
                  onClick={onClose}
                >
                  {item.name}
                </Link>,
              ]
            : [],
        )}

        <hr className="border-border" />

        {/* Theme toggle mobile */}
        {mounted && (
          <button
            type="button"
            onClick={onToggleTheme}
            className="flex items-center justify-between w-full px-4 py-3 rounded-lg text-base font-medium hover:bg-muted/50 transition-colors"
          >
            <span>{resolvedTheme === "dark" ? "Light Mode" : "Dark Mode"}</span>
            {resolvedTheme === "dark" ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </button>
        )}

        {isAuthenticated ? (
          <>
            {!isDemoMode && (
              <Link
                href="/account"
                className="block px-4 py-3 rounded-lg text-base font-medium hover:bg-muted/50 transition-colors"
                onClick={onClose}
              >
                Account
              </Link>
            )}
            <button
              type="button"
              onClick={() => {
                onSignOut();
                onClose();
              }}
              className="block w-full text-left px-4 py-3 rounded-lg text-base font-medium text-destructive hover:bg-destructive/10 transition-colors"
            >
              {isDemoMode ? "Exit Demo" : "Sign Out"}
            </button>
          </>
        ) : (
          <div className="space-y-3 pt-2">
            <Link href="/login" onClick={onClose}>
              <Button variant="outline" className="w-full h-12">
                Log In
              </Button>
            </Link>
            <Link href="/signup" onClick={onClose}>
              <Button className="btn-primary w-full h-12">
                Start Free Trial
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
