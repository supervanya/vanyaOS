import { Outlet, createRootRoute } from "@tanstack/react-router";

import { Toaster } from "@/components/ui/sonner";

export const Route = createRootRoute({ component: RootLayout });

function RootLayout() {
  return (
    <>
      <Outlet />
      <Toaster position="top-center" />
    </>
  );
}
