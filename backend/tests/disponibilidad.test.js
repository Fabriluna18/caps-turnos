const test = require('node:test');
const assert = require('node:assert/strict');
const { calcularDia, calcularMes, proximoLibre } = require('../calculo-turnos');

// "Ahora" fijo para que los tests den siempre lo mismo: martes 10/11/2026, 10:00
const AHORA = { fecha: '2026-11-10', minutos: 10 * 60 };
const LUNES = '2026-11-16';
const MARTES = '2026-11-17';

const base = () => ({
  horarios: [{ dia_semana: 1, hora_inicio: '08:00:00', hora_fin: '12:00:00', duracion_min: 30 }],
  licencias: [],
  feriados: [],
  turnos: [],
});

const libres = (r) => r.turnos.filter((t) => t.libre).length;

test('un bloque de 4 horas cada 30 minutos da 8 turnos', () => {
  const r = calcularDia(base(), LUNES, AHORA);
  assert.equal(r.motivo, null);
  assert.equal(r.turnos.length, 8);
  assert.equal(r.turnos[0].hora, '08:00');
  assert.equal(r.turnos[7].hora, '11:30');
});

test('un turno ocupado deja ese horario sin disponibilidad', () => {
  const datos = base();
  datos.turnos = [{ fecha: LUNES, hora: '09:00:00', duracion_min: 30 }];
  const r = calcularDia(datos, LUNES, AHORA);
  assert.equal(r.turnos.find((t) => t.hora === '09:00').libre, false);
  assert.equal(libres(r), 7);
});

test('un turno desalineado ocupa los dos horarios que toca', () => {
  const datos = base();
  datos.turnos = [{ fecha: LUNES, hora: '09:15:00', duracion_min: 30 }];
  const r = calcularDia(datos, LUNES, AHORA);
  assert.equal(r.turnos.find((t) => t.hora === '09:00').libre, false);
  assert.equal(r.turnos.find((t) => t.hora === '09:30').libre, false);
  assert.equal(libres(r), 6);
});

test('un feriado no ofrece turnos', () => {
  const datos = base();
  datos.feriados = [{ fecha: LUNES, descripcion: 'Día de prueba' }];
  const r = calcularDia(datos, LUNES, AHORA);
  assert.equal(r.motivo, 'feriado');
  assert.equal(r.mensaje, 'Feriado: Día de prueba');
  assert.equal(r.turnos.length, 0);
});

test('una licencia no ofrece turnos', () => {
  const datos = base();
  datos.licencias = [{ desde: '2026-11-10', hasta: '2026-11-20' }];
  const r = calcularDia(datos, LUNES, AHORA);
  assert.equal(r.motivo, 'licencia');
  assert.equal(r.turnos.length, 0);
});

test('un día sin horarios cargados no ofrece turnos', () => {
  const r = calcularDia(base(), MARTES, AHORA);
  assert.equal(r.motivo, 'no_atiende');
});

test('una fecha pasada no ofrece turnos', () => {
  const r = calcularDia(base(), '2026-11-09', AHORA);
  assert.equal(r.motivo, 'pasado');
});

test('hoy no ofrece los horarios que ya pasaron', () => {
  const ahora = { fecha: LUNES, minutos: 9 * 60 + 10 };
  const r = calcularDia(base(), LUNES, ahora);
  assert.equal(r.turnos.length, 5);
  assert.equal(r.turnos[0].hora, '09:30');
});

test('dos bloques en el mismo día suman sus turnos', () => {
  const datos = base();
  datos.horarios.push({ dia_semana: 1, hora_inicio: '14:00:00', hora_fin: '16:00:00', duracion_min: 20 });
  const r = calcularDia(datos, LUNES, AHORA);
  assert.equal(r.turnos.length, 14);
});

test('no ofrece fechas con más de 60 días de anticipación', () => {
  const r = calcularDia(base(), '2027-02-01', AHORA);
  assert.equal(r.motivo, 'lejano');
});

test('si todos los turnos están ocupados, lo informa', () => {
  const datos = base();
  datos.turnos = ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30'].map((h) => ({
    fecha: LUNES,
    hora: `${h}:00`,
    duracion_min: 30,
  }));
  const r = calcularDia(datos, LUNES, AHORA);
  assert.equal(r.motivo, 'completo');
  assert.equal(r.turnos.length, 8);
  assert.equal(libres(r), 0);
});

test('el calendario del mes devuelve todos los días con sus turnos libres', () => {
  const dias = calcularMes(base(), 2026, 11, AHORA);
  assert.equal(dias.length, 30);
  assert.equal(dias.find((d) => d.fecha === LUNES).libres, 8);
  const pasado = dias.find((d) => d.fecha === '2026-11-09');
  assert.equal(pasado.libres, 0);
  assert.equal(pasado.motivo, 'pasado');
});

test('el próximo turno libre es el primero del próximo día de atención', () => {
  assert.deepEqual(proximoLibre(base(), AHORA), { fecha: LUNES, hora: '08:00' });
});

test('el próximo turno libre se saltea los horarios ocupados', () => {
  const datos = base();
  datos.turnos = [{ fecha: LUNES, hora: '08:00:00', duracion_min: 30 }];
  assert.deepEqual(proximoLibre(datos, AHORA), { fecha: LUNES, hora: '08:30' });
});

test('el próximo turno libre se saltea los feriados', () => {
  const datos = base();
  datos.feriados = [{ fecha: LUNES, descripcion: 'Día de prueba' }];
  assert.deepEqual(proximoLibre(datos, AHORA), { fecha: '2026-11-23', hora: '08:00' });
});

test('si no hay turnos en los próximos 60 días, devuelve null', () => {
  const datos = base();
  datos.horarios = [];
  assert.equal(proximoLibre(datos, AHORA), null);
});