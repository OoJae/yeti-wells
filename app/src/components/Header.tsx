import { LogOut, Plus } from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import { Button } from "./ui/button";
import { useGoogleAuth } from "../lib/auth";
import { shortAddr } from "../lib/format";
import { cn } from "../lib/utils";

function navClass({ isActive }: { isActive: boolean }) {
  return cn(
    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
    isActive ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
  );
}

export function Header() {
  const { account, signIn, signOut, canSignIn, isPending } = useGoogleAuth();

  return (
    <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Link to="/" className="flex shrink-0 items-center gap-2 font-semibold">
          <span className="text-xl">🧊</span>
          <span className="hidden sm:inline">Yeti Wells</span>
        </Link>

        <nav className="flex items-center gap-1">
          <NavLink to="/" end className={navClass}>
            Browse
          </NavLink>
          <NavLink to="/create" className={navClass}>
            <span className="inline-flex items-center gap-1">
              <Plus className="h-3.5 w-3.5" /> Start a campaign
            </span>
          </NavLink>
          {account && (
            <NavLink to="/me" className={navClass}>
              My Impact
            </NavLink>
          )}
        </nav>

        {account ? (
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden rounded-md bg-secondary px-2.5 py-1 font-mono text-xs text-secondary-foreground sm:inline">
              {shortAddr(account.address)}
            </span>
            <Button variant="ghost" size="sm" onClick={signOut} title="Sign out" aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button onClick={signIn} loading={isPending} disabled={!canSignIn} size="sm">
            Sign in with Google
          </Button>
        )}
      </div>
    </header>
  );
}
