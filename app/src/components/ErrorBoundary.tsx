import { Component, type ReactNode } from "react";

/** FE-06: catches render-time throws so a bug shows a friendly message instead of a white screen. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("UI error boundary caught:", error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto max-w-md px-4 py-20 text-center">
          <div className="text-4xl">🧊</div>
          <h1 className="mt-3 text-xl font-bold">Something broke on our end</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            An unexpected error occurred while rendering this page. Reloading usually fixes it.
          </p>
          <button
            onClick={() => window.location.assign("/")}
            className="mt-5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Back to campaigns
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
