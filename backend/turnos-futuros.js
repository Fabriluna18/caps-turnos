const { ahora } = require('./fechas');

const aHora = (minutos) =>
  `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}:00`;

// Cuenta los turnos vigentes (pendientes, confirmados o en atención) que todavía no pasaron.
// Filtros opcionales: medicoId, pacienteId, desde/hasta (fechas), dia (1 = lunes ... 7 = domingo)
// y horaInicio/horaFin (los turnos que empiezan dentro de ese rango)
async function contarTurnosFuturos(conexion, filtros = {}) {
  const { fecha, minutos } = ahora();
  const condiciones = [
    "estado IN ('pendiente', 'confirmado', 'en_atencion')",
    '(fecha > ? OR (fecha = ? AND hora > ?))',
  ];
  const valores = [fecha, fecha, aHora(minutos)];

  if (filtros.medicoId) {
    condiciones.push('medico_id = ?');
    valores.push(filtros.medicoId);
  }
  if (filtros.pacienteId) {
    condiciones.push('paciente_id = ?');
    valores.push(filtros.pacienteId);
  }
  if (filtros.desde) {
    condiciones.push('fecha >= ?');
    valores.push(filtros.desde);
  }
  if (filtros.hasta) {
    condiciones.push('fecha <= ?');
    valores.push(filtros.hasta);
  }
  if (filtros.dia) {
    condiciones.push('WEEKDAY(fecha) + 1 = ?');
    valores.push(filtros.dia);
  }
  if (filtros.horaInicio && filtros.horaFin) {
    condiciones.push('hora >= ? AND hora < ?');
    valores.push(filtros.horaInicio, filtros.horaFin);
  }

  const [filas] = await conexion.query(`SELECT COUNT(*) AS n FROM turnos WHERE ${condiciones.join(' AND ')}`, valores);
  return Number(filas[0].n);
}

const textoTurnos = (n) => (n === 1 ? '1 turno' : `${n} turnos`);

module.exports = { contarTurnosFuturos, textoTurnos };