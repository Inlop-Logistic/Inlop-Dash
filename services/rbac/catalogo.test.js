/**
 * Unit tests for services/rbac/catalogo.js
 * Run: node --test services/rbac/catalogo.test.js
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearAlmacen } from '../gps/testStore.js';
import { obtenerCatalogo, _resetCatalogoParaTests } from './catalogo.js';

function almacenBase() {
  return crearAlmacen({
    roles: [
      { id: 'rol-operador', nombre: 'operador', activo: true },
      { id: 'rol-master',   nombre: 'master',   activo: true },
      { id: 'rol-viejo',    nombre: 'descontinuado', activo: false },
    ],
    permisos: [
      { id: 'perm-viajes-listar', nombre: 'viajes:listar' },
      { id: 'perm-rbac-gestionar', nombre: 'rbac:gestionar' },
    ],
    rol_permisos: [
      { rol_id: 'rol-operador', permiso_id: 'perm-viajes-listar' },
    ],
  });
}

test('obtenerCatalogo: carga roles/permisos/rol_permisos en Maps consultables', async () => {
  _resetCatalogoParaTests();
  const sbFetch = almacenBase();
  const catalogo = await obtenerCatalogo({ sbFetch });

  assert.deepEqual(catalogo.rolesPorId.get('rol-operador'), { nombre: 'operador', activo: true });
  assert.deepEqual(catalogo.rolesPorId.get('rol-viejo'), { nombre: 'descontinuado', activo: false });
  assert.equal(catalogo.permisoNombrePorId.get('perm-viajes-listar'), 'viajes:listar');
  assert.ok(catalogo.permisosPorRol.get('rol-operador').has('perm-viajes-listar'));
});

test('obtenerCatalogo: dentro del TTL no vuelve a consultar Supabase', async () => {
  _resetCatalogoParaTests();
  const sbFetch = almacenBase();
  await obtenerCatalogo({ sbFetch });
  const llamadasTrasPrimeraCarga = sbFetch.llamadas.length;

  await obtenerCatalogo({ sbFetch });
  await obtenerCatalogo({ sbFetch });

  assert.equal(sbFetch.llamadas.length, llamadasTrasPrimeraCarga, 'no debe repetir consultas dentro del TTL');
});

test('obtenerCatalogo: tras _resetCatalogoParaTests(), recarga desde cero', async () => {
  _resetCatalogoParaTests();
  const sbFetch1 = almacenBase();
  await obtenerCatalogo({ sbFetch: sbFetch1 });

  _resetCatalogoParaTests();
  const sbFetch2 = almacenBase();
  await obtenerCatalogo({ sbFetch: sbFetch2 });

  assert.ok(sbFetch2.llamadas.length > 0, 'debe volver a consultar tras el reset');
});

test('obtenerCatalogo: rol_permisos vacío o tabla ausente no rompe la carga', async () => {
  _resetCatalogoParaTests();
  const sbFetch = crearAlmacen({ roles: [], permisos: [] }); // rol_permisos ni siquiera declarada
  const catalogo = await obtenerCatalogo({ sbFetch });
  assert.equal(catalogo.rolesPorId.size, 0);
  assert.equal(catalogo.permisosPorRol.size, 0);
});
