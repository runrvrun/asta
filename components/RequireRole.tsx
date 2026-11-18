"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { useCurrentUser } from "@/lib/store";
import type { Role } from "@/lib/types";
import { EmptyState } from "./ui";

/** Shows an "access denied" panel instead of children when the user's role isn't allowed. */
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const user = useCurrentUser();
  if (!user || !roles.includes(user.role)) {
    return (
      <div className="panel">
        <EmptyState icon="lock" title="Akses ditolak">
          Peran Anda tidak memiliki akses ke halaman ini. <Link className="link" href="/dashboard">Kembali ke dashboard</Link>
        </EmptyState>
      </div>
    );
  }
  return <>{children}</>;
}
