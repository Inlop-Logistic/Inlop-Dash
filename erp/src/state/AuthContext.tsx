import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/types/auth";

// Re-export para compatibilidad: los módulos pueden importar Profile
// desde aquí o directamente desde @/types/auth.
export type { Profile } from "@/types/auth";

interface AuthState {
  user:    User | null;
  profile: Profile | null;
  loading: boolean;
  signIn:  (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

// ── Jerarquía de resolución de identidad ─────────────────────────────────────
// Centralizada aquí para que ningún componente necesite implementar fallbacks.
//
// Prioridad de nombre:
//   1. profiles.nombre         (fuente canónica en Supabase)
//   2. user_metadata.nombre    (si el proveedor lo inyecta al crear el usuario)
//   3. user_metadata.full_name (campo estándar de proveedores OAuth)
//   4. Nombre derivado del email (carlos.mendez@ → "Carlos Mendez")
//   5. "Usuario"               (último recurso, nunca "Sin nombre")

function deriveNameFromEmail(email: string): string {
  const local = email.split("@")[0];
  return local
    .replace(/[._+-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function resolveNombre(
  dbNombre:     string | null | undefined,
  metadata:     Record<string, unknown> | undefined,
  email:        string | null | undefined,
): string {
  if (dbNombre?.trim())                        return dbNombre.trim();
  if (typeof metadata?.nombre === "string" && metadata.nombre.trim())
                                               return (metadata.nombre as string).trim();
  if (typeof metadata?.full_name === "string" && metadata.full_name.trim())
                                               return (metadata.full_name as string).trim();
  if (email?.trim())                           return deriveNameFromEmail(email.trim());
  return "Usuario";
}

// ── Contexto ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(authUser: User) {
    const { data } = await supabase
      .from("profiles")
      .select("id, nombre, cargo, rol, email")
      .eq("id", authUser.id)
      .single();

    const metadata = authUser.user_metadata as Record<string, unknown> | undefined;
    const email    = authUser.email ?? data?.email ?? "";

    setProfile({
      id:     authUser.id,
      nombre: resolveNombre(data?.nombre, metadata, email),
      cargo:  data?.cargo  ?? (metadata?.cargo  as string | undefined) ?? "",
      rol:    data?.rol    ?? (metadata?.rol    as string | undefined) ?? "",
      email,
    });
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) loadProfile(session.user);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      if (session?.user) loadProfile(session.user);
      else { setProfile(null); setLoading(false); }
    });

    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // setLoading(false) debe ocurrir después de que loadProfile resuelva
  useEffect(() => {
    if (profile !== null || user === null) setLoading(false);
  }, [profile, user]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
