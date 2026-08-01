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
