const express = require('express');
const pool = require('../db');
const { verificarToken, permitir } = require('../middleware/auth');

const router = express.Router();

router.use(verificarToken);

function idValido(valor) {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// Cualquier persona con sesión puede ver la lista (la usa el paciente para elegir)
router.get('/', async (req, res) => {
  try {
    const [filas] = await pool.query(
      `SELECT e.id, e.nombre, COUNT(m.usuario_id) AS medicos
       FROM especialidades e
       LEFT JOIN medicos m ON m.especialidad_id = e.id
       GROUP BY e.id, e.nombre
       ORDER BY e.nombre`
    );
    res.json(filas.map((f) => ({ ...f, medicos: Number(f.medicos) })));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.post('/', permitir('secretaria'), async (req, res) => {
  const nombre = typeof req.body.nombre === 'string' ? req.body.nombre.trim() : '';
  if (nombre.length < 2 || nombre.length > 60) {
    return res.status(400).json({ error: 'El nombre de la especialidad debe tener entre 2 y 60 letras' });
  }

  try {
    const [r] = await pool.query('INSERT INTO especialidades (nombre) VALUES (?)', [nombre]);
    res.status(201).json({ id: r.insertId, nombre, medicos: 0 });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Esa especialidad ya existe' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.delete('/:id', permitir('secretaria'), async (req, res) => {
  const id = idValido(req.params.id);
  if (!id) return res.status(400).json({ error: 'Especialidad inválida' });

  try {
    const [r] = await pool.query('DELETE FROM especialidades WHERE id = ?', [id]);
    if (r.affectedRows === 0) {
      return res.status(404).json({ error: 'Especialidad no encontrada' });
    }
    res.json({ mensaje: 'Especialidad eliminada' });
  } catch (error) {
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({ error: 'Hay médicos con esa especialidad, así que no se puede eliminar' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;