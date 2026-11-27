const express = require('express');
const pool = require('../db');
const { verificarToken, permitir } = require('../middleware/auth');
const { ahora } = require('../fechas');

const router = express.Router();

// Solo médicos y pacientes. La secretaría no ve recetas (son datos clínicos).
router.use(verificarToken, permitir('medico', 'paciente'));

const POR_PAGINA = 10;
const MAX_ITEMS = 5;

const idValido = (v) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};
const texto = (v) => (typeof v === 'string' ? v.trim() : '');
const escaparLike = (t) => t.replace(/[\\%_]/g, '\\$&');

function leerReceta(body) {
  const diagnostico = texto(body.diagnostico);
  const indicaciones = texto(body.indicaciones);
  if (diagnostico.length > 200) return { error: 'El diagnóstico es demasiado largo (máximo 200 letras)' };
  if (indicaciones.length > 1000) return { error: 'Las indicaciones son demasiado largas (máximo 1000 letras)' };
  if (!Array.isArray(body.items)) return { error: 'Agregá al menos un medicamento' };

  const items = body.items
    .map((i) => ({
      medicamento: texto(i?.medicamento),
      presentacion: texto(i?.presentacion),
      dosis: texto(i?.dosis),
      cantidad: texto(i?.cantidad),
    }))
    .filter((i) => i.medicamento || i.presentacion || i.dosis || i.cantidad); // filas vacías se ignoran

  if (items.length === 0) return { error: 'Agregá al menos un medicamento' };
  if (items.length > MAX_ITEMS) return { error: `Máximo ${MAX_ITEMS} medicamentos por receta` };
  for (const [n, i] of items.entries()) {
    const fila = `Medicamento ${n + 1}`;
    if (i.medicamento.length < 2 || i.medicamento.length > 150) return { error: `${fila}: escribí el nombre (hasta 150 letras)` };
    if (i.presentacion.length > 100) return { error: `${fila}: la presentación es demasiado larga` };
    if (i.dosis.length < 2 || i.dosis.length > 150) return { error: `${fila}: indicá cómo tomarlo (hasta 150 letras)` };
    if (i.cantidad.length > 50) return { error: `${fila}: la cantidad es demasiado larga` };
  }
  return { datos: { diagnostico: diagnostico || null, indicaciones: indicaciones || null, items } };
}

// Quién puede ver una receta: el médico que la hizo o el paciente al que es
const condicionDueno = (u) => (u.rol === 'medico' ? 'r.medico_id = ?' : 'r.paciente_id = ?');

