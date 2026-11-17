const express = require('express');
const pool = require('../db');
const { verificarToken, permitir } = require('../middleware/auth');

const router = express.Router();

router.use(verificarToken);

function idValido(valor) {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function leerNombre(body) {
  const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : '';
  if (nombre.length < 2 || nombre.length > 60) {
    return { error: 'El nombre de la especialidad debe tener entre 2 y 60 letras' };
  }
  return { nombre };
}

// "medicos" cuenta solo a los médicos activos. El paciente ve solo las especialidades activas.
router.get('/', async (req, res) => {
  const soloActivas = req.usuario.rol !== 'secretaria';
  try {
    const [filas] = await pool.query(
      `SELECT e.id, e.nombre, e.activa, COUNT(u.id) AS medicos
       FROM especialidades e
       LEFT JOIN medicos m ON m.especialidad_id = e.id
       LEFT JOIN usuarios u ON u.id = m.usuario_id AND u.activo = 1
       ${soloActivas ? 'WHERE e.activa = 1' : ''}
       GROUP BY e.id, e.nombre, e.activa
       ORDER BY e.nombre`
    );
    res.json(filas.map((f) => ({ ...f, activa: Boolean(f.activa), medicos: Number(f.medicos) })));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.post('/', permitir('secretaria'), async (req, res) => {
  const { nombre, error } = leerNombre(req.body);
  if (error) return res.status(400).json({ error });

  try {
    const [r] = await pool.query('INSERT INTO especialidades (nombre) VALUES (?)', [nombre]);
    res.status(201).json({ id: r.insertId, nombre, activa: true, medicos: 0 });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Esa especialidad ya existe. Si está desactivada, reactivala desde la lista.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Corregir el nombre (por ejemplo, un error de tipeo)
router.put('/:id', permitir('secretaria'), async (req, res) => {
  const id = idValido(req.params.id);
  if (!id) return res.status(400).json({ error: 'Especialidad inválida' });
  const { nombre, error } = leerNombre(req.body);
  if (error) return res.status(400).json({ error });

  try {
    const [existe] = await pool.query('SELECT id FROM especialidades WHERE id = ?', [id]);
    if (existe.length === 0) return res.status(404).json({ error: 'Especialidad no encontrada' });

    await pool.query('UPDATE especialidades SET nombre = ? WHERE id = ?', [nombre, id]);
    res.json({ id, nombre });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ya existe otra especialidad con ese nombre' });
    }
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Desactivar y reactivar
router.put('/:id/estado', permitir('secretaria'), async (req, res) => {
  const id = idValido(req.params.id);
  if (!id) return res.status(400).json({ error: 'Especialidad inválida' });
  if (typeof req.body.activa !== 'boolean') return res.status(400).json({ error: 'Falta indicar el estado' });

  try {
    const [existe] = await pool.query('SELECT id FROM especialidades WHERE id = ?', [id]);
    if (existe.length === 0) return res.status(404).json({ error: 'Especialidad no encontrada' });

    if (!req.body.activa) {
      const [[{ n }]] = await pool.query(
        `SELECT COUNT(*) AS n FROM medicos m JOIN usuarios u ON u.id = m.usuario_id
         WHERE m.especialidad_id = ? AND u.activo = 1`,
        [id]
      );
      if (Number(n) > 0) {
        return res.status(409).json({
          error: `Hay ${n} ${Number(n) === 1 ? 'médico activo' : 'médicos activos'} con esa especialidad. Dalos de baja o cambialos de especialidad antes de desactivarla.`,
        });
      }
    }

    await pool.query('UPDATE especialidades SET activa = ? WHERE id = ?', [req.body.activa ? 1 : 0, id]);
    res.json({ activa: req.body.activa });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Borrar: solo si ningún médico la usó nunca (ni siquiera uno dado de baja)
router.delete('/:id', permitir('secretaria'), async (req, res) => {
  const id = idValido(req.params.id);
  if (!id) return res.status(400).json({ error: 'Especialidad inválida' });

  try {
    const [r] = await pool.query('DELETE FROM especialidades WHERE id = ?', [id]);
    if (r.affectedRows === 0) return res.status(404).json({ error: 'Especialidad no encontrada' });
    res.json({ mensaje: 'Especialidad eliminada' });
  } catch (error) {
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({
        error: 'Hay médicos asociados a esa especialidad (aunque estén de baja), así que no se puede borrar. Podés corregirle el nombre o desactivarla.',
      });
    }
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;