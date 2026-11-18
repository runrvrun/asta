"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";

export default function Home() {
  const router = useRouter();
  const hydrated = useStore((s) => s.hydrated);
  const session = useStore((s) => s.sessionUserId);
  useEffect(() => {
    if (hydrated) router.replace(session ? "/dashboard" : "/login");
  }, [hydrated, session, router]);
  return <div className="loader-screen"><div className="spinner" />Memuat Asta…</div>;
}
