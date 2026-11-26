import express from 'express';
import ExcelJS from 'exceljs';

const SELECT = [
  'id','codigo_solicitud','external_ref','estado','creado_en','creado_por',
  'empresa_cliente_id','agencia_id','agencia_nombre','tipo_operacion','tipo_vehiculo',
  'origen','destino','fecha_requerida','observacion_coordinadora',
  'placa_asignada','conductor_nombre','conductor_tel','controlt_trip_number','canal',
].join(',');

const ESTADOS = ['pendiente','confirmado','en_ruta','completado','cancelado'];
const PERMISO = 'solicitudes:listar';

function textoSeguro(value, max = 100) {
  return String(value || '').trim().replace(/[(),.*%_]/g, ' ').replace(/\s+/g, ' ').slice(0, max);
}

function construirFiltros(query) {
  const { desde, hasta, estado, busqueda, cliente } = query;
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
  const fechaDesde = desde || hoy;
  const fechaHasta = hasta || hoy;
  const filtros = [
    `estado=in.(${ESTADOS.join(',')})`,
    `creado_en=gte.${encodeURIComponent(fechaDesde + 'T00:00:00.000-05:00')}`,
    `creado_en=lte.${encodeURIComponent(fechaHasta + 'T23:59:59.999-05:00')}`,
  ];
  if (estado && estado !== 'todos') {
    filtros[0] = `estado=eq.${encodeURIComponent(estado === 'aprobado' ? 'confirmado' : estado)}`;
  }
  return { filtros, cliente: textoSeguro(cliente, 120), fechaDesde, fechaHasta };
}

async function enriquecer(solicitudes, sbFetch) {
  const empresaIds = [...new Set(solicitudes.map(s => s.empresa_cliente_id).filter(Boolean))];
  const agenciaIds = [...new Set(solicitudes.map(s => s.agencia_id).filter(Boolean))];
  const usuarioIds = [...new Set(solicitudes.map(s => s.creado_por).filter(Boolean))];
  const [empresas, agencias, usuarios] = await Promise.all([
    empresaIds.length ? sbFetch(`/empresas_cliente?id=in.(${empresaIds.map(encodeURIComponent).join(',')})&select=id,razon_social`) : [],
    agenciaIds.length ? sbFetch(`/agencias_cliente?id=in.(${agenciaIds.map(encodeURIComponent).join(',')})&select=id,nombre`) : [],
    usuarioIds.length ? sbFetch(`/usuarios_cliente?id=in.(${usuarioIds.map(encodeURIComponent).join(',')})&select=id,nombre`) : [],
  ]);
  const emp = Object.fromEntries((empresas || []).map(x => [x.id, x.razon_social]));
  const ag = Object.fromEntries((agencias || []).map(x => [x.id, x.nombre]));
  const usr = Object.fromEntries((usuarios || []).map(x => [x.id, x.nombre]));
  return solicitudes.map(s => ({
    id:s.id, codigo_solicitud:s.codigo_solicitud, external_ref:s.external_ref || null,
    cliente:emp[s.empresa_cliente_id] || '—', agencia:ag[s.agencia_id] || s.agencia_nombre || '—',
    solicitante:usr[s.creado_por] || '—', tipo_operacion:s.tipo_operacion || '',
    tipo_vehiculo:s.tipo_vehiculo || '', origen:s.origen || '', destino:s.destino || '',
    fecha_requerida:s.fecha_requerida || null,
    estado:s.estado === 'confirmado' ? 'aprobado' : s.estado, creado_en:s.creado_en,
    canal:s.canal || 'APP', placa_asignada:s.placa_asignada || null,
    conductor_nombre:s.conductor_nombre || null, conductor_tel:s.conductor_tel || null,
    controlt_trip_number:s.controlt_trip_number || null,
  }));
}

