import { useEffect, type ReactNode } from "react";
import {
  Outlet,
  createRootRoute,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/lib/auth";

export const Route = createRootRoute({ component: RootLayout });

function RootLayout() {
  return (
    <AuthProvider>
      <AppShell>
        <AuthGate>
          <Outlet />
        </AuthGate>
      </AppShell>
      <Toaster position="top-center" />
    </AuthProvider>
  );
}

// Solo-account guard: bounces to /login when signed out. Client-only (no
// SSR), so the session check is async — render nothing until it resolves
// rather than flash protected content.
function AuthGate({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const onLoginPage = pathname.endsWith("/login");

  useEffect(() => {
    if (!loading && !session && !onLoginPage) {
      navigate({ to: "/login", replace: true });
    }
  }, [loading, session, onLoginPage, navigate]);

  if (loading) return null;
  if (!session && !onLoginPage) return null;
  return <>{children}</>;
}
