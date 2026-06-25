import { LogOut } from "lucide-react";
import { Button } from "./ui/button";
import { useGoogleAuth } from "../lib/auth";
import { shortAddr } from "../lib/format";

export function Header() {
  const { account, signIn, signOut, canSignIn, isPending } = useGoogleAuth();

  return (
    <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2 font-semibold">
          <span className="text-xl">🧊</span>
          <span>Yeti Wells</span>
        </div>
        {account ? (
          <div className="flex items-center gap-3">
            <span className="rounded-md bg-secondary px-2.5 py-1 font-mono text-xs text-secondary-foreground">
              {shortAddr(account.address)}
            </span>
            <Button variant="ghost" size="sm" onClick={signOut} title="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button onClick={signIn} loading={isPending} disabled={!canSignIn}>
            Sign in with Google
          </Button>
        )}
      </div>
    </header>
  );
}
