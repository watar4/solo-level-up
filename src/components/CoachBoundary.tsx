import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}
interface State {
  failed: boolean;
}

// Isolates the AI coach from the rest of the dashboard. If anything in the
// coach subtree throws during render, this catches it and renders the fallback
// (nothing, by default) instead of letting the error unmount the whole app —
// which is what made the coach "disappear" together with the screen.
export class CoachBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error('[coach] render error, hiding coach', error);
  }

  render() {
    if (this.state.failed) return this.props.fallback ?? null;
    return this.props.children;
  }
}
