const { calcularDia, calcularMes } = require('./calculo-turnos');
const { ahora } = require('./fechas');

// Trae de la base lo que hace falta para calcular los turnos de un rango de fechas
// (solo lo vigente: lo desactivado no se tiene en cuenta)
async function cargarDatos(conexion, medicoId, desde, hasta) {
  const [horarios] = await conexion.query(
    `SELECT dia_semana, hora_inicio, hora_fin, duracion_min
     FROM horarios WHERE medico_id = ? AND activo = 1 ORDER BY dia_semana, hora_inicio`,
    [medicoId]
  );
  const [licencias] = await conexion.query(
    'SELECT desde, hasta FROM licencias WHERE medico_id = ? AND activa = 1 AND desde <= ? AND hasta >= ?',
    [medicoId, hasta, desde]
  );
  const [feriados] = await conexion.query(
    'SELECT fecha, descripcion FROM feriados WHERE activo = 1 AND fecha BETWEEN ? AND ?',
    [desde, hasta]
  );
  const [turnos] = await conexion.query(
    "SELECT fecha, hora, duracion_min FROM turnos WHERE medico_id = ? AND fecha BETWEEN ? AND ? AND estado <> 'cancelado'",
    [medicoId, desde, hasta]
  );
  return { horarios, licencias, feriados, turnos };
}

async function medicoActivo(conexion, medicoId) {
  const [filas] = await conexion.query(
    'SELECT u.id FROM usuarios u JOIN medicos m ON m.usuario_id = u.id WHERE u.id = ? AND u.activo = 1',
    [medicoId]
  );
  return filas.length > 0;
}

async function disponibilidadDelDia(conexion, medicoId, fecha) {
  const datos = await cargarDatos(conexion, medicoId, fecha, fecha);
  return calcularDia(datos, fecha, ahora());
}

async function disponibilidadDelMes(conexion, medicoId, anio, mes) {
  const mm = String(mes).padStart(2, '0');
  const ultimo = String(new Date(Date.UTC(anio, mes, 0)).getUTCDate()).padStart(2, '0');
  const datos = await cargarDatos(conexion, medicoId, `${anio}-${mm}-01`, `${anio}-${mm}-${ultimo}`);
  return calcularMes(datos, anio, mes, ahora());
}

module.exports = { medicoActivo, disponibilidadDelDia, disponibilidadDelMes };