// ── Enums / unions ────────────────────────────────────────────────────────────

export type EstadoCliente =
  | "activo"
  | "inactivo"
  | "suspendido"
  | "prospecto";

export type TipoPersona = "natural" | "juridica";

export type TamanoEmpresa = "micro" | "pequena" | "mediana" | "grande";

export type RegimenTributario = "comun" | "simple" | "no_responsable";

export type ClasificacionABC = "A" | "B" | "C";

export type NivelEstrategico = "estrategico" | "clave" | "estandar" | "transaccional";

export type CanalComercial = "directo" | "referido" | "licitacion" | "otro";

export type AreaContacto = "comercial" | "operaciones" | "facturacion" | "gerencia" | "otro";

export type TipoSede = "principal" | "sucursal" | "bodega" | "planta";

export type TipoDocumento =
  | "rut"
  | "camara_comercio"
  | "estados_financieros"
  | "poliza"
  | "certificado_bancario"
  | "otro";

export type EstadoDocumento = "vigente" | "por_vencer" | "vencido" | "pendiente";

export type FormaPago = "credito" | "contado" | "anticipado";

export type FrecuenciaFacturacion = "semanal" | "quincenal" | "mensual" | "por_servicio";

export type TipoAlerta =
  | "documento_por_vencer"
  | "documento_vencido"
  | "cartera_vencida"
  | "sin_tarifas"
  | "sin_contacto_principal"
  | "sin_correo_facturacion"
  | "cliente_suspendido";

export type EtiquetaCliente =
  | "estrategico"
  | "cuenta_clave"
  | "vip"
  | "proyecto_especial"
  | "alto_riesgo"
  | "exclusivo"
  | "prospecto";

// ── Tab IDs del Workspace ─────────────────────────────────────────────────────

export type ClienteWorkspaceTab =
  | "perfil"
  | "relaciones"
  | "contactos"
  | "sedes"
  | "documentos"
  | "condiciones_comerciales"
  | "condiciones_operativas"
  | "tarifas"
  | "solicitudes"
  | "viajes"
  | "facturacion"
  | "cartera"
  | "analitica"
  | "historial";

// ── Listado ───────────────────────────────────────────────────────────────────

/** Objeto devuelto por GET /api/clientes */
export interface ClienteListItem {
  id: string;
  razon_social: string;
  nit: string | null;
  nombre_comercial: string | null;
  activa: boolean;
  estado: EstadoCliente;
  sector_economico: string | null;
  ciudad_principal: string | null;
  ejecutivo_comercial: string | null;
  clasificacion_abc: ClasificacionABC | null;
  nivel_estrategico: NivelEstrategico | null;
  etiquetas: EtiquetaCliente[];
  alertas_count: number;
  created_at: string | null;
  actualizado_en: string | null;
}

/** KPIs calculados del array de clientes */
export interface KpisClientes {
  total: number;
  activos: number;
  inactivos: number;
  suspendidos: number;
  con_alertas: number;
}

// ── Alerta ───────────────────────────────────────────────────────────────────

export interface AlertaCliente {
  tipo: TipoAlerta;
  mensaje: string;
  severidad: "info" | "warning" | "danger";
  fecha?: string | null;
}

// ── Contacto ─────────────────────────────────────────────────────────────────

export interface ContactoComercial {
  id: string;
  empresa_cliente_id: string;
  nombre: string;
  cargo: string | null;
  email: string | null;
  telefono: string | null;
  celular: string | null;
  es_principal: boolean;
  area: AreaContacto | null;
  activo: boolean;
  creado_en: string;
}

// ── Sede ─────────────────────────────────────────────────────────────────────

export interface Sede {
  id: string;
  empresa_cliente_id: string;
  nombre: string;
  tipo: TipoSede;
  direccion: string | null;
  ciudad: string | null;
  departamento: string | null;
  telefono: string | null;
  contacto_nombre: string | null;
  contacto_telefono: string | null;
  latitud: number | null;
  longitud: number | null;
  activa: boolean;
  creado_en: string;
}

// ── Documento ─────────────────────────────────────────────────────────────────

export interface DocumentoCliente {
  id: string;
  empresa_cliente_id: string;
  tipo_documento: TipoDocumento;
  nombre_archivo: string | null;
  url_archivo: string | null;
  fecha_emision: string | null;
  fecha_vencimiento: string | null;
  estado: EstadoDocumento;
  notas: string | null;
  subido_por: string | null;
  creado_en: string;
}

// ── Condiciones ──────────────────────────────────────────────────────────────

export interface CondicionComercial {
  empresa_cliente_id: string;
  plazo_pago_dias: number | null;
  forma_pago: FormaPago | null;
  moneda: string | null;
  descuento_pronto_pago: number | null;
  cupo_credito: number | null;
  requiere_orden_compra: boolean;
  facturacion_electronica: boolean;
  frecuencia_facturacion: FrecuenciaFacturacion | null;
  notas: string | null;
  actualizado_en: string | null;
}

export interface CondicionOperativa {
  empresa_cliente_id: string;
  horario_cargue: string | null;
  horario_descargue: string | null;
  requiere_cita: boolean;
  requiere_epp: boolean;
  requiere_induccion: boolean;
  restricciones_operativas: string | null;
  observaciones_operativas: string | null;
  actualizado_en: string | null;
}

// ── Relaciones Comerciales ────────────────────────────────────────────────────

export interface RelacionComercial {
  empresa_cliente_id: string;
  ejecutivo_comercial: string | null;
  coordinador_operativo: string | null;
  director_comercial: string | null;
  segmento: string | null;
  canal_comercial: CanalComercial | null;
  clasificacion_abc: ClasificacionABC | null;
  nivel_estrategico: NivelEstrategico | null;
  estado_comercial: EstadoCliente;
  actualizado_en: string | null;
}

// ── Historial ─────────────────────────────────────────────────────────────────

export interface EventoHistorial {
  id: string;
  empresa_cliente_id: string;
  tipo_evento: string;
  descripcion: string;
  usuario_nombre: string | null;
  creado_en: string;
}

// ── Detalle completo (Fase 1B+) ───────────────────────────────────────────────

export interface ClienteDetalle extends ClienteListItem {
  tipo_persona: TipoPersona | null;
  tamano_empresa: TamanoEmpresa | null;
  regimen_tributario: RegimenTributario | null;
  responsable_iva: boolean;
  gran_contribuyente: boolean;
  autorretenedor: boolean;
  actividad_economica: string | null;
  codigo_ciiu: string | null;
  direccion_principal: string | null;
  departamento: string | null;
  telefono_principal: string | null;
  email_principal: string | null;
  sitio_web: string | null;
  logo_url: string | null;
  notas: string | null;
  canal_comercial: CanalComercial | null;
  segmento: string | null;
  director_comercial: string | null;
  coordinador_operativo: string | null;
}
