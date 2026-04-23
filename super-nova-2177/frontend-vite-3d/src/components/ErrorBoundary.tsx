import React, { ReactNode } from "react";

type Props = {
  children: ReactNode;
  /**
   * Optional React fallback to render when an error is caught.
   * If not provided, a minimal inline alert is shown.
   */
  fallback?: ReactNode;
};

type State = {
  hasError: boolean;
  error?: Error;
  info?: React.ErrorInfo;
};

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(err: unknown): State {
    // Always convert unknown to Error to keep render() types safe
    const error = err instanceof Error ? err : new Error(String(err));
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    // Log with best-effort typing; don’t throw from here
    // eslint-disable-next-line no-console
    console.error("ErrorBoundary caught:", error, info);
    this.setState({ info });
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      const message =
        this.state.error?.message ?? "An unexpected error occurred.";

      return this.state.error ? (
        <div
          role="alert"
          aria-live="assertive"
          style={{
            position: "fixed",
            inset: "16px",
            zIndex: 99999,
            padding: "12px",
            borderRadius: "8px",
            background: "rgba(0,0,0,0.85)",
            color: "#fff",
            font:
              "14px/1.4 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif",
          }}
        >
          {message}
        </div>
      ) : null;
    }

    return this.props.children;
  }
}

