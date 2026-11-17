require('dotenv').config();
const pool = require('../db');
const { disponibilidadDelDia } = require('../disponibilidad');
const { ahora } = require('../fechas');

const URL_API = `http://localhost:${process.env.PORT || 3001}/api`;
const DNI = process.env.DNI_SECRETARIA || '11111111';
const CLAVE = process.env.CLAVE_SECRETARIA || 'demo1234';

const sumarDias = (fecha, dias) => {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};

async function pedir(metodo, ruta, cuerpo, token) {
  const r = await fetch(`${URL_API}${ruta}`, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  return { estado: r.status, datos: await r.json().catch(() => ({})) };
}

async function main() {
  // Un médico activo con horarios vigentes y dos pacientes activos
  const [medicos] = await pool.query(
    `SELECT u.id, u.apellido FROM usuarios u JOIN medicos m ON m.usuario_id = u.id
     WHERE u.activo = 1 AND EXISTS (
       SELECT 1 FROM horarios h WHERE h.medico_id = u.id AND h.activo = 1 AND h.eliminado = 0
     ) ORDER BY u.id LIMIT 1`
  );
  const [pacientes] = await pool.query(
    `SELECT u.id, u.apellido FROM usuarios u JOIN pacientes p ON p.usuario_id = u.id
     WHERE u.activo = 1 ORDER BY u.id LIMIT 2`
  );
  if (medicos.length === 0 || pacientes.length < 2) {
    console.log('Hace falta un médico activo con horarios y al menos dos pacientes activos.');
    return;
  }
  const medico = medicos[0];
  const [pac1, pac2] = pacientes;

  // El primer día de los próximos 45 con algún turno libre
  let fecha = null;
  let hora = null;
  for (let i = 1; i <= 45 && !fecha; i++) {
    const dia = sumarDias(ahora().fecha, i);
    const r = await disponibilidadDelDia(pool, medico.id, dia);
    const libre = r.turnos.find((t) => t.libre);
    if (libre) {
      fecha = dia;
      hora = libre.hora;
    }
  }
  if (!fecha) {
    console.log('No encontré ningún día con turnos libres para probar. Revisá los horarios del médico.');
    return;
  }

  console.log(`Médico: ${medico.apellido} (id ${medico.id})`);
  console.log(`Pacientes: ${pac1.apellido} (id ${pac1.id}) y ${pac2.apellido} (id ${pac2.id})`);
  console.log(`Probando el ${fecha} a las ${hora}, con dos pedidos al mismo tiempo...\n`);

  const login = await pedir('POST', '/auth/login', { dni: DNI, password: CLAVE });
  if (!login.datos.token) {
    console.log(`No se pudo ingresar como secretaría (${login.datos.error || login.estado}). Revisá el DNI y la clave.`);
    return;
  }
  const token = login.datos.token;

  const [a, b] = await Promise.all([
    pedir('POST', '/turnos', { medico_id: medico.id, paciente_id: pac1.id, fecha, hora }, token),
    pedir('POST', '/turnos', { medico_id: medico.id, paciente_id: pac2.id, fecha, hora }, token),
  ]);
  for (const [nombre, r] of [['Pedido A', a], ['Pedido B', b]]) {
    console.log(`${nombre}: ${r.estado} - ${r.datos.error || 'Turno reservado'}`);
  }

  const exitosos = [a, b].filter((r) => r.estado === 201);
  const rechazados = [a, b].filter((r) => r.estado === 409);
  console.log(
    exitosos.length === 1 && rechazados.length === 1
      ? '\nResultado: una reserva exitosa y una rechazada ✅ (la doble reserva es imposible)'
      : '\nResultado inesperado ❌: copiá estas líneas y revisalo.'
  );

  // Se cancela el turno de prueba (queda como cancelado y el horario vuelve a estar libre)
  for (const r of exitosos) {
    await pedir('PUT', `/turnos/${r.datos.turno.id}/cancelar`, null, token);
    console.log('Turno de prueba cancelado: el horario quedó libre.');
  }
}

main()
  .catch((error) => console.error(error))
  .finally(() => pool.end());