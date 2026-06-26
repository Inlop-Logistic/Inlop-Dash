// Tipos de identidad compartidos entre AuthContext, AppShell y módulos futuros.

export interface Profile {
  id:     string;
  nombre: string;   // garantizado: nunca vacío (ver resolveNombre en AuthContext)
  cargo:  string;
  rol:    string;
  email:  string;
}
