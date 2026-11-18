const express = require('express');
const pool = require('../db');
const { bloqueado, registrarFallo } = require('../limite');
const { buscarPorToken } = require('../confirmaciones');
const { esFuturo } = require('../reservas');

// Rutas PÚBLICAS: quien tiene el enlace del mail puede ver y confirmar ese turno, nada más.
const router = express.Router();

const TEXTO_ESTADO = { cancelado: 'cancelado', atendido: 'atendido', ausente: 'marcado como ausente', en_atencion: 'en atención' };

async function leer(req, res) {
  const clave = `confirmar:${req.ip}`;
  const espera = bloqueado(clave);
  if (espera) {
    res.status(429).json({ error: 'Demasiados intentos. Probá de nuevo en unos minutos.' });
    return null;
  }
  const t = await buscarPorToken(pool, req.params.token);
  if (!t) {
    registrarFallo(clave);
    res.status(404).json({ error: 'El enlace no es válido.' });
    return null;
  }
  return t;
}

const datos = (t) => ({
  fecha: t.fecha,
  hora: t.hora.slice(0, 5),
  estado: t.estado,
  medico_apellido: t.medico_apellido,
  especialidad: t.especialidad,
  vigente: ['pendiente', 'confirmado'].includes(t.estado) && esFuturo(t.fecha, t.hora),
});

// Ver el turno (no cambia nada: así un antivirus que "abre" el enlace del mail no confirma por error)
router.get('/:token', async (req, res) => {
  try {
    const t = await leer(req, res);
    if (t) res.json({ turno: datos(t) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Confirmar (lo dispara el botón de la página)
router.post('/:token', async (req, res) => {
  try {
    const t = await leer(req, res);
    if (!t) return;

    if (t.estado === 'confirmado') return res.json({ turno: datos(t), mensaje: 'Tu turno ya estaba confirmado.' });
    if (t.estado !== 'pendiente') {
      return res.status(409).json({ error: `Este turno está ${TEXTO_ESTADO[t.estado] || t.estado}, no se puede confirmar.` });
    }
    if (!esFuturo(t.fecha, t.hora)) return res.status(409).json({ error: 'Ese turno ya pasó.' });

    const [u] = await pool.query("UPDATE turnos SET estado = 'confirmado' WHERE id = ? AND estado = 'pendiente'", [t.id]);
    if (u.affectedRows === 0) return res.status(409).json({ error: 'El turno cambió de estado. Consultá en la secretaría.' });
    await pool.query('UPDATE confirmaciones SET usado_en = NOW() WHERE id = ? AND usado_en IS NULL', [t.confirmacion_id]);

    res.json({ turno: datos({ ...t, estado: 'confirmado' }), mensaje: '¡Listo! Tu turno quedó confirmado.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;
