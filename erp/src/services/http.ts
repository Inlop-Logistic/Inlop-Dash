import { supabase } from "@/services/supabase";

const API_URL = import.meta.env.VITE_API_URL as string;
const INTERNAL_API_KEY = import.meta.env.VITE_INTERNAL_API_KEY as string | undefined;

// ── Obtener JWT de Supabase para autenticación verificable ──────────────────
// El JWT permite al backend verificar la identidad del usuario sin depender
// de headers auto-declarados (X-User-Email). Durante la transición, si no hay
// JWT disponible, se envía INTERNAL_API_KEY como fallback.
async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    // JWT de Supabase — identidad verificable, prioridad sobre API key.
    return { "Authorization": `Bearer ${session.access_token}` };
  }
  // Fallback: API key compartida (backward-compat durante la transición).
  if (INTERNAL_API_KEY) {
    return { "X-Internal-Api-Key": INTERNAL_API_KEY };
  }
  return {};
}

export async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  const authHeaders = await getAuthHeaders();
  const res = await fetch(`${API_URL}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
      ...opts?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

// ── getAuthHeadersSync — para fetchBinario (cumplidos) ──────────────────────
// fetchBinario necesita headers de auth pero no puede ser async en su actual
// estructura de llamada. Exportamos una función que devuelve la Promise
// directamente para que el caller la await-ee.
export { getAuthHeaders };
