const express = require('express');
const pool = require('../db');
const { verificarToken, permitir } = require('../middleware/auth');
const { fechaValida, diasEntre } = require('../fechas');
const { contarTurnosFuturos, textoTurnos } = require('../turnos-futuros');

const router = express.Router();

// Todo lo de acá es solo para la secretaría
router.use(verificarToken, permitir('secretaria'));

const DIAS = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const DURACIONES = [10, 15, 20, 30, 40, 45, 60];

function entero(valor) {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// "08:30" o "08:30:00" -> 510 minutos (o null si no es una hora válida)
function aMinutos(texto) {
  const m = /^(\d{2}):(\d{2})(?::00)?$/.exec(typeof texto === 'string' ? texto : '');
  if (!m) return null;
  const horas = Number(m[1]);
  const minutos = Number(m[2]);
  return horas <= 23 && minutos <= 59 ? horas * 60 + minutos : null;
}

const aHora = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}:00`;
const hhmm = (tiempo) => tiempo.slice(0, 5);

// Valida un bloque horario: fin posterior al inicio y turnos completos
function leerBloque(body) {
  const inicio = aMinutos(body.hora_inicio);
  const fin = aMinutos(body.hora_fin);
  const duracion = Number(body.duracion_min);

  if (inicio === null || fin === null) return { error: 'Ingresá la hora de inicio y la de fin' };
  if (fin <= inicio) return { error: 'La hora de fin tiene que ser posterior a la de inicio' };
  if (!DURACIONES.includes(duracion)) return { error: 'Elegí una duración de turno válida' };
  if ((fin - inicio) % duracion !== 0) {
    return {
      error: `De ${hhmm(aHora(inicio))} a ${hhmm(aHora(fin))} no entran turnos exactos de ${duracion} minutos. Probá con otro horario u otra duración.`,
    };
  }
  return { inicio, fin, duracion };
}

// ¿Hay otro bloque vigente del mismo médico y día que se pise con este?
async function buscarChoque(conexion, medicoId, dia, inicio, fin, ignorarId) {
  const [filas] = await conexion.query(
    `SELECT hora_inicio, hora_fin FROM horarios
     WHERE medico_id = ? AND dia_semana = ? AND activo = 1 AND hora_inicio < ? AND hora_fin > ? AND id <> ?
     LIMIT 1`,
    [medicoId, dia, aHora(fin), aHora(inicio), ignorarId ?? 0]
  );
  return filas[0] || null;
}

const mensajeChoque = (dia, c) =>
  `Se pisa con otro horario del ${DIAS[dia]}: de ${hhmm(c.hora_inicio)} a ${hhmm(c.hora_fin)}`;

const mensajeTurnos = (n, accion) =>
  `Este horario tiene ${textoTurnos(n)} reservados a partir de ahora. Cancelalos o reprogramalos antes de ${accion}.`;

// ---------- Horarios semanales ----------

router.get('/', async (req, res) => {
  const medicoId = entero(req.query.medico_id);
  if (!medicoId) return res.status(400).json({ error: 'Médico inválido' });

  try {
    // Los eliminados no se muestran (siguen guardados en la base)
    const [filas] = await pool.query(
      `SELECT id, dia_semana, hora_inicio, hora_fin, duracion_min, activo
       FROM horarios WHERE medico_id = ? AND eliminado = 0 ORDER BY activo DESC, dia_semana, hora_inicio`,
      [medicoId]
    );
    res.json(
      filas.map((f) => ({
        id: f.id,
        dia_semana: f.dia_semana,
        hora_inicio: hhmm(f.hora_inicio),
        hora_fin: hhmm(f.hora_fin),
        duracion_min: f.duracion_min,
        activo: Boolean(f.activo),
        turnos: (aMinutos(f.hora_fin) - aMinutos(f.hora_inicio)) / f.duracion_min,
      }))
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Alta de un bloque en uno o varios días a la vez
router.post('/', async (req, res) => {
  const medicoId = entero(req.body.medico_id);
  const dias = Array.isArray(req.body.dias) ? [...new Set(req.body.dias.map(Number))] : [];

  if (!medicoId) return res.status(400).json({ error: 'Médico inválido' });
  if (dias.length === 0 || dias.some((d) => !Number.isInteger(d) || d < 1 || d > 7)) {
    return res.status(400).json({ error: 'Elegí al menos un día de la semana' });
  }
  const { error, inicio, fin, duracion } = leerBloque(req.body);
  if (error) return res.status(400).json({ error });

  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    // Se bloquea al médico para que dos cargas a la vez no se pisen
    const [medico] = await conexion.query('SELECT usuario_id FROM medicos WHERE usuario_id = ? FOR UPDATE', [medicoId]);
    if (medico.length === 0) {
      await conexion.rollback();
      return res.status(404).json({ error: 'Médico no encontrado' });
    }

    for (const dia of dias) {
      const choque = await buscarChoque(conexion, medicoId, dia, inicio, fin, null);
      if (choque) {
        await conexion.rollback();
        return res.status(409).json({ error: mensajeChoque(dia, choque) });
      }
    }
    for (const dia of dias) {
      await conexion.query(
        'INSERT INTO horarios (medico_id, dia_semana, hora_inicio, hora_fin, duracion_min) VALUES (?, ?, ?, ?, ?)',
        [medicoId, dia, aHora(inicio), aHora(fin), duracion]
      );
    }
    await conexion.commit();
    res.status(201).json({ creados: dias.length });
  } catch (err) {
    await conexion.rollback();
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  } finally {
    conexion.release();
  }
});

// Edición de un bloque vigente (si tiene turnos futuros, antes hay que cancelarlos)
router.put('/:id', async (req, res) => {
  const id = entero(req.params.id);
  const dia = Number(req.body.dia_semana);
  if (!id) return res.status(400).json({ error: 'Horario inválido' });
  if (!Number.isInteger(dia) || dia < 1 || dia > 7) return res.status(400).json({ error: 'Elegí un día de la semana' });
  const { error, inicio, fin, duracion } = leerBloque(req.body);
  if (error) return res.status(400).json({ error });

  const conexion = await pool.getConnection();
  try {
    const [previo] = await conexion.query(
      'SELECT medico_id, dia_semana, hora_inicio, hora_fin, activo FROM horarios WHERE id = ? AND eliminado = 0',
      [id]
    );
    if (previo.length === 0) return res.status(404).json({ error: 'Horario no encontrado' });
    const p = previo[0];
    if (!p.activo) return res.status(409).json({ error: 'Reactivá el horario para poder editarlo' });

    const n = await contarTurnosFuturos(conexion, {
      medicoId: p.medico_id,
      dia: p.dia_semana,
      horaInicio: p.hora_inicio,
      horaFin: p.hora_fin,
    });
    if (n > 0) return res.status(409).json({ error: mensajeTurnos(n, 'cambiarlo') });

    await conexion.beginTransaction();
    await conexion.query('SELECT usuario_id FROM medicos WHERE usuario_id = ? FOR UPDATE', [p.medico_id]);

    const choque = await buscarChoque(conexion, p.medico_id, dia, inicio, fin, id);
    if (choque) {
      await conexion.rollback();
      return res.status(409).json({ error: mensajeChoque(dia, choque) });
    }
    await conexion.query(
      'UPDATE horarios SET dia_semana = ?, hora_inicio = ?, hora_fin = ?, duracion_min = ? WHERE id = ?',
      [dia, aHora(inicio), aHora(fin), duracion, id]
    );
    await conexion.commit();
    res.json({ mensaje: 'Horario actualizado' });
  } catch (err) {
    await conexion.rollback();
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  } finally {
    conexion.release();
  }
});

// Desactivar y reactivar un bloque (sigue apareciendo en la lista)
router.put('/:id/estado', async (req, res) => {
  const id = entero(req.params.id);
  if (!id) return res.status(400).json({ error: 'Horario inválido' });
  if (typeof req.body.activo !== 'boolean') return res.status(400).json({ error: 'Falta indicar el estado' });

  const conexion = await pool.getConnection();
  try {
    const [filas] = await conexion.query(
      'SELECT medico_id, dia_semana, hora_inicio, hora_fin FROM horarios WHERE id = ? AND eliminado = 0',
      [id]
    );
    if (filas.length === 0) return res.status(404).json({ error: 'Horario no encontrado' });
    const h = filas[0];

    if (!req.body.activo) {
      const n = await contarTurnosFuturos(conexion, {
        medicoId: h.medico_id,
        dia: h.dia_semana,
        horaInicio: h.hora_inicio,
        horaFin: h.hora_fin,
      });
      if (n > 0) return res.status(409).json({ error: mensajeTurnos(n, 'desactivarlo') });

      await conexion.query('UPDATE horarios SET activo = 0 WHERE id = ?', [id]);
      return res.json({ activo: false });
    }

    // Reactivar: no puede pisarse con otro horario vigente
    await conexion.beginTransaction();
    await conexion.query('SELECT usuario_id FROM medicos WHERE usuario_id = ? FOR UPDATE', [h.medico_id]);
    const choque = await buscarChoque(conexion, h.medico_id, h.dia_semana, aMinutos(h.hora_inicio), aMinutos(h.hora_fin), id);
    if (choque) {
      await conexion.rollback();
      return res.status(409).json({ error: mensajeChoque(h.dia_semana, choque) });
    }
    await conexion.query('UPDATE horarios SET activo = 1 WHERE id = ?', [id]);
    await conexion.commit();
    res.json({ activo: true });
  } catch (err) {
    await conexion.rollback();
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  } finally {
    conexion.release();
  }
});

// "Eliminar" un horario: sale de la lista y deja de dar turnos, pero la fila queda guardada
// en la base (marcada como eliminada). Los turnos ya dados conservan su propia fecha y hora.
router.delete('/:id', async (req, res) => {
  const id = entero(req.params.id);
  if (!id) return res.status(400).json({ error: 'Horario inválido' });

  try {
    const [filas] = await pool.query(
      'SELECT medico_id, dia_semana, hora_inicio, hora_fin FROM horarios WHERE id = ? AND eliminado = 0',
      [id]
    );
    if (filas.length === 0) return res.status(404).json({ error: 'Horario no encontrado' });
    const h = filas[0];

    const n = await contarTurnosFuturos(pool, {
      medicoId: h.medico_id,
      dia: h.dia_semana,
      horaInicio: h.hora_inicio,
      horaFin: h.hora_fin,
    });
    if (n > 0) return res.status(409).json({ error: mensajeTurnos(n, 'eliminarlo') });

    await pool.query('UPDATE horarios SET activo = 0, eliminado = 1 WHERE id = ?', [id]);
    res.json({ mensaje: 'Horario eliminado de la lista' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// ---------- Licencias ----------

router.get('/licencias', async (req, res) => {
  const medicoId = entero(req.query.medico_id);
  if (!medicoId) return res.status(400).json({ error: 'Médico inválido' });

  try {
    const [filas] = await pool.query(
      'SELECT id, desde, hasta, motivo, activa FROM licencias WHERE medico_id = ? ORDER BY desde DESC LIMIT 100',
      [medicoId]
    );
    res.json(filas.map((f) => ({ ...f, activa: Boolean(f.activa) })));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.post('/licencias', async (req, res) => {
  const medicoId = entero(req.body.medico_id);
  const { desde, hasta } = req.body;
  const motivo = typeof req.body.motivo === 'string' ? req.body.motivo.trim() : '';

  if (!medicoId) return res.status(400).json({ error: 'Médico inválido' });
  if (!fechaValida(desde) || !fechaValida(hasta)) return res.status(400).json({ error: 'Ingresá las dos fechas' });
  if (hasta < desde) return res.status(400).json({ error: 'La fecha "hasta" no puede ser anterior a "desde"' });
  if (diasEntre(desde, hasta) > 400) return res.status(400).json({ error: 'La licencia no puede durar más de 400 días' });
  if (motivo.length > 100) return res.status(400).json({ error: 'El motivo es demasiado largo (máximo 100 letras)' });

  try {
    const [medico] = await pool.query('SELECT usuario_id FROM medicos WHERE usuario_id = ?', [medicoId]);
    if (medico.length === 0) return res.status(404).json({ error: 'Médico no encontrado' });

    const [choque] = await pool.query(
      'SELECT id FROM licencias WHERE medico_id = ? AND activa = 1 AND desde <= ? AND hasta >= ? LIMIT 1',
      [medicoId, hasta, desde]
    );
    if (choque.length > 0) return res.status(409).json({ error: 'Ya hay una licencia vigente en esas fechas' });

    const n = await contarTurnosFuturos(pool, { medicoId, desde, hasta });
    if (n > 0) {
      return res.status(409).json({
        error: `Hay ${textoTurnos(n)} reservados en esas fechas. Cancelalos o reprogramalos antes de cargar la licencia.`,
      });
    }

    await pool.query('INSERT INTO licencias (medico_id, desde, hasta, motivo) VALUES (?, ?, ?, ?)', [
      medicoId,
      desde,
      hasta,
      motivo || null,
    ]);
    res.status(201).json({ mensaje: 'Licencia cargada' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Cancelar y reactivar una licencia: queda guardada
router.put('/licencias/:id/estado', async (req, res) => {
  const id = entero(req.params.id);
  if (!id) return res.status(400).json({ error: 'Licencia inválida' });
  if (typeof req.body.activa !== 'boolean') return res.status(400).json({ error: 'Falta indicar el estado' });

  try {
    const [filas] = await pool.query('SELECT medico_id, desde, hasta FROM licencias WHERE id = ?', [id]);
    if (filas.length === 0) return res.status(404).json({ error: 'Licencia no encontrada' });
    const l = filas[0];

    if (req.body.activa) {
      const [choque] = await pool.query(
        'SELECT id FROM licencias WHERE medico_id = ? AND activa = 1 AND desde <= ? AND hasta >= ? AND id <> ? LIMIT 1',
        [l.medico_id, l.hasta, l.desde, id]
      );
      if (choque.length > 0) return res.status(409).json({ error: 'Se pisa con otra licencia vigente de ese médico' });

      const n = await contarTurnosFuturos(pool, { medicoId: l.medico_id, desde: l.desde, hasta: l.hasta });
      if (n > 0) {
        return res.status(409).json({
          error: `Hay ${textoTurnos(n)} reservados en esas fechas. Cancelalos o reprogramalos antes de reactivar la licencia.`,
        });
      }
    }

    await pool.query('UPDATE licencias SET activa = ? WHERE id = ?', [req.body.activa ? 1 : 0, id]);
    res.json({ activa: req.body.activa });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// ---------- Feriados y días sin atención (valen para todos los médicos) ----------

router.get('/feriados', async (req, res) => {
  try {
    const [filas] = await pool.query(
      `SELECT id, fecha, descripcion, activo FROM feriados
       WHERE fecha >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
       ORDER BY fecha LIMIT 200`
    );
    res.json(filas.map((f) => ({ ...f, activo: Boolean(f.activo) })));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.post('/feriados', async (req, res) => {
  const { fecha } = req.body;
  const descripcion = typeof req.body.descripcion === 'string' ? req.body.descripcion.trim() : '';

  if (!fechaValida(fecha)) return res.status(400).json({ error: 'Ingresá una fecha válida' });
  if (descripcion.length < 2 || descripcion.length > 100) {
    return res.status(400).json({ error: 'Escribí una descripción (entre 2 y 100 letras)' });
  }

  try {
    const n = await contarTurnosFuturos(pool, { desde: fecha, hasta: fecha });
    if (n > 0) {
      return res.status(409).json({
        error: `Hay ${textoTurnos(n)} reservados ese día. Cancelalos o reprogramalos antes de cargar el feriado.`,
      });
    }

    await pool.query('INSERT INTO feriados (fecha, descripcion) VALUES (?, ?)', [fecha, descripcion]);
    res.status(201).json({ mensaje: 'Feriado cargado' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Esa fecha ya está cargada. Si está desactivada, reactivala desde la lista.' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Corregir la fecha o la descripción de un feriado (por ejemplo, un error de tipeo)
router.put('/feriados/:id', async (req, res) => {
  const id = entero(req.params.id);
  const { fecha } = req.body;
  const descripcion = typeof req.body.descripcion === 'string' ? req.body.descripcion.trim() : '';

  if (!id) return res.status(400).json({ error: 'Feriado inválido' });
  if (!fechaValida(fecha)) return res.status(400).json({ error: 'Ingresá una fecha válida' });
  if (descripcion.length < 2 || descripcion.length > 100) {
    return res.status(400).json({ error: 'Escribí una descripción (entre 2 y 100 letras)' });
  }

  try {
    const [filas] = await pool.query('SELECT fecha, activo FROM feriados WHERE id = ?', [id]);
    if (filas.length === 0) return res.status(404).json({ error: 'Feriado no encontrado' });
    const actual = filas[0];

    // Si está vigente y cambia de fecha, la fecha nueva no puede tener turnos reservados
    if (actual.activo && actual.fecha !== fecha) {
      const n = await contarTurnosFuturos(pool, { desde: fecha, hasta: fecha });
      if (n > 0) {
        return res.status(409).json({
          error: `Hay ${textoTurnos(n)} reservados el día nuevo. Cancelalos o reprogramalos antes de moverle el feriado.`,
        });
      }
    }

    await pool.query('UPDATE feriados SET fecha = ?, descripcion = ? WHERE id = ?', [fecha, descripcion, id]);
    res.json({ mensaje: 'Feriado actualizado' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ya hay otro feriado cargado en esa fecha' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Desactivar y reactivar un feriado: queda guardado
router.put('/feriados/:id/estado', async (req, res) => {
  const id = entero(req.params.id);
  if (!id) return res.status(400).json({ error: 'Feriado inválido' });
  if (typeof req.body.activo !== 'boolean') return res.status(400).json({ error: 'Falta indicar el estado' });

  try {
    const [filas] = await pool.query('SELECT fecha FROM feriados WHERE id = ?', [id]);
    if (filas.length === 0) return res.status(404).json({ error: 'Feriado no encontrado' });

    if (req.body.activo) {
      const n = await contarTurnosFuturos(pool, { desde: filas[0].fecha, hasta: filas[0].fecha });
      if (n > 0) {
        return res.status(409).json({
          error: `Hay ${textoTurnos(n)} reservados ese día. Cancelalos o reprogramalos antes de reactivar el feriado.`,
        });
      }
    }

    await pool.query('UPDATE feriados SET activo = ? WHERE id = ?', [req.body.activo ? 1 : 0, id]);
    res.json({ activo: req.body.activo });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;