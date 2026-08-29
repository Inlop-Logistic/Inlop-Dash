import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase, onRecoveryDetectada, resetRecoveryDetectada } from "@/services/supabase";
import type { Profile } from "@/types/auth";

// Re-export para compatibilidad: los módulos pueden importar Profile
// desde aquí o directamente desde @/types/auth.
export type { Profile } from "@/types/auth";

interface AuthState {
  user:    User | null;
  profile: Profile | null;
  loading: boolean;
  // true mientras la sesión activa es de recuperación de contraseña
  // (Supabase emite PASSWORD_RECOVERY al detectar el enlace de /invite o
  // /recover en la URL — Sprint 3D-7.8D). Un usuario en este estado NUNCA
  // debe entrar al dashboard normal: App.tsx debe mostrar el formulario de
  // nueva contraseña mientras esto sea true, con prioridad sobre `user`.
  recoveryMode: boolean;
  signIn:  (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Llamar tras `supabase.auth.updateUser({ password })` exitoso — cierra
   *  la sesión temporal de recuperación y vuelve al login normal. */
  completarRecovery: () => Promise<void>;
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
  const [recoveryMode, setRecoveryMode] = useState(false);

  async function loadProfile(authUser: User) {
    const { data } = await supabase
      .from("profiles")
      .select("id, nombre, rol, email")
      .eq("id", authUser.id)
      .single();

    const metadata = authUser.user_metadata as Record<string, unknown> | undefined;
    const email    = authUser.email ?? data?.email ?? "";

    setProfile({
      id:     authUser.id,
      nombre: resolveNombre(data?.nombre, metadata, email),
      // profiles.cargo no existe en la tabla — se mantiene el campo en el tipo
      // para compatibilidad con componentes, pero queda vacío. El UI ya usa
      // profile.rol como fallback (TopbarUserMenu.tsx:135).
      cargo:  "",
      rol:    data?.rol    ?? (metadata?.rol    as string | undefined) ?? "",
      email,
    });
    // Nota: X-User-Email ya no se envía al backend — la identidad se verifica
    // desde el JWT de Supabase directamente (Sprint 2A).
  }

  useEffect(() => {
    // PASSWORD_RECOVERY (Sprint 3D-7.8D, corregido en 3D-7.8F) — Supabase la
    // emite al detectar en la URL el enlace de /invite (usuario nuevo) o
    // /recover (reset password administrado) de GoTrue. Puede dispararse
    // muy pronto, durante la inicialización interna del cliente (creación
    // en services/supabase.ts) — antes de que este efecto llegue a
    // registrar un listener propio (auditoría 3D-7.8E: el evento se perdía
    // por esa carrera y el usuario entraba directo al dashboard). Por eso
    // se consulta onRecoveryDetectada(), que ya viene observando el evento
    // desde el mismo tick en que se creó el cliente y avisa de inmediato si
    // ya ocurrió, sin importar cuándo se suscriba este efecto.
    const unsubRecovery = onRecoveryDetectada(() => {
      setRecoveryMode(true);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) loadProfile(session.user);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) loadProfile(session.user);
      else { setProfile(null); setLoading(false); }
    });

    return () => { subscription.unsubscribe(); unsubRecovery(); };
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

  // Cierra la sesión temporal de recuperación tras establecer la nueva
  // contraseña exitosamente (Sprint 3D-7.8D) — vuelve al login normal, para
  // que el usuario entre con su contraseña recién creada, no arrastrando la
  // sesión de recovery.
  const completarRecovery = async () => {
    await supabase.auth.signOut();
    resetRecoveryDetectada(); // Sprint 3D-7.8F — permite detectar una futura recuperación en la misma pestaña.
    setRecoveryMode(false);
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, recoveryMode, signIn, signOut, completarRecovery }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
