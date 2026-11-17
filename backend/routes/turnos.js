const express = require('express');
const pool = require('../db');
const { verificarToken, permitir } = require('../middleware/auth');
const { ahora, fechaValida, diasEntre } = require('../fechas');
const { medicoActivo, disponibilidadDelDia } = require('../disponibilidad');

const router = express.Router();

// Por ahora los turnos los maneja solo la secretaría (el paciente saca los suyos en el Día 10)
router.use(verificarToken, permitir('secretaria'));

const POR_PAGINA = 15;
const ESTADOS = ['pendiente', 'confirmado', 'en_atencion', 'atendido', 'cancelado', 'ausente'];
const ESTADO_TEXTO = {
  pendiente: 'pendiente',
  confirmado: 'confirmado',
  en_atencion: 'en atención',
  atendido: 'atendido',
  cancelado: 'cancelado',
  ausente: 'ausente',
};

function idValido(valor) {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// Para buscar texto literal con LIKE (que % y _ no actúen como comodines)
const escaparLike = (texto) => texto.replace(/[\\%_]/g, '\\$&');

// "09:30" o "09:30:00" -> 570
const aMin = (hora) => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5));

// ¿El turno todavía no empezó? (hora argentina)
function esFuturo(fecha, hora) {
  const a = ahora();
  return fecha > a.fecha || (fecha === a.fecha && aMin(hora) > a.minutos);
}

const SELECT_TURNO = `
  SELECT t.id, t.fecha, t.hora, t.duracion_min, t.estado, t.motivo,
         t.paciente_id, up.nombre AS paciente_nombre, up.apellido AS paciente_apellido, up.dni AS paciente_dni,
         t.medico_id, um.nombre AS medico_nombre, um.apellido AS medico_apellido, e.nombre AS especialidad
  FROM turnos t
  JOIN usuarios up ON up.id = t.paciente_id
  JOIN usuarios um ON um.id = t.medico_id
  JOIN medicos m ON m.usuario_id = t.medico_id
  JOIN especialidades e ON e.id = m.especialidad_id`;

function aRespuesta(f) {
  return {
    id: f.id,
    fecha: f.fecha,
    hora: f.hora.slice(0, 5),
    duracion_min: f.duracion_min,
    estado: f.estado,
    motivo: f.motivo,
    paciente: { id: f.paciente_id, nombre: f.paciente_nombre, apellido: f.paciente_apellido, dni: f.paciente_dni },
    medico: { id: f.medico_id, nombre: f.medico_nombre, apellido: f.medico_apellido, especialidad: f.especialidad },
    modificable: ['pendiente', 'confirmado'].includes(f.estado) && esFuturo(f.fecha, f.hora),
  };
}

async function buscarTurno(id) {
  const [filas] = await pool.query(`${SELECT_TURNO} WHERE t.id = ?`, [id]);
  return filas[0] ? aRespuesta(filas[0]) : null;
}

