const express = require('express');
const pool = require('../db');
const { verificarToken, permitir } = require('../middleware/auth');

const router = express.Router();

// Solo el médico del turno
router.use(verificarToken, permitir('medico'));

const idValido = (v) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

// Signos vitales: [nombre, mínimo, máximo, decimales permitidos]
const SIGNOS = {
  presion_sistolica: ['Presión máxima', 50, 260, false],
  presion_diastolica: ['Presión mínima', 30, 160, false],
  frecuencia_cardiaca: ['Frecuencia cardíaca', 20, 250, false],
  temperatura: ['Temperatura', 30, 45, true],
  saturacion: ['Saturación', 50, 100, false],
  peso_kg: ['Peso', 0.5, 400, true],
  talla_cm: ['Talla', 30, 250, false],
};
const TEXTOS = { motivo_consulta: ['Motivo', 300], examen_fisico: ['Examen físico', 2000], diagnostico: ['Diagnóstico', 300], indicaciones: ['Indicaciones', 2000] };
const COLUMNAS = [...Object.keys(TEXTOS), ...Object.keys(SIGNOS)];

function leerAtencion(body) {
  const datos = {};
  for (const [campo, [nombre, max]] of Object.entries(TEXTOS)) {
    const v = typeof body[campo] === 'string' ? body[campo].trim() : '';
    if (v.length > max) return { error: `${nombre}: máximo ${max} letras` };
    datos[campo] = v || null;
  }
  for (const [campo, [nombre, min, max, decimales]] of Object.entries(SIGNOS)) {
    const crudo = body[campo];
    if (crudo === null || crudo === undefined || crudo === '') {
      datos[campo] = null;
      continue;
    }
    const n = Number(String(crudo).replace(',', '.'));
    if (!Number.isFinite(n) || (!decimales && !Number.isInteger(n)) || n < min || n > max) {
      return { error: `${nombre}: tiene que estar entre ${min} y ${max}${decimales ? '' : ' (sin decimales)'}` };
    }
    datos[campo] = decimales ? Math.round(n * 10) / 10 : n;
  }
  if ((datos.presion_sistolica === null) !== (datos.presion_diastolica === null)) {
    return { error: 'Cargá la presión completa (máxima y mínima)' };
  }
  if (datos.presion_sistolica !== null && datos.presion_diastolica >= datos.presion_sistolica) {
    return { error: 'La presión mínima tiene que ser menor que la máxima' };
  }
  return { datos };
}

const aRespuesta = (a) =>
  !a ? null : {
    id: a.id,
    ...Object.fromEntries(COLUMNAS.map((c) => [c, a[c] === null ? null : SIGNOS[c] ? Number(a[c]) : a[c]])),
    finalizada: Boolean(a.finalizada),
    finalizada_en: a.finalizada_en,
    actualizado_en: a.actualizado_en,
  };

// Trae el turno (solo si es de este médico)
async function turnoDelMedico(conexion, turnoId, medicoId, bloquear = false) {
  const [filas] = await conexion.query(
    `SELECT id, paciente_id, estado, fecha, hora, motivo FROM turnos WHERE id = ? AND medico_id = ?${bloquear ? ' FOR UPDATE' : ''}`,
    [turnoId, medicoId]
  );
  return filas[0] || null;
}

