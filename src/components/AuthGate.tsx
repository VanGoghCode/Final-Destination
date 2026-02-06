"use client";

import { useAuth } from "@/context/AuthContext";
import { ReactNode } from "react";

export default function AuthGate({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  // Show nothing until auth check is complete
  if (isLoading) {
    return null;
  }

  // Only render children when authenticated
  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
