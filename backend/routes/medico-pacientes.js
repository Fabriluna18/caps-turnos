const express = require('express');
const pool = require('../db');
const { verificarToken, permitir } = require('../middleware/auth');
const { leerFicha, fichaActual, COLUMNAS } = require('../fichas');

const router = express.Router();

// Solo médicos, y solo sobre SUS pacientes (los que tienen o tuvieron un turno con él)
router.use(verificarToken, permitir('medico'));

const POR_PAGINA = 15;
const idValido = (v) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};
const escaparLike = (t) => t.replace(/[\\%_]/g, '\\$&');

async function esSuPaciente(conexion, medicoId, pacienteId) {
  const [filas] = await conexion.query(
    "SELECT 1 FROM turnos WHERE medico_id = ? AND paciente_id = ? AND estado <> 'cancelado' LIMIT 1",
    [medicoId, pacienteId]
  );
  return filas.length > 0;
}

// Lista de mis pacientes (con búsqueda)
router.get('/', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 60) : '';
  const pagina = Math.max(1, Number.parseInt(req.query.pagina, 10) || 1);
  const condiciones = [];
  const valores = [req.usuario.id];
  if (q) {
    const patron = `%${escaparLike(q)}%`;
    const partes = ['u.apellido LIKE ?', 'u.nombre LIKE ?', "CONCAT(u.apellido, ' ', u.nombre) LIKE ?"];
    valores.push(patron, patron, patron);
    const digitos = q.replace(/\D/g, '');
    if (digitos) {
      partes.push('u.dni LIKE ?');
      valores.push(`%${digitos}%`);
    }
    condiciones.push(`(${partes.join(' OR ')})`);
  }
  // Filtros extra: edad, solo con alergias, solo los que ya atendí
  const EDADES = {
    chicos: 'TIMESTAMPDIFF(YEAR, p.fecha_nacimiento, CURDATE()) < 18',
    adultos: 'TIMESTAMPDIFF(YEAR, p.fecha_nacimiento, CURDATE()) BETWEEN 18 AND 64',
    mayores: 'TIMESTAMPDIFF(YEAR, p.fecha_nacimiento, CURDATE()) >= 65',
  };
  if (EDADES[req.query.edad]) condiciones.push(EDADES[req.query.edad]);
  if (req.query.alergias === '1') {
    condiciones.push("NULLIF((SELECT f.alergias FROM fichas f WHERE f.paciente_id = u.id ORDER BY f.id DESC LIMIT 1), '') IS NOT NULL");
  }
  if (req.query.atendidos === '1') condiciones.push('t.consultas > 0');
  // Orden: alfabético (por defecto) o los atendidos más recientemente primero
  const orden = req.query.orden === 'recientes' ? 't.ultima IS NULL, t.ultima DESC, u.apellido, u.nombre' : 'u.apellido, u.nombre';
  const donde = condiciones.length ? `AND ${condiciones.join(' AND ')}` : '';
  const base = `
    FROM usuarios u
    JOIN pacientes p ON p.usuario_id = u.id
    JOIN (SELECT paciente_id,
                 MAX(CASE WHEN estado = 'atendido' THEN fecha END) AS ultima,
                 SUM(estado = 'atendido') AS consultas
          FROM turnos WHERE medico_id = ? AND estado <> 'cancelado' GROUP BY paciente_id) t ON t.paciente_id = u.id
    WHERE 1 = 1 ${donde}`;
  try {
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total ${base}`, valores);
    const [filas] = await pool.query(
      `SELECT u.id, u.nombre, u.apellido, u.dni, p.fecha_nacimiento, p.cobertura, t.ultima, t.consultas,
              (SELECT f.alergias FROM fichas f WHERE f.paciente_id = u.id ORDER BY f.id DESC LIMIT 1) AS alergias
       ${base} ORDER BY ${orden} LIMIT ? OFFSET ?`,
      [...valores, POR_PAGINA, (pagina - 1) * POR_PAGINA]
    );
    res.json({
      total: Number(total),
      pagina,
      por_pagina: POR_PAGINA,
      items: filas.map((f) => ({
        id: f.id,
        nombre: f.nombre,
        apellido: f.apellido,
        dni: f.dni,
        fecha_nacimiento: f.fecha_nacimiento,
        cobertura: f.cobertura,
        ultima_consulta: f.ultima,
        consultas: Number(f.consultas),
        alergias: f.alergias,
      })),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Ficha actual de un paciente mío
router.get('/:id/ficha', async (req, res) => {
  const id = idValido(req.params.id);
  if (!id) return res.status(400).json({ error: 'Paciente inválido' });
  try {
    if (!(await esSuPaciente(pool, req.usuario.id, id))) return res.status(404).json({ error: 'Paciente no encontrado' });
    const [filas] = await pool.query(
      `SELECT u.nombre, u.apellido, u.dni, p.fecha_nacimiento, p.cobertura
       FROM usuarios u JOIN pacientes p ON p.usuario_id = u.id WHERE u.id = ?`,
      [id]
    );
    const [[{ versiones }]] = await pool.query('SELECT COUNT(*) AS versiones FROM fichas WHERE paciente_id = ?', [id]);
    res.json({ paciente: { id, ...filas[0] }, ficha: await fichaActual(pool, id), versiones: Number(versiones) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Guardar: crea una versión nueva (la anterior queda guardada)
router.put('/:id/ficha', async (req, res) => {
  const id = idValido(req.params.id);
  if (!id) return res.status(400).json({ error: 'Paciente inválido' });
  const { datos, error } = leerFicha(req.body);
  if (error) return res.status(400).json({ error });

  const conexion = await pool.getConnection();
  try {
    if (!(await esSuPaciente(conexion, req.usuario.id, id))) return res.status(404).json({ error: 'Paciente no encontrado' });

    await conexion.beginTransaction();
    // Se bloquea al paciente para que dos guardados a la vez no se crucen
    await conexion.query('SELECT usuario_id FROM pacientes WHERE usuario_id = ? FOR UPDATE', [id]);
    const actual = await fichaActual(conexion, id);

    // Si alguien la cambió mientras la editaba, se avisa en lugar de pisarla
    const base = req.body.version_id ?? null;
    if ((actual?.version_id ?? null) !== base) {
      await conexion.rollback();
      return res.status(409).json({ error: 'Otro médico actualizó la ficha mientras la editabas. Recargala para ver los cambios.' });
    }
    if (actual && COLUMNAS.every((c) => (actual[c] ?? null) === datos[c])) {
      await conexion.rollback();
      return res.json({ ficha: actual, sin_cambios: true });
    }
    if (!actual && COLUMNAS.every((c) => datos[c] === null)) {
      await conexion.rollback();
      return res.status(400).json({ error: 'Completá al menos un dato de la ficha' });
    }

    await conexion.query(
      `INSERT INTO fichas (paciente_id, ${COLUMNAS.join(', ')}, creado_por) VALUES (?, ${COLUMNAS.map(() => '?').join(', ')}, ?)`,
      [id, ...COLUMNAS.map((c) => datos[c]), req.usuario.id]
    );
    await conexion.commit();
    res.json({ ficha: await fichaActual(pool, id) });
  } catch (err) {
    await conexion.rollback();
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  } finally {
    conexion.release();
  }
});

// Versiones anteriores (quién cambió qué y cuándo)
router.get('/:id/ficha/versiones', async (req, res) => {
  const id = idValido(req.params.id);
  if (!id) return res.status(400).json({ error: 'Paciente inválido' });
  try {
    if (!(await esSuPaciente(pool, req.usuario.id, id))) return res.status(404).json({ error: 'Paciente no encontrado' });
    const [filas] = await pool.query(
      `SELECT f.id, ${COLUMNAS.map((c) => `f.${c}`).join(', ')}, f.creado_en, u.nombre, u.apellido
       FROM fichas f JOIN usuarios u ON u.id = f.creado_por
       WHERE f.paciente_id = ? ORDER BY f.id DESC LIMIT 30`,
      [id]
    );
    res.json(
      filas.map((f) => ({
        id: f.id,
        fecha: f.creado_en,
        autor: `${f.apellido}, ${f.nombre}`,
        ...Object.fromEntries(COLUMNAS.map((c) => [c, f[c]])),
      }))
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;
