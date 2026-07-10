const API_URL = import.meta.env.VITE_API_URL as string;
const INTERNAL_API_KEY = import.meta.env.VITE_INTERNAL_API_KEY as string | undefined;

export async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(INTERNAL_API_KEY ? { "X-Internal-Api-Key": INTERNAL_API_KEY } : {}),
      ...opts?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}