// Ver la atención de un turno (con lo necesario para hacerla)
router.get('/:turnoId', async (req, res) => {
  const turnoId = idValido(req.params.turnoId);
  if (!turnoId) return res.status(400).json({ error: 'Turno inválido' });
  try {
    const t = await turnoDelMedico(pool, turnoId, req.usuario.id);
    if (!t) return res.status(404).json({ error: 'Turno no encontrado' });

    const [pac] = await pool.query(
      `SELECT u.nombre, u.apellido, u.dni, p.fecha_nacimiento, p.cobertura,
              (SELECT f.alergias FROM fichas f WHERE f.paciente_id = u.id ORDER BY f.id DESC LIMIT 1) AS alergias,
              (SELECT f.medicacion FROM fichas f WHERE f.paciente_id = u.id ORDER BY f.id DESC LIMIT 1) AS medicacion
       FROM usuarios u JOIN pacientes p ON p.usuario_id = u.id WHERE u.id = ?`,
      [t.paciente_id]
    );
    const [at] = await pool.query('SELECT * FROM atenciones WHERE turno_id = ?', [turnoId]);
    const atencion = aRespuesta(at[0]);
    const [notas] = atencion
      ? await pool.query(
          `SELECT n.id, n.texto, n.creado_en, u.apellido FROM atencion_notas n JOIN usuarios u ON u.id = n.creado_por
           WHERE n.atencion_id = ? ORDER BY n.id`,
          [atencion.id]
        )
      : [[]];
    // Últimos valores de peso y talla de este paciente (de cualquier atención anterior), como referencia
    const [prev] = await pool.query(
      `SELECT a.peso_kg, a.talla_cm, t.fecha FROM atenciones a JOIN turnos t ON t.id = a.turno_id
       WHERE a.paciente_id = ? AND a.turno_id <> ? AND a.finalizada = 1 AND (a.peso_kg IS NOT NULL OR a.talla_cm IS NOT NULL)
       ORDER BY t.fecha DESC, t.hora DESC LIMIT 1`,
      [t.paciente_id, turnoId]
    );

    res.json({
      turno: { id: t.id, fecha: t.fecha, hora: t.hora.slice(0, 5), estado: t.estado, motivo: t.motivo },
      paciente: { id: t.paciente_id, ...pac[0] },
      atencion,
      notas: notas.map((n) => ({ id: n.id, texto: n.texto, fecha: n.creado_en, autor: n.apellido })),
      anterior: prev[0] ? { peso_kg: prev[0].peso_kg === null ? null : Number(prev[0].peso_kg), talla_cm: prev[0].talla_cm, fecha: prev[0].fecha } : null,
      editable: t.estado === 'en_atencion' && !(atencion && atencion.finalizada),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Guarda (y opcionalmente finaliza) la atención. Solo mientras el turno está "en atención".
async function guardar(req, res, finalizar) {
  const turnoId = idValido(req.params.turnoId);
  if (!turnoId) return res.status(400).json({ error: 'Turno inválido' });
  const { datos, error } = leerAtencion(req.body);
  if (error) return res.status(400).json({ error });
  if (finalizar && !datos.motivo_consulta && !datos.diagnostico) {
    return res.status(400).json({ error: 'Para finalizar, cargá al menos el motivo o el diagnóstico' });
  }

  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    const t = await turnoDelMedico(conexion, turnoId, req.usuario.id, true);
    if (!t) {
      await conexion.rollback();
      return res.status(404).json({ error: 'Turno no encontrado' });
    }
    const [at] = await conexion.query('SELECT id, finalizada FROM atenciones WHERE turno_id = ? FOR UPDATE', [turnoId]);
    if (at[0]?.finalizada) {
      await conexion.rollback();
      return res.status(409).json({ error: 'Esta atención ya fue finalizada. Para corregir algo, agregá una nota.' });
    }
    if (t.estado !== 'en_atencion') {
      await conexion.rollback();
      return res.status(409).json({ error: 'Para cargar la atención, el turno tiene que estar "En atención". Tocá Atender en la agenda.' });
    }

    const valores = COLUMNAS.map((c) => datos[c]);
    if (at[0]) {
      await conexion.query(
        `UPDATE atenciones SET ${COLUMNAS.map((c) => `${c} = ?`).join(', ')}, actualizado_en = NOW() WHERE id = ?`,
        [...valores, at[0].id]
      );
    } else {
      await conexion.query(
        `INSERT INTO atenciones (turno_id, medico_id, paciente_id, ${COLUMNAS.join(', ')}, actualizado_en)
         VALUES (?, ?, ?, ${COLUMNAS.map(() => '?').join(', ')}, NOW())`,
        [turnoId, req.usuario.id, t.paciente_id, ...valores]
      );
    }
    if (finalizar) {
      await conexion.query('UPDATE atenciones SET finalizada = 1, finalizada_en = NOW() WHERE turno_id = ?', [turnoId]);
      await conexion.query("UPDATE turnos SET estado = 'atendido' WHERE id = ?", [turnoId]);
    }
    await conexion.commit();

    const [fila] = await pool.query('SELECT * FROM atenciones WHERE turno_id = ?', [turnoId]);
    res.json({ atencion: aRespuesta(fila[0]), estado_turno: finalizar ? 'atendido' : t.estado });
  } catch (err) {
    await conexion.rollback();
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  } finally {
    conexion.release();
  }
}

router.put('/:turnoId', (req, res) => guardar(req, res, false));
router.post('/:turnoId/finalizar', (req, res) => guardar(req, res, true));

// Nota agregada a una atención ya finalizada (no se cambia lo escrito: se suma)
router.post('/:turnoId/notas', async (req, res) => {
  const turnoId = idValido(req.params.turnoId);
  if (!turnoId) return res.status(400).json({ error: 'Turno inválido' });
  const texto = typeof req.body.texto === 'string' ? req.body.texto.trim() : '';
  if (texto.length < 3 || texto.length > 1000) return res.status(400).json({ error: 'Escribí la nota (de 3 a 1000 letras)' });
  try {
    const [at] = await pool.query(
      'SELECT id, finalizada FROM atenciones WHERE turno_id = ? AND medico_id = ?',
      [turnoId, req.usuario.id]
    );
    if (!at[0]) return res.status(404).json({ error: 'Atención no encontrada' });
    if (!at[0].finalizada) return res.status(409).json({ error: 'La atención todavía está abierta: editala directamente.' });
    await pool.query('INSERT INTO atencion_notas (atencion_id, texto, creado_por) VALUES (?, ?, ?)', [at[0].id, texto, req.usuario.id]);
    res.status(201).json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;
