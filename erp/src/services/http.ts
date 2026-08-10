const API_URL = import.meta.env.VITE_API_URL as string;
const INTERNAL_API_KEY = import.meta.env.VITE_INTERNAL_API_KEY as string | undefined;

// Email del usuario autenticado — actualizado por AuthContext en cada cambio de sesión.
// Permite que req() incluya X-User-Email en cada mutación sin necesidad de
// React context (mismo patrón que INTERNAL_API_KEY arriba).
let _currentUserEmail: string | undefined;

/** Llamar desde AuthContext al resolver el perfil y al cerrar sesión. */
export function setCurrentUserEmail(email: string | undefined): void {
  _currentUserEmail = email;
}

export async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(INTERNAL_API_KEY   ? { "X-Internal-Api-Key": INTERNAL_API_KEY }  : {}),
      ...(_currentUserEmail  ? { "X-User-Email": _currentUserEmail }        : {}),
      ...opts?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}
