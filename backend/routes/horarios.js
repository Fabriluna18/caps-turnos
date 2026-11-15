const express = require('express');
const pool = require('../db');
const { verificarToken, permitir } = require('../middleware/auth');

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

function fechaValida(f) {
  if (typeof f !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(f)) return false;
  const d = new Date(`${f}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === f;
}

const diasEntre = (desde, hasta) =>
  Math.round((new Date(`${hasta}T00:00:00Z`) - new Date(`${desde}T00:00:00Z`)) / 86400000);

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

// ¿Hay otro bloque del mismo médico y día que se pise con este?
async function buscarChoque(conexion, medicoId, dia, inicio, fin, ignorarId) {
  const [filas] = await conexion.query(
    `SELECT hora_inicio, hora_fin FROM horarios
     WHERE medico_id = ? AND dia_semana = ? AND hora_inicio < ? AND hora_fin > ? AND id <> ?
     LIMIT 1`,
    [medicoId, dia, aHora(fin), aHora(inicio), ignorarId ?? 0]
  );
  return filas[0] || null;
}

const mensajeChoque = (dia, c) =>
  `Se pisa con otro horario del ${DIAS[dia]}: de ${hhmm(c.hora_inicio)} a ${hhmm(c.hora_fin)}`;

// ---------- Horarios semanales ----------

router.get('/', async (req, res) => {
  const medicoId = entero(req.query.medico_id);
  if (!medicoId) return res.status(400).json({ error: 'Médico inválido' });

  try {
    const [filas] = await pool.query(
      `SELECT id, dia_semana, hora_inicio, hora_fin, duracion_min
       FROM horarios WHERE medico_id = ? ORDER BY dia_semana, hora_inicio`,
      [medicoId]
    );
    res.json(
      filas.map((f) => ({
        id: f.id,
        dia_semana: f.dia_semana,
        hora_inicio: hhmm(f.hora_inicio),
        hora_fin: hhmm(f.hora_fin),
        duracion_min: f.duracion_min,
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

// Edición de un bloque
router.put('/:id', async (req, res) => {
  const id = entero(req.params.id);
  const dia = Number(req.body.dia_semana);
  if (!id) return res.status(400).json({ error: 'Horario inválido' });
  if (!Number.isInteger(dia) || dia < 1 || dia > 7) return res.status(400).json({ error: 'Elegí un día de la semana' });
  const { error, inicio, fin, duracion } = leerBloque(req.body);
  if (error) return res.status(400).json({ error });

  const conexion = await pool.getConnection();
  try {
    const [previo] = await conexion.query('SELECT medico_id FROM horarios WHERE id = ?', [id]);
    if (previo.length === 0) return res.status(404).json({ error: 'Horario no encontrado' });
    const medicoId = previo[0].medico_id;

    await conexion.beginTransaction();
    await conexion.query('SELECT usuario_id FROM medicos WHERE usuario_id = ? FOR UPDATE', [medicoId]);

    const choque = await buscarChoque(conexion, medicoId, dia, inicio, fin, id);
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

router.delete('/:id', async (req, res) => {
  const id = entero(req.params.id);
  if (!id) return res.status(400).json({ error: 'Horario inválido' });

  try {
    // Cuando existan los turnos (Día 8), acá se va a bloquear si hay turnos futuros
    const [r] = await pool.query('DELETE FROM horarios WHERE id = ?', [id]);
    if (r.affectedRows === 0) return res.status(404).json({ error: 'Horario no encontrado' });
    res.json({ mensaje: 'Horario eliminado' });
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
      'SELECT id, desde, hasta, motivo FROM licencias WHERE medico_id = ? ORDER BY desde DESC LIMIT 100',
      [medicoId]
    );
    res.json(filas);
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
      'SELECT id FROM licencias WHERE medico_id = ? AND desde <= ? AND hasta >= ? LIMIT 1',
      [medicoId, hasta, desde]
    );
    if (choque.length > 0) return res.status(409).json({ error: 'Ya hay una licencia cargada en esas fechas' });

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

router.delete('/licencias/:id', async (req, res) => {
  const id = entero(req.params.id);
  if (!id) return res.status(400).json({ error: 'Licencia inválida' });

  try {
    const [r] = await pool.query('DELETE FROM licencias WHERE id = ?', [id]);
    if (r.affectedRows === 0) return res.status(404).json({ error: 'Licencia no encontrada' });
    res.json({ mensaje: 'Licencia eliminada' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// ---------- Feriados y días sin atención (valen para todos los médicos) ----------

router.get('/feriados', async (req, res) => {
  try {
    const [filas] = await pool.query(
      `SELECT id, fecha, descripcion FROM feriados
       WHERE fecha >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
       ORDER BY fecha LIMIT 200`
    );
    res.json(filas);
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
    await pool.query('INSERT INTO feriados (fecha, descripcion) VALUES (?, ?)', [fecha, descripcion]);
    res.status(201).json({ mensaje: 'Feriado cargado' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Esa fecha ya está cargada' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.delete('/feriados/:id', async (req, res) => {
  const id = entero(req.params.id);
  if (!id) return res.status(400).json({ error: 'Feriado inválido' });

  try {
    const [r] = await pool.query('DELETE FROM feriados WHERE id = ?', [id]);
    if (r.affectedRows === 0) return res.status(404).json({ error: 'Feriado no encontrado' });
    res.json({ mensaje: 'Feriado eliminado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;