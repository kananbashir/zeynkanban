"use client";

import { createContext, useContext, type ReactNode } from "react";

/** The person logged in, for things the browser draws before the server answers (e.g. a note being sent). */
const MeContext = createContext<{ id: string; name: string } | null>(null);

export function MeProvider({ me, children }: { me: { id: string; name: string }; children: ReactNode }) {
  return <MeContext.Provider value={me}>{children}</MeContext.Provider>;
}

export const useMe = () => useContext(MeContext);
