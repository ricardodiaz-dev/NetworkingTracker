"use client";

import { useCallback, useEffect, useState } from "react";

import { neon } from "@/lib/neon/browser";

export type SessionState =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "signed-in"; email: string };

export function useSession() {
  const [session, setSession] = useState<SessionState>({ status: "loading" });

  const refresh = useCallback(async () => {
    try {
      const { data } = await neon.auth.getSession();

      setSession(
        data?.session
          ? { status: "signed-in", email: data.user?.email ?? "Signed in" }
          : { status: "signed-out" },
      );
    } catch {
      setSession({ status: "signed-out" });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    await neon.auth.signOut();
    setSession({ status: "signed-out" });
  }, []);

  return { session, refresh, signOut };
}