// Trae un turno y verifica que se pueda tocar: estado permitido y que todavía no haya empezado
async function turnoModificable(conexion, id, estadosPermitidos, accion, bloquear = false) {
  const [filas] = await conexion.query(
    `SELECT id, medico_id, paciente_id, fecha, hora, estado FROM turnos WHERE id = ?${bloquear ? ' FOR UPDATE' : ''}`,
    [id]
  );
  if (filas.length === 0) return { codigo: 404, error: 'Turno no encontrado' };
  const t = filas[0];
  if (!estadosPermitidos.includes(t.estado)) {
    return { codigo: 409, error: `Este turno está ${ESTADO_TEXTO[t.estado]}, así que no se puede ${accion}.` };
  }
  if (!esFuturo(t.fecha, t.hora)) {
    return { codigo: 409, error: `Ese turno ya pasó, así que no se puede ${accion}.` };
  }
  return { turno: t };
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

const mensajeChoquePaciente = (c) =>
  `El paciente ya tiene un turno ese día a las ${c.hora.slice(0, 5)} con ${c.apellido}, que se pisa con este horario.`;

const leerHora = (valor) => (typeof valor === 'string' ? valor.slice(0, 5) : '');

// Lista con filtros y páginas
router.get('/', async (req, res) => {
  const { desde, hasta } = req.query;
  if (!fechaValida(desde) || !fechaValida(hasta) || hasta < desde || diasEntre(desde, hasta) > 366) {
    return res.status(400).json({ error: 'Elegí un rango de fechas válido (hasta un año)' });
  }
  const estado = ESTADOS.includes(req.query.estado) ? req.query.estado : 'todos';
  const medicoId = idValido(req.query.medico_id);
  const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 60) : '';
  const pagina = Math.max(1, Number.parseInt(req.query.pagina, 10) || 1);

  const condiciones = ['t.fecha BETWEEN ? AND ?'];
  const valores = [desde, hasta];
  if (medicoId) {
    condiciones.push('t.medico_id = ?');
    valores.push(medicoId);
  }
  if (estado !== 'todos') {
    condiciones.push('t.estado = ?');
    valores.push(estado);
  }
  if (q) {
    const patron = `%${escaparLike(q)}%`;
    const digitos = q.replace(/\D/g, '');
    const partes = ['up.apellido LIKE ?', 'up.nombre LIKE ?', "CONCAT(up.apellido, ' ', up.nombre) LIKE ?"];
    valores.push(patron, patron, patron);
    if (digitos) {
      partes.push('up.dni LIKE ?');
      valores.push(`%${digitos}%`);
    }
    condiciones.push(`(${partes.join(' OR ')})`);
  }
  const donde = condiciones.join(' AND ');

  try {
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM turnos t JOIN usuarios up ON up.id = t.paciente_id WHERE ${donde}`,
      valores
    );
    const [filas] = await pool.query(
      `${SELECT_TURNO} WHERE ${donde} ORDER BY t.fecha, t.hora LIMIT ? OFFSET ?`,
      [...valores, POR_PAGINA, (pagina - 1) * POR_PAGINA]
    );
    res.json({ total: Number(total), pagina, por_pagina: POR_PAGINA, items: filas.map(aRespuesta) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Reservar un turno
router.post('/', async (req, res) => {
  const medicoId = idValido(req.body.medico_id);
  const pacienteId = idValido(req.body.paciente_id);
  const { fecha } = req.body;
  const hora = leerHora(req.body.hora);
  const motivo = typeof req.body.motivo === 'string' ? req.body.motivo.trim() : '';
  const estado = req.body.confirmado === true ? 'confirmado' : 'pendiente';

  if (!medicoId || !pacienteId) return res.status(400).json({ error: 'Elegí el paciente y el médico' });
  if (!fechaValida(fecha) || !/^\d{2}:\d{2}$/.test(hora)) return res.status(400).json({ error: 'Elegí el día y el horario' });
  if (motivo.length > 150) return res.status(400).json({ error: 'El motivo es demasiado largo (máximo 150 letras)' });

  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    // Se bloquea al médico: dos reservas a la vez para el mismo médico se procesan de a una
    const [medico] = await conexion.query('SELECT usuario_id FROM medicos WHERE usuario_id = ? FOR UPDATE', [medicoId]);
    if (medico.length === 0) {
      await conexion.rollback();
      return res.status(404).json({ error: 'Médico no encontrado' });
    }
    if (!(await medicoActivo(conexion, medicoId))) {
      await conexion.rollback();
      return res.status(409).json({ error: 'Ese médico está de baja' });
    }

    const [paciente] = await conexion.query(
      'SELECT u.id FROM usuarios u JOIN pacientes p ON p.usuario_id = u.id WHERE u.id = ? AND u.activo = 1',
      [pacienteId]
    );
    if (paciente.length === 0) {
      await conexion.rollback();
      return res.status(404).json({ error: 'Paciente no encontrado o dado de baja' });
    }

    // El horario tiene que estar libre según el mismo cálculo que ve el calendario
    const dia = await disponibilidadDelDia(conexion, medicoId, fecha);
    const slot = dia.turnos.find((t) => t.hora === hora);
    if (!slot) {
      await conexion.rollback();
      return res.status(409).json({ error: dia.mensaje || 'Ese horario no está disponible' });
    }
    if (!slot.libre) {
      await conexion.rollback();
      return res.status(409).json({ error: 'Ese horario ya está ocupado. Elegí otro.' });
    }

    const choque = await choquePaciente(conexion, pacienteId, fecha, hora, slot.duracion_min, null);
    if (choque) {
      await conexion.rollback();
      return res.status(409).json({ error: mensajeChoquePaciente(choque) });
    }

    const [r] = await conexion.query(
      `INSERT INTO turnos (medico_id, paciente_id, fecha, hora, duracion_min, estado, motivo, creado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [medicoId, pacienteId, fecha, `${hora}:00`, slot.duracion_min, estado, motivo || null, req.usuario.id]
    );
    await conexion.commit();

    res.status(201).json({ turno: await buscarTurno(r.insertId) });
  } catch (err) {
    await conexion.rollback();
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ese horario acaba de ser ocupado por otro turno. Elegí otro.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  } finally {
    conexion.release();
  }
});