// Crear (solo el médico, desde un turno suyo que esté en atención o atendido)
router.post('/', permitir('medico'), async (req, res) => {
  const turnoId = idValido(req.body.turno_id);
  if (!turnoId) return res.status(400).json({ error: 'Falta indicar el turno' });
  const { datos, error } = leerReceta(req.body);
  if (error) return res.status(400).json({ error });

  const conexion = await pool.getConnection();
  try {
    const [turnos] = await conexion.query(
      'SELECT id, paciente_id, estado, fecha FROM turnos WHERE id = ? AND medico_id = ?',
      [turnoId, req.usuario.id]
    );
    const t = turnos[0];
    if (!t) return res.status(404).json({ error: 'Turno no encontrado' });
    if (!['en_atencion', 'atendido'].includes(t.estado)) {
      return res.status(409).json({ error: 'Solo se puede hacer una receta de un turno en atención o atendido' });
    }

    await conexion.beginTransaction();
    const [r] = await conexion.query(
      `INSERT INTO recetas (turno_id, medico_id, paciente_id, fecha, diagnostico, indicaciones)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [turnoId, req.usuario.id, t.paciente_id, ahora().fecha, datos.diagnostico, datos.indicaciones]
    );
    for (const [n, i] of datos.items.entries()) {
      await conexion.query(
        'INSERT INTO receta_items (receta_id, orden, medicamento, presentacion, dosis, cantidad) VALUES (?, ?, ?, ?, ?, ?)',
        [r.insertId, n + 1, i.medicamento, i.presentacion || null, i.dosis, i.cantidad || null]
      );
    }
    await conexion.commit();
    res.status(201).json({ id: r.insertId });
  } catch (err) {
    await conexion.rollback();
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  } finally {
    conexion.release();
  }
});

// Lista: el médico ve las que hizo (puede buscar por paciente); el paciente, las suyas
router.get('/', async (req, res) => {
  const pagina = Math.max(1, Number.parseInt(req.query.pagina, 10) || 1);
  const condiciones = [condicionDueno(req.usuario)];
  const valores = [req.usuario.id];

  const q = req.usuario.rol === 'medico' ? texto(req.query.q).slice(0, 60) : '';
  if (q) {
    const patron = `%${escaparLike(q)}%`;
    const partes = ['up.apellido LIKE ?', 'up.nombre LIKE ?', "CONCAT(up.apellido, ' ', up.nombre) LIKE ?"];
    valores.push(patron, patron, patron);
    const digitos = q.replace(/\D/g, '');
    if (digitos) {
      partes.push('up.dni LIKE ?');
      valores.push(`%${digitos}%`);
    }
    condiciones.push(`(${partes.join(' OR ')})`);
  }
  const turnoId = idValido(req.query.turno_id);
  if (turnoId) {
    condiciones.push('r.turno_id = ?');
    valores.push(turnoId);
  }
  // Cuántas hay de cada grupo (con la búsqueda aplicada), para las pestañas "Vigentes" / "Anuladas"
  const dondeSinEstado = condiciones.join(' AND ');
  // anuladas=0 → solo las vigentes; anuladas=1 → solo las anuladas; sin el parámetro → todas
  if (req.query.anuladas === '0' || req.query.anuladas === '1') {
    condiciones.push(`r.anulada = ${req.query.anuladas === '1' ? 1 : 0}`);
  }
  const donde = condiciones.join(' AND ');

  try {
    const [[cuentas]] = await pool.query(
      `SELECT COALESCE(SUM(r.anulada = 0), 0) AS vigentes, COALESCE(SUM(r.anulada = 1), 0) AS anuladas
       FROM recetas r JOIN usuarios up ON up.id = r.paciente_id WHERE ${dondeSinEstado}`,
      valores
    );
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM recetas r JOIN usuarios up ON up.id = r.paciente_id WHERE ${donde}`,
      valores
    );
    const [filas] = await pool.query(
      `SELECT r.id, r.fecha, r.diagnostico, r.anulada,
              up.nombre AS p_nombre, up.apellido AS p_apellido, up.dni AS p_dni,
              um.nombre AS m_nombre, um.apellido AS m_apellido, e.nombre AS especialidad,
              (SELECT GROUP_CONCAT(i.medicamento ORDER BY i.orden SEPARATOR ', ') FROM receta_items i WHERE i.receta_id = r.id) AS medicamentos
       FROM recetas r
       JOIN usuarios up ON up.id = r.paciente_id
       JOIN usuarios um ON um.id = r.medico_id
       JOIN medicos m ON m.usuario_id = r.medico_id
       JOIN especialidades e ON e.id = m.especialidad_id
       WHERE ${donde}
       ORDER BY r.fecha DESC, r.id DESC LIMIT ? OFFSET ?`,
      [...valores, POR_PAGINA, (pagina - 1) * POR_PAGINA]
    );
    res.json({
      total: Number(total),
      total_vigentes: Number(cuentas.vigentes),
      total_anuladas: Number(cuentas.anuladas),
      pagina,
      por_pagina: POR_PAGINA,
      items: filas.map((f) => ({
        id: f.id,
        fecha: f.fecha,
        diagnostico: f.diagnostico,
        anulada: Boolean(f.anulada),
        medicamentos: f.medicamentos,
        paciente: { nombre: f.p_nombre, apellido: f.p_apellido, dni: f.p_dni },
        medico: { nombre: f.m_nombre, apellido: f.m_apellido, especialidad: f.especialidad },
      })),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Una receta completa, para verla o imprimirla
router.get('/:id', async (req, res) => {
  const id = idValido(req.params.id);
  if (!id) return res.status(400).json({ error: 'Receta inválida' });
  try {
    const [filas] = await pool.query(
      `SELECT r.id, r.fecha, r.diagnostico, r.indicaciones, r.anulada, r.anulada_en,
              up.nombre AS p_nombre, up.apellido AS p_apellido, up.dni AS p_dni,
              p.fecha_nacimiento, p.cobertura,
              um.nombre AS m_nombre, um.apellido AS m_apellido, m.matricula, e.nombre AS especialidad
       FROM recetas r
       JOIN usuarios up ON up.id = r.paciente_id
       LEFT JOIN pacientes p ON p.usuario_id = r.paciente_id
       JOIN usuarios um ON um.id = r.medico_id
       JOIN medicos m ON m.usuario_id = r.medico_id
       JOIN especialidades e ON e.id = m.especialidad_id
       WHERE r.id = ? AND ${condicionDueno(req.usuario)}`,
      [id, req.usuario.id]
    );
    const f = filas[0];
    if (!f) return res.status(404).json({ error: 'Receta no encontrada' });
    const [items] = await pool.query(
      'SELECT medicamento, presentacion, dosis, cantidad FROM receta_items WHERE receta_id = ? ORDER BY orden',
      [id]
    );
    res.json({
      id: f.id,
      fecha: f.fecha,
      diagnostico: f.diagnostico,
      indicaciones: f.indicaciones,
      anulada: Boolean(f.anulada),
      anulada_en: f.anulada_en,
      items,
      paciente: { nombre: f.p_nombre, apellido: f.p_apellido, dni: f.p_dni, fecha_nacimiento: f.fecha_nacimiento, cobertura: f.cobertura },
      medico: { nombre: f.m_nombre, apellido: f.m_apellido, matricula: f.matricula, especialidad: f.especialidad },
      puede_anular: req.usuario.rol === 'medico' && !f.anulada,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Anular: la receta queda guardada, marcada como anulada (no se borra ni se edita)
router.put('/:id/anular', permitir('medico'), async (req, res) => {
  const id = idValido(req.params.id);
  if (!id) return res.status(400).json({ error: 'Receta inválida' });
  try {
    const [u] = await pool.query(
      'UPDATE recetas SET anulada = 1, anulada_en = NOW() WHERE id = ? AND medico_id = ? AND anulada = 0',
      [id, req.usuario.id]
    );
    if (u.affectedRows === 0) {
      const [existe] = await pool.query('SELECT anulada FROM recetas WHERE id = ? AND medico_id = ?', [id, req.usuario.id]);
      if (existe.length === 0) return res.status(404).json({ error: 'Receta no encontrada' });
      return res.status(409).json({ error: 'Esta receta ya estaba anulada' });
    }
    res.json({ anulada: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;
