const express = require('express');
const pool = require('../db');
const { verificarToken, permitir } = require('../middleware/auth');
const { fichaActual } = require('../fichas');

// El paciente puede ver su propia ficha (solo lectura)
const router = express.Router();
router.use(verificarToken, permitir('paciente'));

router.get('/', async (req, res) => {
  try {
    res.json({ ficha: await fichaActual(pool, req.usuario.id) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;
