/** Deriva la línea de negocio a partir del campo type_operation del TMS. */
export function lineaNegocio(raw: string | null | undefined): string {
  if (!raw) return "Carga Seca";
  return raw.trim().toLowerCase() === "granel liquido" ? "Carga Líquida" : "Carga Seca";
}
