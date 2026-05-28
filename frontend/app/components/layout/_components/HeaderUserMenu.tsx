"use client";

import Link from "next/link";
import { ChevronDown, Settings, CreditCard, LogOut } from "lucide-react";
import { cn } from "../../../lib/utils";

interface HeaderUserMenuProps {
  displayName: string;
  isDemoMode: boolean;
  userEmail?: string;
  onSignOut: () => void;
}

export function HeaderUserMenu({
  displayName,
  isDemoMode,
  userEmail,
  onSignOut,
}: HeaderUserMenuProps) {
  return (
    <div
      data-testid="header-user-menu"
      className="relative group hidden lg:block"
    >
      <button
        type="button"
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors"
      >
        <div
          className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center text-xs text-white font-semibold",
            isDemoMode
              ? "bg-gradient-to-br from-brass-400 to-brass-600"
              : "bg-gradient-to-br from-ocean-300 to-ocean-600",
          )}
        >
          {displayName.charAt(0).toUpperCase()}
        </div>
        <span className="text-sm font-medium max-w-[100px] truncate">
          {displayName}
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </button>

      {/* Dropdown */}
      <div className="absolute right-0 mt-2 w-56 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform origin-top-right translate-y-1 group-hover:translate-y-0">
        <div className="card p-2 shadow-maritime-lg">
          <div className="px-3 py-2 mb-1">
            <p className="text-sm font-medium">{displayName}</p>
            <p className="text-xs text-muted-foreground truncate">
              {isDemoMode ? "Demo Account" : userEmail}
            </p>
          </div>
          <hr className="my-1 border-border" />
          {!isDemoMode && (
            <>
              <Link
                href="/account"
                className="flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-muted/50 transition-colors"
              >
                <Settings className="h-4 w-4 text-muted-foreground" />
                <span>Account</span>
              </Link>
              <Link
                href="/billing"
                className="flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-muted/50 transition-colors"
              >
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <span>Billing</span>
              </Link>
              <hr className="my-1 border-border" />
            </>
          )}
          <button
            type="button"
            onClick={onSignOut}
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-destructive/10 text-destructive w-full text-left transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span>{isDemoMode ? "Exit Demo" : "Sign Out"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
