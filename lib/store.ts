"use client";
// Client-side "database". The whole DB is one object persisted to localStorage.
// Modules change data only through `mutate`, which also records an audit entry.
import { useEffect } from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { AuditEntry, DB, Notification, User } from "./types";
import { createSeed, DB_VERSION } from "./seed";

export interface AuditInput {
  action: string;
  module: string;
  ref?: string;
  detail?: string;
}

interface StoreState {
  db: DB;
  sessionUserId: string | null;
  hydrated: boolean;
  /** Apply a change to a copy of the DB. Pass `audit` to log it under the current user. */
  mutate: (fn: (db: DB) => void, audit?: AuditInput) => void;
  login: (username: string, password: string) => User | null;
  logout: () => void;
  resetDemo: () => void;
  notify: (n: Omit<Notification, "id" | "at" | "read">) => void;
}

export function uid(prefix = "id") {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      db: createSeed(),
      sessionUserId: null,
      hydrated: false,

      mutate: (fn, audit) => {
        const db = structuredClone(get().db);
        fn(db);
        if (audit) {
          const entry: AuditEntry = { id: uid("aud"), at: new Date().toISOString(), userId: get().sessionUserId ?? "system", ...audit };
          db.audit.unshift(entry);
          if (db.audit.length > 1000) db.audit.length = 1000;
        }
        set({ db });
      },

      login: (username, password) => {
        const user = get().db.users.find((u) => u.username.toLowerCase() === username.trim().toLowerCase());
        if (!user || user.password !== password || !user.active) return null;
        set({ sessionUserId: user.id });
        get().mutate(
          (db) => {
            const u = db.users.find((x) => x.id === user.id);
            if (u) u.lastLogin = new Date().toISOString();
          },
          { action: "Login", module: "Sistem" },
        );
        return user;
      },

      logout: () => {
        get().mutate(() => {}, { action: "Logout", module: "Sistem" });
        set({ sessionUserId: null });
      },

      resetDemo: () => {
        const keepUser = get().sessionUserId;
        set({ db: createSeed() });
        get().mutate(() => {}, { action: "Reset data demo", module: "Sistem" });
        set({ sessionUserId: keepUser });
      },

      notify: (n) => {
        get().mutate((db) => {
          db.notifications.unshift({ ...n, id: uid("ntf"), at: new Date().toISOString(), read: [] });
        });
      },
    }),
    {
      name: "asta-db",
      version: DB_VERSION,
      storage: createJSONStorage(() => {
        if (typeof window === "undefined") throw new Error("no storage on server");
        return window.localStorage;
      }),
      // Rehydrated manually after mount (see StoreHydrator) so the first client render matches the static HTML.
      skipHydration: true,
      partialize: (s) => ({ db: s.db, sessionUserId: s.sessionUserId }),
      // An incompatible stored version is simply replaced with fresh seed data.
      migrate: () => ({ db: createSeed(), sessionUserId: null }) as unknown as StoreState,
      onRehydrateStorage: () => () => {
        useStore.setState({ hydrated: true });
      },
    },
  ),
);

/** The whole DB (re-renders on any change). */
export function useDB() {
  return useStore((s) => s.db);
}

export function useCurrentUser(): User | null {
  return useStore((s) => (s.sessionUserId ? s.db.users.find((u) => u.id === s.sessionUserId) ?? null : null));
}

export function useMutate() {
  return useStore((s) => s.mutate);
}

/** Mount once (root layout): loads the persisted DB from localStorage after hydration. */
export function StoreHydrator() {
  useEffect(() => {
    void useStore.persist.rehydrate();
  }, []);
  return null;
}
