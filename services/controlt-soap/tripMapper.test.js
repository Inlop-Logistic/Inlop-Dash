/**
 * Unit tests for tripMapper.js
 * Run: node --test services/controlt-soap/tripMapper.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mapToViajeRow, deriveEstado } from './tripMapper.js';
import { MappingError } from './errors.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeParada(overrides = {}) {
  return {
    NumeroParada: 1,
    NombreParada: 'Bodega Central',
    Direccion: 'Calle 10 # 5-20, Bogotá',
    Latitud: '4.6097',
    Longitud: '-74.0817',
    EstadoParada: 'Completado',
    FechaProgramada: '2026-07-15T08:00:00',
    FechaReal: '2026-07-15T08:30:00',
    FechaETA: null,
    TipoParada: 'CARGUE',
    ...overrides,
  };
}

function makeSoapResult(overrides = {}) {
  return {
    GetDetailMonitoringOrderResult: {
      Conductor: {
        Cedula: '12345678',
        Nombre: 'Juan Pérez',
      },
      TipoOperacion: '2',
      TipoViaje: '1',
      TipoCarga: '3',
      ValorMercancia: '50000000',
      Moneda: 'COP',
      ValorFlete: '3500000',
      PesoTotal: '12.5',
      VolumenTotal: '8.0',
      TemperaturaMinima: null,
      TemperaturaMaxima: null,
      Instrucciones: 'Manejo cuidadoso',
      FechaUltimoEvento: '2026-07-15T08:30:00',
      Paradas: {
        Parada: [
          makeParada({ NumeroParada: 1, TipoParada: 'CARGUE' }),
          makeParada({
            NumeroParada: 2,
            NombreParada: 'Cliente Final',
            TipoParada: 'DESCARGUE',
            FechaReal: null,
            EstadoParada: 'Pendiente',
          }),
        ],
      },
      ...overrides,
    },
  };
}

// ── deriveEstado ──────────────────────────────────────────────────────────────

describe('deriveEstado', () => {
  it('returns PENDIENTE for empty paradas', () => {
    assert.equal(deriveEstado([]), 'PENDIENTE');
  });

  it('returns PENDIENTE when no stop has hora_real', () => {
    const paradas = [
      { hora_real: null },
      { hora_real: '' },
      { hora_real: null },
    ];
    assert.equal(deriveEstado(paradas), 'PENDIENTE');
  });

  it('returns EN_CARGUE when only the first stop has hora_real', () => {
    const paradas = [
      { hora_real: '2026-07-15T08:30:00' },
      { hora_real: null },
      { hora_real: null },
    ];
    assert.equal(deriveEstado(paradas), 'EN_CARGUE');
  });

  it('returns EN_TRANSITO when a middle stop has hora_real', () => {
    const paradas = [
      { hora_real: '2026-07-15T08:30:00' },
      { hora_real: '2026-07-15T12:00:00' },
      { hora_real: null },
    ];
    assert.equal(deriveEstado(paradas), 'EN_TRANSITO');
  });

  it('returns EN_DESCARGUE when last stop has hora_real but not all', () => {
    const paradas = [
      { hora_real: '2026-07-15T08:30:00' },
      { hora_real: null },
      { hora_real: '2026-07-15T18:00:00' },
    ];
    assert.equal(deriveEstado(paradas), 'EN_DESCARGUE');
  });

  it('returns COMPLETADO when all stops have hora_real', () => {
    const paradas = [
      { hora_real: '2026-07-15T08:30:00' },
      { hora_real: '2026-07-15T12:00:00' },
      { hora_real: '2026-07-15T18:00:00' },
    ];
    assert.equal(deriveEstado(paradas), 'COMPLETADO');
  });

  it('handles single stop with hora_real as COMPLETADO', () => {
    const paradas = [{ hora_real: '2026-07-15T08:30:00' }];
    assert.equal(deriveEstado(paradas), 'COMPLETADO');
  });

  it('handles single stop without hora_real as PENDIENTE', () => {
    const paradas = [{ hora_real: null }];
    assert.equal(deriveEstado(paradas), 'PENDIENTE');
  });
});

// ── mapToViajeRow ─────────────────────────────────────────────────────────────

describe('mapToViajeRow', () => {
  it('maps a complete SOAP result to a ViajeRow', () => {
    const row = mapToViajeRow(makeSoapResult(), 'IN018108');

    assert.equal(row.codigo_controlt, 'IN018108');
    assert.equal(row.estado_viaje, 'EN_CARGUE');       // only first stop has hora_real
    assert.equal(row.conductor_cedula, '12345678');
    assert.equal(row.conductor_nombre, 'Juan Pérez');
    assert.equal(row.tipo_operacion_codigo, 2);
    assert.equal(row.tipo_viaje_codigo, 1);
    assert.equal(row.tipo_carga_codigo, 3);
    assert.equal(row.valor_mercancia, 50000000);
    assert.equal(row.moneda, 'COP');
    assert.equal(row.valor_flete, 3500000);
    assert.equal(row.peso_total_ton, 12.5);
    assert.equal(row.volumen_total, 8.0);
    assert.equal(row.temperatura_min, null);
    assert.equal(row.temperatura_max, null);
    assert.equal(row.instrucciones, 'Manejo cuidadoso');
    assert.equal(row.fecha_evento, '2026-07-15T08:30:00');
    assert.equal(row.paradas.length, 2);
  });

  it('maps parada fields correctly', () => {
    const row = mapToViajeRow(makeSoapResult(), 'IN018108');
    const p0 = row.paradas[0];

    assert.equal(p0.orden, 1);
    assert.equal(p0.nombre, 'Bodega Central');
    assert.equal(p0.direccion, 'Calle 10 # 5-20, Bogotá');
    assert.equal(p0.lat, 4.6097);
    assert.equal(p0.lng, -74.0817);
    assert.equal(p0.estado, 'Completado');
    assert.equal(p0.hora_programada, '2026-07-15T08:00:00');
    assert.equal(p0.hora_real, '2026-07-15T08:30:00');
    assert.equal(p0.tipo, 'CARGUE');
  });

  it('trims codigo_controlt whitespace', () => {
    const row = mapToViajeRow(makeSoapResult(), '  IN018108  ');
    assert.equal(row.codigo_controlt, 'IN018108');
  });

  it('throws MappingError for missing codigoViaje', () => {
    assert.throws(
      () => mapToViajeRow(makeSoapResult(), ''),
      (err) => err instanceof MappingError
    );
    assert.throws(
      () => mapToViajeRow(makeSoapResult(), null),
      (err) => err instanceof MappingError
    );
  });

  it('handles missing optional fields gracefully', () => {
    const minimal = { GetDetailMonitoringOrderResult: {} };
    const row = mapToViajeRow(minimal, 'IN099999');

    assert.equal(row.codigo_controlt, 'IN099999');
    assert.equal(row.estado_viaje, 'PENDIENTE');
    assert.equal(row.conductor_cedula, null);
    assert.equal(row.conductor_nombre, null);
    assert.equal(row.tipo_operacion_codigo, null);
    assert.equal(row.valor_mercancia, null);
    assert.deepEqual(row.paradas, []);
  });

  it('handles single parada object (not array) from SOAP', () => {
    const soap = makeSoapResult({
      Paradas: { Parada: makeParada({ FechaReal: '2026-07-16T10:00:00' }) },
    });
    const row = mapToViajeRow(soap, 'IN018109');
    assert.equal(row.paradas.length, 1);
    assert.equal(row.paradas[0].hora_real, '2026-07-16T10:00:00');
  });

  it('unwraps flat GetDetailMonitoringOrderResult wrapper', () => {
    const soap = { GetDetailMonitoringOrderResult: { Moneda: 'USD' } };
    const row = mapToViajeRow(soap, 'IN018110');
    assert.equal(row.moneda, 'USD');
  });

  it('unwraps nested GetDetailMonitoringOrderResponse wrapper', () => {
    const soap = {
      GetDetailMonitoringOrderResponse: {
        GetDetailMonitoringOrderResult: { Moneda: 'EUR' },
      },
    };
    const row = mapToViajeRow(soap, 'IN018111');
    assert.equal(row.moneda, 'EUR');
  });

  it('maps productos inside a parada', () => {
    const paradaWithProducto = makeParada({
      Productos: {
        Producto: {
          Descripcion: 'Cemento',
          Cantidad: '500',
          UnidadMedida: 'Bolsas',
          PesoToneladas: '12.5',
          Volumen: '6.0',
        },
      },
    });
    const soap = makeSoapResult({
      Paradas: { Parada: paradaWithProducto },
    });
    const row = mapToViajeRow(soap, 'IN018112');
    const prod = row.paradas[0].productos[0];

    assert.equal(prod.descripcion, 'Cemento');
    assert.equal(prod.cantidad, 500);
    assert.equal(prod.unidad, 'Bolsas');
    assert.equal(prod.peso_ton, 12.5);
    assert.equal(prod.volumen, 6.0);
  });

  it('uses decimal comma conversion for float fields', () => {
    const soap = makeSoapResult({ PesoTotal: '12,5' });
    const row = mapToViajeRow(soap, 'IN018113');
    assert.equal(row.peso_total_ton, 12.5);
  });

  it('falls back to latest hora_real for fecha_evento when SOAP field absent', () => {
    const soap = makeSoapResult({ FechaUltimoEvento: undefined });
    const row = mapToViajeRow(soap, 'IN018114');
    // First stop has hora_real = '2026-07-15T08:30:00'
    assert.equal(row.fecha_evento, '2026-07-15T08:30:00');
  });

  it('derives COMPLETADO when both stops have hora_real', () => {
    const soap = makeSoapResult({
      Paradas: {
        Parada: [
          makeParada({ NumeroParada: 1, FechaReal: '2026-07-15T08:30:00' }),
          makeParada({ NumeroParada: 2, FechaReal: '2026-07-15T18:00:00' }),
        ],
      },
    });
    const row = mapToViajeRow(soap, 'IN018115');
    assert.equal(row.estado_viaje, 'COMPLETADO');
  });

  it('supports conductor at top level (CedulaConductor / NombreConductor)', () => {
    const soap = {
      GetDetailMonitoringOrderResult: {
        CedulaConductor: '87654321',
        NombreConductor: 'María López',
      },
    };
    const row = mapToViajeRow(soap, 'IN018116');
    assert.equal(row.conductor_cedula, '87654321');
    assert.equal(row.conductor_nombre, 'María López');
  });
});

// ── Contrato REAL confirmado por auditoría Fase 6 ────────────────────────────
//
// Evidencia obtenida en Railway para el viaje IN018159 (2026-08-02): el
// envelope de GetDetailMonitoringOrder NO usa GetDetailMonitoringOrderResult/
// Response — usa { success, errors, messages, data: { ... } }, con nombres
// de campo en inglés snake_case dentro de `data`, no las claves en español
// PascalCase que se habían asumido sin validar contra una respuesta real.
//
// Estos fixtures reproducen la ESTRUCTURA/nombres de clave confirmados por
// esa auditoría. Los valores de ejemplo son representativos — la auditoría
// confirmó nombres de campo, no los valores concretos del viaje real.

function makeRealStop(overrides = {}) {
  return {
    number_order:                 1,
    shipment_number:              'SH-001',
    description_company_client:  'Cliente Final S.A.S.',
    description_location_destiny: 'Bodega Central',
    type_location:                'CARGUE',
    datetime_in_place:            '2026-07-15T08:00:00',
    datetime_out_place:           '2026-07-15T08:30:00',
    latitude:                     '4.6097',
    longitude:                    '-74.0817',
    address:                      'Calle 10 # 5-20, Bogotá',
    products:                     { eMonitoringOrderProductWS: [] },
    ...overrides,
  };
}

function makeRealSoapResult(dataOverrides = {}) {
  return {
    success: true,
    errors: [],
    messages: [],
    data: {
      code_type_operation: '2',
      code_type_trip:      '1',
      code_type_cargo:     '3',
      username:            '12345678',
      fullname:            'Juan Pérez',
      price_commodity:     '50000000',
      prices_freight:      '3500000',
      temperature_min:     null,
      temperature_max:     null,
      trackingFromNewUI:   true,
      stops: {
        eMonitoringOrderPointStop: [
          makeRealStop({ number_order: 1, type_location: 'CARGUE' }),
          makeRealStop({
            number_order:                 2,
            description_location_destiny: 'Cliente Final',
            type_location:                'DESCARGUE',
            datetime_out_place:            null,
          }),
        ],
      },
      ...dataOverrides,
    },
  };
}

describe('mapToViajeRow — contrato REAL (auditoría Fase 6, evidencia Railway IN018159)', () => {
  it('unwraps the { success, data } envelope (Pattern 3)', () => {
    const row = mapToViajeRow(makeRealSoapResult(), 'IN018159');
    assert.equal(row.codigo_controlt, 'IN018159');
    assert.equal(row.paradas.length, 2);
  });

  it('maps tipo_operacion/viaje/carga from code_type_operation/trip/cargo', () => {
    const row = mapToViajeRow(makeRealSoapResult(), 'IN018159');
    assert.equal(row.tipo_operacion_codigo, 2);
    assert.equal(row.tipo_viaje_codigo, 1);
    assert.equal(row.tipo_carga_codigo, 3);
  });

  it('maps conductor from username/fullname', () => {
    const row = mapToViajeRow(makeRealSoapResult(), 'IN018159');
    assert.equal(row.conductor_cedula, '12345678');
    assert.equal(row.conductor_nombre, 'Juan Pérez');
  });

  it('maps valor_mercancia/valor_flete from price_commodity/prices_freight', () => {
    const row = mapToViajeRow(makeRealSoapResult(), 'IN018159');
    assert.equal(row.valor_mercancia, 50000000);
    assert.equal(row.valor_flete, 3500000);
  });

  it('tolerates price_commodity/prices_freight as single-element arrays', () => {
    const row = mapToViajeRow(
      makeRealSoapResult({ price_commodity: ['50000000'], prices_freight: ['3500000'] }),
      'IN018159'
    );
    assert.equal(row.valor_mercancia, 50000000);
    assert.equal(row.valor_flete, 3500000);
  });

  it('maps temperature_min/temperature_max', () => {
    const row = mapToViajeRow(
      makeRealSoapResult({ temperature_min: '2.5', temperature_max: '8.0' }),
      'IN018159'
    );
    assert.equal(row.temperatura_min, 2.5);
    assert.equal(row.temperatura_max, 8.0);
  });

  it('maps parada fields from the real stop contract', () => {
    const row = mapToViajeRow(makeRealSoapResult(), 'IN018159');
    const p0 = row.paradas[0];

    assert.equal(p0.orden, 1);
    assert.equal(p0.nombre, 'Bodega Central');
    assert.equal(p0.direccion, 'Calle 10 # 5-20, Bogotá');
    assert.equal(p0.lat, 4.6097);
    assert.equal(p0.lng, -74.0817);
    assert.equal(p0.hora_programada, '2026-07-15T08:00:00');
    assert.equal(p0.hora_real, '2026-07-15T08:30:00');
    assert.equal(p0.tipo, 'CARGUE');
  });

  it('derives estado_viaje from datetime_out_place across real stops', () => {
    const row = mapToViajeRow(makeRealSoapResult(), 'IN018159');
    // Solo la primera parada tiene datetime_out_place → EN_CARGUE
    assert.equal(row.estado_viaje, 'EN_CARGUE');
  });

  it('falls back to latest hora_real (datetime_out_place) for fecha_evento', () => {
    const row = mapToViajeRow(makeRealSoapResult(), 'IN018159');
    assert.equal(row.fecha_evento, '2026-07-15T08:30:00');
  });

  it('maps productos array from products.eMonitoringOrderProductWS', () => {
    const soap = makeRealSoapResult();
    soap.data.stops.eMonitoringOrderPointStop[0].products = {
      eMonitoringOrderProductWS: [{ Descripcion: 'Cemento', Cantidad: '500' }],
    };
    const row = mapToViajeRow(soap, 'IN018159');
    assert.equal(row.paradas[0].productos.length, 1);
    assert.equal(row.paradas[0].productos[0].descripcion, 'Cemento');
  });

  it('handles single stop object (not array) under the real contract', () => {
    const soap = makeRealSoapResult();
    soap.data.stops = { eMonitoringOrderPointStop: makeRealStop() };
    const row = mapToViajeRow(soap, 'IN018159');
    assert.equal(row.paradas.length, 1);
  });

  it('still supports the legacy GetDetailMonitoringOrderResult contract (no regression)', () => {
    const legacy = { GetDetailMonitoringOrderResult: { Moneda: 'COP' } };
    const row = mapToViajeRow(legacy, 'IN018108');
    assert.equal(row.moneda, 'COP');
  });

  it('still supports the legacy GetDetailMonitoringOrderResponse contract (no regression)', () => {
    const legacy = {
      GetDetailMonitoringOrderResponse: {
        GetDetailMonitoringOrderResult: { Moneda: 'EUR' },
      },
    };
    const row = mapToViajeRow(legacy, 'IN018108');
    assert.equal(row.moneda, 'EUR');
  });
});

// ── Volcado LITERAL capturado en Railway — IN018153 (segunda ronda) ──────────
//
// El primer volcado (solo Object.keys) permitió corregir el desenvolvimiento
// del envelope, pero no reveló code_currency_commodity, weight/volume,
// observations/doc_ref1, date_event, ni los campos internos de cada
// producto — todos ausentes de esa lista de claves de primer nivel porque
// están anidados. Este fixture es el JSON EXACTO capturado en Railway para
// IN018153 (2026-08-02), pegado tal cual, sin editar valores.

const REAL_DETAIL_IN018153 = {
  messages: { string: 'Se consulto la información del viaje 7424232 correctamente' },
  errors: '',
  success: true,
  data: {
    code_company: '57INLOP',
    number_travel_main: 'IN018153',
    number_travel_secondary: 'IN018153',
    code_type_operation: 11,
    code_type_trip: 2,
    code_type_cargo: 11,
    username: 1007986227,
    fullname: 'Valentina Moreno Albornoz',
    date_event: '01/08/2026 00:24:48',
    weight: 2,
    volume: 2,
    price_commodity: 25000000,
    code_currency_commodity: 'COP',
    prices_freight: 331700,
    temperature_min: '',
    temperature_max: '',
    observations: '',
    doc_ref1: 'HORARIO DE TRANSITO PERMITIDO SEGUN LO DIVULGADO POR PERSONAL DE INLOP, EN CASO DE CUALQUIER NOVEDAD O INQUIETUD, COMUNICARSE A LOS NUMEROS 3214640439 3014847549 3204212627 3243232893, NO OLVIDAR LOS PUESTOS DE CONTROL OBLIGATORIOS CON SOS CONTINGENCIAS. GRACIAS POR CARGAR CON INLOP.',
    doc_ref2: '',
    aux_fields: '',
    stops: {
      eMonitoringOrderPointStop: [
        {
          number_order: 'IN019093',
          shipment_number: '',
          remission: '',
          code_location_seller: '',
          id_company_client: 860003831,
          description_company_client: 'PRODUCTOS RAMO S.A.S',
          type_company_client: 'GC',
          code_location_destiny: 'R639',
          description_location_destiny: 'PRODUCTOS RAMO S.A.S',
          type_location: 'Origen',
          datetime_in_place: '01/08/2026 05:00:00',
          datetime_out_place: '',
          latitude: 4.1374887,
          longitude: -73.6026752,
          address: 'Villavicencio, Meta',
          code_city: 50001,
          code_deparment: 50,
          mandate: 2,
          aux: '',
          code_type_commodity: 1,
          Permanence_destinity: 0,
          products: '',
        },
        {
          number_order: 'IN019093',
          shipment_number: 'IN020186',
          remission: 'NHR-  VI-2796',
          code_location_seller: 3,
          id_company_client: 860003831,
          description_company_client: 'PRODUCTOS RAMO S.A.S',
          type_company_client: 'GC',
          code_location_destiny: 'D968',
          description_location_destiny: 'PRODUCTOS RAMO S.A.S',
          type_location: 'Destino',
          datetime_in_place: '01/08/2026 11:23:00',
          datetime_out_place: '',
          latitude: 4.1441214,
          longitude: -73.6335673,
          address: 'Cl. 31 Sur 3195, Villavicencio, Meta',
          code_city: 50001,
          code_deparment: 50,
          mandate: 2,
          aux: '',
          code_type_commodity: 1,
          Permanence_destinity: 0,
          products: {
            eMonitoringOrderProductWS: {
              code_product: 3,
              description_product: 'PRODUCTOS ALIMENTICIOS',
              barcode: '',
              amount_order: 2,
              amount_deliver: 2,
              unit: 'Paquetes',
              weight: 2,
              volumen: 2,
              routing_variable: 'Peso',
              amount_settled: 25000000,
              aux_fields: '',
            },
          },
        },
      ],
    },
    trackingFromNewUI: false,
  },
};

describe('mapToViajeRow — volcado literal Railway IN018153 (auditoría Fase 6, 2ª ronda)', () => {
  it('maps every previously-null field correctly from the real captured payload', () => {
    const row = mapToViajeRow(REAL_DETAIL_IN018153, 'IN018153');

    assert.equal(row.codigo_controlt, 'IN018153');
    assert.equal(row.conductor_cedula, '1007986227');
    assert.equal(row.conductor_nombre, 'Valentina Moreno Albornoz');
    assert.equal(row.tipo_operacion_codigo, 11);
    assert.equal(row.tipo_viaje_codigo, 2);
    assert.equal(row.tipo_carga_codigo, 11);
    assert.equal(row.valor_mercancia, 25000000);
    assert.equal(row.moneda, 'COP');
    assert.equal(row.valor_flete, 331700);
    assert.equal(row.peso_total_ton, 2);
    assert.equal(row.volumen_total, 2);
    assert.equal(row.temperatura_min, null); // "" real — sin control de temperatura en este viaje
    assert.equal(row.temperatura_max, null);
    assert.equal(row.fecha_evento, '01/08/2026 00:24:48');
    assert.equal(row.paradas.length, 2);
  });

  it('prefers doc_ref1 as instrucciones when observations is empty', () => {
    const row = mapToViajeRow(REAL_DETAIL_IN018153, 'IN018153');
    assert.ok(row.instrucciones.includes('HORARIO DE TRANSITO PERMITIDO'));
  });

  it('maps parada fields from the real captured stops', () => {
    const row = mapToViajeRow(REAL_DETAIL_IN018153, 'IN018153');
    const [origen, destino] = row.paradas;

    assert.equal(origen.tipo, 'Origen');
    assert.equal(origen.direccion, 'Villavicencio, Meta');
    assert.equal(origen.lat, 4.1374887);
    assert.equal(origen.lng, -73.6026752);
    assert.equal(origen.hora_programada, '01/08/2026 05:00:00');
    assert.equal(origen.hora_real, null); // datetime_out_place: "" — parada aún no completada
    assert.equal(origen.productos.length, 0); // products: "" — sin productos

    assert.equal(destino.tipo, 'Destino');
    assert.equal(destino.direccion, 'Cl. 31 Sur 3195, Villavicencio, Meta');
  });

  it('unwraps a single (non-array) product object per stop', () => {
    const row = mapToViajeRow(REAL_DETAIL_IN018153, 'IN018153');
    const destino = row.paradas[1];

    assert.equal(destino.productos.length, 1);
    assert.equal(destino.productos[0].descripcion, 'PRODUCTOS ALIMENTICIOS');
    assert.equal(destino.productos[0].cantidad, 2);
    assert.equal(destino.productos[0].unidad, 'Paquetes');
    assert.equal(destino.productos[0].peso_ton, 2);
    assert.equal(destino.productos[0].volumen, 2);
  });

  it('derives estado_viaje as PENDIENTE (no stop has datetime_out_place yet)', () => {
    const row = mapToViajeRow(REAL_DETAIL_IN018153, 'IN018153');
    assert.equal(row.estado_viaje, 'PENDIENTE');
  });

  it('does not treat number_order (order code, not a sequence) as orden', () => {
    // number_order = "IN019093" en ambas paradas — no es numérico, así que
    // orden cae a index+1, no al valor repetido de number_order.
    const row = mapToViajeRow(REAL_DETAIL_IN018153, 'IN018153');
    assert.equal(row.paradas[0].orden, 1);
    assert.equal(row.paradas[1].orden, 2);
  });
});
