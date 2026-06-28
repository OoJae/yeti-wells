import { LogOut, Plus } from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import { Button } from "./ui/button";
import { YetiMark } from "./YetiMark";
import { useGoogleAuth } from "../lib/auth";
import { shortAddr } from "../lib/format";
import { cn } from "../lib/utils";

function navClass({ isActive }: { isActive: boolean }) {
  return cn(
    "rounded-md px-3.5 py-1.5 font-mono text-xs tracking-wide transition-colors",
    isActive ? "border border-sui/30 bg-sui/10 text-foreground" : "text-muted-foreground hover:text-foreground",
  );
}

export function Header() {
  const { account, signIn, signOut, canSignIn, isPending } = useGoogleAuth();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Link to="/" className="flex shrink-0 items-center gap-2.5">
          <YetiMark size={28} />
          <span className="hidden font-mono text-sm font-bold tracking-[0.14em] sm:inline">YETI&nbsp;WELLS</span>
        </Link>

        <nav className="flex items-center gap-1">
          <NavLink to="/campaigns" className={navClass}>
            Campaigns
          </NavLink>
          <NavLink to="/create" className={navClass}>
            <span className="inline-flex items-center gap-1">
              <Plus className="h-3.5 w-3.5" /> Start
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
            <span className="hidden items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 font-mono text-xs text-muted-foreground sm:flex">
              <span className="h-[7px] w-[7px] rounded-full bg-sui shadow-[0_0_8px_var(--color-sui)]" />
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
