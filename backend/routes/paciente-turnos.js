const express = require('express');
const pool = require('../db');
const { verificarToken, permitir } = require('../middleware/auth');
const { ahora } = require('../fechas');
const { reservarTurno } = require('../reservas');

const router = express.Router();

// Solo pacientes, y siempre a su nombre
router.use(verificarToken, permitir('paciente'));

// Tope de turnos vigentes por paciente (evita acaparar horarios)
const MAX_TURNOS_VIGENTES = 5;

const idValido = (v) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

router.post('/', async (req, res) => {
  const medicoId = idValido(req.body.medico_id);
  const { fecha } = req.body;
  const hora = typeof req.body.hora === 'string' ? req.body.hora.slice(0, 5) : '';
  const motivo = typeof req.body.motivo === 'string' ? req.body.motivo.trim() : '';

  if (!medicoId) return res.status(400).json({ error: 'Elegí el médico' });
  if (motivo.length > 150) return res.status(400).json({ error: 'El motivo es demasiado largo (máximo 150 letras)' });

  const conexion = await pool.getConnection();
  try {
    const hoy = ahora().fecha;
    const [[{ vigentes }]] = await conexion.query(
      "SELECT COUNT(*) AS vigentes FROM turnos WHERE paciente_id = ? AND estado IN ('pendiente','confirmado') AND fecha >= ?",
      [req.usuario.id, hoy]
    );
    if (Number(vigentes) >= MAX_TURNOS_VIGENTES) {
      return res.status(409).json({
        error: `Ya tenés ${MAX_TURNOS_VIGENTES} turnos pendientes o confirmados. Cancelá alguno o esperá a atenderte para sacar otro.`,
      });
    }

    const r = await reservarTurno(conexion, {
      medicoId,
      pacienteId: req.usuario.id, // siempre el del token, nunca el que mande el cliente
      fecha,
      hora,
      motivo,
      estado: 'pendiente',
      creadoPor: req.usuario.id,
      propio: true,
    });
    if (r.error) return res.status(r.codigo).json({ error: r.error });

    const [filas] = await conexion.query(
      `SELECT t.id, t.fecha, t.hora, t.estado, t.motivo, um.nombre, um.apellido, e.nombre AS especialidad
       FROM turnos t JOIN usuarios um ON um.id = t.medico_id
       JOIN medicos m ON m.usuario_id = t.medico_id JOIN especialidades e ON e.id = m.especialidad_id
       WHERE t.id = ?`,
      [r.turnoId]
    );
    const t = filas[0];
    res.status(201).json({
      turno: {
        id: t.id,
        fecha: t.fecha,
        hora: t.hora.slice(0, 5),
        estado: t.estado,
        motivo: t.motivo,
        medico: { nombre: t.nombre, apellido: t.apellido, especialidad: t.especialidad },
      },
      sin_email: !req.usuario.email,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  } finally {
    conexion.release();
  }
});

module.exports = router;