export default function crearRouterSolicitudesErp({ sbFetch, sbFetchCount, requireErpAuth, requirePermiso }) {
  const router = express.Router();
  const auth = [requireErpAuth, requirePermiso(PERMISO, { sbFetch })];

  async function resolverClienteId(nombre) {
    if (!nombre) return null;
    const rows = await sbFetch(`/empresas_cliente?razon_social=eq.${encodeURIComponent(nombre)}&select=id&limit=1`);
    return rows?.[0]?.id || '__no_match__';
  }

  async function obtenerFilas(query, { all = false } = {}) {
    const { filtros, cliente } = construirFiltros(query);
    const term = textoSeguro(query.busqueda, 80);
    if (term) {
      const clientesCoincidentes = await sbFetch(`/empresas_cliente?razon_social=ilike.*${encodeURIComponent(term)}*&select=id&limit=100`);
      const ids = (clientesCoincidentes || []).map(x => x.id).filter(Boolean);
      const termLike = `*${encodeURIComponent(term)}*`;
      const condiciones = [
        `codigo_solicitud.ilike.${termLike}`,
        `external_ref.ilike.${termLike}`,
        `origen.ilike.${termLike}`,
        `destino.ilike.${termLike}`,
        `agencia_nombre.ilike.${termLike}`,
      ];
      if (ids.length) condiciones.push(`empresa_cliente_id.in.(${ids.map(encodeURIComponent).join(',')})`);
      filtros.push(`or=(${condiciones.join(',')})`);
    }
    if (cliente) {
      const id = await resolverClienteId(cliente);
      filtros.push(id === '__no_match__' ? 'id=eq.00000000-0000-0000-0000-000000000000' : `empresa_cliente_id=eq.${encodeURIComponent(id)}`);
    }
    const base = `/solicitudes?select=${SELECT}&order=creado_en.desc,id.desc&${filtros.join('&')}`;
    if (all) {
      const rows = [];
      const size = 500;
      for (let offset = 0; ; offset += size) {
        const batch = await sbFetch(`${base}&limit=${size}&offset=${offset}`);
        if (!batch) throw new Error('Error consultando solicitudes');
        rows.push(...batch);
        if (batch.length < size) break;
      }
      return { rows, total: rows.length, filtros };
    }
    const page = Math.max(1, Math.min(100000, Number.parseInt(query.page, 10) || 1));
    const pageSize = Math.max(10, Math.min(100, Number.parseInt(query.pageSize, 10) || 25));
    const offset = (page - 1) * pageSize;
    const total = await sbFetchCount(`${base}&limit=1`);
    const rows = await sbFetch(`${base}&limit=${pageSize}&offset=${offset}`);
    if (!rows) throw new Error('Error consultando solicitudes');
    return { rows, total, page, pageSize, filtros };
  }

  router.get('/clientes', ...auth, async (_req, res) => {
    try {
      const rows = await sbFetch('/empresas_cliente?estado=not.in.(inactivo,fusionado)&select=razon_social&order=razon_social.asc&limit=1000');
      const clientes = [...new Set((rows || []).map(x => x.razon_social).filter(Boolean))];
      res.json(clientes);
    } catch (e) {
      res.status(500).json({ error: 'No fue posible cargar los clientes' });
    }
  });

  router.get('/', ...auth, async (req, res) => {
    try {
      const result = await obtenerFilas(req.query);
      const data = await enriquecer(result.rows, sbFetch);
      const [pendientes, enRuta, finalizadas] = await Promise.all([
        sbFetchCount(`/solicitudes?select=id&estado=eq.pendiente&creado_en=gte.${encodeURIComponent((req.query.desde || new Date().toLocaleDateString('en-CA',{timeZone:'America/Bogota'}))+'T00:00:00.000-05:00')}&creado_en=lte.${encodeURIComponent((req.query.hasta || new Date().toLocaleDateString('en-CA',{timeZone:'America/Bogota'}))+'T23:59:59.999-05:00')}`),
        sbFetchCount(`/solicitudes?select=id&estado=eq.en_ruta&creado_en=gte.${encodeURIComponent((req.query.desde || new Date().toLocaleDateString('en-CA',{timeZone:'America/Bogota'}))+'T00:00:00.000-05:00')}&creado_en=lte.${encodeURIComponent((req.query.hasta || new Date().toLocaleDateString('en-CA',{timeZone:'America/Bogota'}))+'T23:59:59.999-05:00')}`),
        sbFetchCount(`/solicitudes?select=id&estado=eq.completado&creado_en=gte.${encodeURIComponent((req.query.desde || new Date().toLocaleDateString('en-CA',{timeZone:'America/Bogota'}))+'T00:00:00.000-05:00')}&creado_en=lte.${encodeURIComponent((req.query.hasta || new Date().toLocaleDateString('en-CA',{timeZone:'America/Bogota'}))+'T23:59:59.999-05:00')}`),
      ]);
      res.json({ data, pagination:{ page:result.page, pageSize:result.pageSize, total:result.total, totalPages:Math.ceil(result.total/result.pageSize) }, kpis:{ total:result.total, pendientes, enRuta, finalizadas } });
    } catch (e) {
      console.error('❌ GET /api/erp/solicitudes:', e.message);
      res.status(500).json({ error:'No fue posible cargar las solicitudes' });
    }
  });

  router.get('/export', ...auth, async (req, res) => {
    try {
      const { rows } = await obtenerFilas(req.query, { all:true });
      const data = await enriquecer(rows, sbFetch);
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'INLOP ERP';
      const sheet = workbook.addWorksheet('Solicitudes');
      sheet.columns = [
        {header:'Solicitud',key:'codigo_solicitud',width:18},
        {header:'Remisión',key:'external_ref',width:20},
        {header:'Fecha solicitud',key:'creado_en',width:22},
        {header:'Cliente',key:'cliente',width:32},
        {header:'Agencia',key:'agencia',width:24},
        {header:'Solicitante',key:'solicitante',width:24},
        {header:'Canal',key:'canal',width:12},
        {header:'Tipo servicio',key:'tipo_operacion',width:18},
        {header:'Tipo vehículo',key:'tipo_vehiculo',width:20},
        {header:'Origen',key:'origen',width:24},
        {header:'Destino',key:'destino',width:24},
        {header:'Fecha requerida',key:'fecha_requerida',width:22},
        {header:'Estado',key:'estado',width:18},
        {header:'Placa',key:'placa_asignada',width:16},
        {header:'Conductor',key:'conductor_nombre',width:28},
        {header:'Teléfono conductor',key:'conductor_tel',width:20},
        {header:'Viaje ControlT',key:'controlt_trip_number',width:20},
      ];
      sheet.addRows(data);
      sheet.getRow(1).font = { bold:true, color:{argb:'FFFFFFFF'} };
      sheet.getRow(1).fill = { type:'pattern', pattern:'solid', fgColor:{argb:'FF17365D'} };
      sheet.views = [{ state:'frozen', ySplit:1 }];
      sheet.autoFilter = { from:'A1', to:`Q${Math.max(1,data.length+1)}` };
      const buffer = await workbook.xlsx.writeBuffer();
      const fecha = new Date().toISOString().slice(0,10);
      res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition',`attachment; filename="solicitudes_${fecha}.xlsx"`);
      res.send(Buffer.from(buffer));
    } catch (e) {
      console.error('❌ GET /api/erp/solicitudes/export:', e.message);
      res.status(500).json({ error:'No fue posible exportar las solicitudes' });
    }
  });

  return router;
}
