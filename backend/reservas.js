const { ahora, fechaValida } = require('./fechas');
const { medicoActivo, disponibilidadDelDia } = require('./disponibilidad');

const aMin = (hora) => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5));

// ¿El turno todavía no empezó? (hora argentina)
function esFuturo(fecha, hora) {
  const a = ahora();
  return fecha > a.fecha || (fecha === a.fecha && aMin(hora) > a.minutos);
}

// ¿El paciente ya tiene otro turno vigente que se pise con este horario (con cualquier médico)?
async function choquePaciente(conexion, pacienteId, fecha, hora, duracion, ignorarId) {
  const inicio = `${hora}:00`;
  const [filas] = await conexion.query(
    `SELECT t.hora, um.apellido
     FROM turnos t JOIN usuarios um ON um.id = t.medico_id
     WHERE t.paciente_id = ? AND t.fecha = ? AND t.estado <> 'cancelado' AND t.id <> ?
       AND t.hora < ADDTIME(?, SEC_TO_TIME(? * 60))
       AND ADDTIME(t.hora, SEC_TO_TIME(t.duracion_min * 60)) > ?
     LIMIT 1`,
    [pacienteId, fecha, ignorarId ?? 0, inicio, duracion, inicio]
  );
  return filas[0] || null;
}

// Reserva un turno con todas las protecciones. Devuelve { turnoId } o { codigo, error }.
// "quien" dice cómo se nombra al paciente en los mensajes ("El paciente" / "Vos").
async function reservarTurno(conexion, { medicoId, pacienteId, fecha, hora, motivo, estado, creadoPor, propio }) {
  if (!fechaValida(fecha) || !/^\d{2}:\d{2}$/.test(hora)) return { codigo: 400, error: 'Elegí el día y el horario' };
  try {
    await conexion.beginTransaction();
    // Se bloquea al médico: dos reservas a la vez para el mismo médico se procesan de a una
    const [medico] = await conexion.query('SELECT usuario_id FROM medicos WHERE usuario_id = ? FOR UPDATE', [medicoId]);
    if (medico.length === 0) {
      await conexion.rollback();
      return { codigo: 404, error: 'Médico no encontrado' };
    }
    if (!(await medicoActivo(conexion, medicoId))) {
      await conexion.rollback();
      return { codigo: 409, error: 'Ese médico no está atendiendo por el momento' };
    }

    const [paciente] = await conexion.query(
      'SELECT u.id FROM usuarios u JOIN pacientes p ON p.usuario_id = u.id WHERE u.id = ? AND u.activo = 1',
      [pacienteId]
    );
    if (paciente.length === 0) {
      await conexion.rollback();
      return { codigo: 404, error: 'Paciente no encontrado o dado de baja' };
    }

    const dia = await disponibilidadDelDia(conexion, medicoId, fecha);
    const slot = dia.turnos.find((t) => t.hora === hora);
    if (!slot) {
      await conexion.rollback();
      return { codigo: 409, error: dia.mensaje || 'Ese horario no está disponible' };
    }
    if (!slot.libre) {
      await conexion.rollback();
      return { codigo: 409, error: 'Ese horario ya está ocupado. Elegí otro.' };
    }

    const choque = await choquePaciente(conexion, pacienteId, fecha, hora, slot.duracion_min, null);
    if (choque) {
      const quien = propio ? 'Ya tenés' : 'El paciente ya tiene';
      await conexion.rollback();
      return {
        codigo: 409,
        error: `${quien} un turno ese día a las ${choque.hora.slice(0, 5)} con ${choque.apellido}, que se pisa con este horario.`,
      };
    }

    const [r] = await conexion.query(
      `INSERT INTO turnos (medico_id, paciente_id, fecha, hora, duracion_min, estado, motivo, creado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [medicoId, pacienteId, fecha, `${hora}:00`, slot.duracion_min, estado, motivo || null, creadoPor]
    );
    await conexion.commit();
    return { turnoId: r.insertId };
  } catch (err) {
    await conexion.rollback();
    if (err.code === 'ER_DUP_ENTRY') return { codigo: 409, error: 'Ese horario acaba de ser ocupado por otro turno. Elegí otro.' };
    throw err;
  }
}

module.exports = { reservarTurno, choquePaciente, esFuturo, aMin };