// Confirmar (el paciente avisó que va)
router.put('/:id/confirmar', async (req, res) => {
  const id = idValido(req.params.id);
  if (!id) return res.status(400).json({ error: 'Turno inválido' });

  try {
    const r = await turnoModificable(pool, id, ['pendiente'], 'confirmar');
    if (r.error) return res.status(r.codigo).json({ error: r.error });

    const [u] = await pool.query("UPDATE turnos SET estado = 'confirmado' WHERE id = ? AND estado = 'pendiente'", [id]);
    if (u.affectedRows === 0) return res.status(409).json({ error: 'El turno cambió de estado. Recargá la lista.' });
    res.json({ estado: 'confirmado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Cancelar: el turno queda guardado como cancelado y el horario vuelve a estar libre
router.put('/:id/cancelar', async (req, res) => {
  const id = idValido(req.params.id);
  if (!id) return res.status(400).json({ error: 'Turno inválido' });

  try {
    const r = await turnoModificable(pool, id, ['pendiente', 'confirmado'], 'cancelar');
    if (r.error) return res.status(r.codigo).json({ error: r.error });

    const [u] = await pool.query(
      "UPDATE turnos SET estado = 'cancelado', cancelado_en = NOW() WHERE id = ? AND estado IN ('pendiente', 'confirmado')",
      [id]
    );
    if (u.affectedRows === 0) return res.status(409).json({ error: 'El turno cambió de estado. Recargá la lista.' });
    res.json({ estado: 'cancelado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Reprogramar: pasa el turno a otro día u horario del mismo médico (queda pendiente de confirmar)
router.put('/:id/reprogramar', async (req, res) => {
  const id = idValido(req.params.id);
  const { fecha } = req.body;
  const hora = leerHora(req.body.hora);
  if (!id) return res.status(400).json({ error: 'Turno inválido' });
  if (!fechaValida(fecha) || !/^\d{2}:\d{2}$/.test(hora)) {
    return res.status(400).json({ error: 'Elegí el día y el horario nuevos' });
  }

  // Lectura previa, fuera de la transacción, para saber de qué médico es el turno
  const previo = await turnoModificable(pool, id, ['pendiente', 'confirmado'], 'reprogramar');
  if (previo.error) return res.status(previo.codigo).json({ error: previo.error });
  const medicoId = previo.turno.medico_id;

  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    await conexion.query('SELECT usuario_id FROM medicos WHERE usuario_id = ? FOR UPDATE', [medicoId]);

    // Se vuelve a verificar con el turno bloqueado
    const actual = await turnoModificable(conexion, id, ['pendiente', 'confirmado'], 'reprogramar', true);
    if (actual.error) {
      await conexion.rollback();
      return res.status(actual.codigo).json({ error: actual.error });
    }
    const t = actual.turno;

    if (t.fecha === fecha && t.hora.slice(0, 5) === hora) {
      await conexion.rollback();
      return res.status(400).json({ error: 'Elegiste el mismo horario que ya tenía el turno' });
    }
    if (!(await medicoActivo(conexion, medicoId))) {
      await conexion.rollback();
      return res.status(409).json({ error: 'Ese médico está de baja' });
    }

    const dia = await disponibilidadDelDia(conexion, medicoId, fecha);
    const slot = dia.turnos.find((x) => x.hora === hora);
    if (!slot) {
      await conexion.rollback();
      return res.status(409).json({ error: dia.mensaje || 'Ese horario no está disponible' });
    }
    if (!slot.libre) {
      await conexion.rollback();
      return res.status(409).json({ error: 'Ese horario ya está ocupado. Elegí otro.' });
    }

    const choque = await choquePaciente(conexion, t.paciente_id, fecha, hora, slot.duracion_min, id);
    if (choque) {
      await conexion.rollback();
      return res.status(409).json({ error: mensajeChoquePaciente(choque) });
    }

    await conexion.query(
      "UPDATE turnos SET fecha = ?, hora = ?, duracion_min = ?, estado = 'pendiente' WHERE id = ?",
      [fecha, `${hora}:00`, slot.duracion_min, id]
    );
    await conexion.commit();

    res.json({ turno: await buscarTurno(id) });
  } catch (err) {
    await conexion.rollback();
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ese horario acaba de ser ocupado por otro turno. Elegí otro.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  } finally {
    conexion.release();
  }
});

module.exports = router;