"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { useCurrentUser, useStore } from "@/lib/store";

/** Every page under (app) requires a signed-in user. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const hydrated = useStore((s) => s.hydrated);
  const user = useCurrentUser();
  useEffect(() => {
    if (hydrated && !user) router.replace("/login");
  }, [hydrated, user, router]);
  if (!hydrated || !user) return <div className="loader-screen"><div className="spinner" />Memuat…</div>;
  return <AppShell>{children}</AppShell>;
}
