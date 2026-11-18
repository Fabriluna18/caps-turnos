const express = require('express');
const pool = require('../db');
const { verificarToken, permitir } = require('../middleware/auth');
const { ahora, horaSQL } = require('../fechas');

const router = express.Router();

// Solo para pacientes, y siempre sobre sus propios datos
router.use(verificarToken, permitir('paciente'));

const aTurno = (t) => ({
  id: t.id,
  fecha: t.fecha,
  hora: t.hora.slice(0, 5),
  estado: t.estado,
  medico: { nombre: t.nombre, apellido: t.apellido, especialidad: t.especialidad },
});

router.get('/resumen', async (req, res) => {
  const { fecha, minutos } = ahora();
  const hora = horaSQL(minutos);
  const [anio, mes] = fecha.split('-').map(Number);
  const mm = String(mes).padStart(2, '0');
  const primero = `${anio}-${mm}-01`;
  const ultimo = `${anio}-${mm}-${String(new Date(Date.UTC(anio, mes, 0)).getUTCDate()).padStart(2, '0')}`;

  try {
    // Los turnos que todavía no empezaron: el primero es el "próximo" y el resto, los "siguientes"
    const [proximos] = await pool.query(
      `SELECT t.id, t.fecha, t.hora, t.estado, um.nombre, um.apellido, e.nombre AS especialidad
       FROM turnos t
       JOIN usuarios um ON um.id = t.medico_id
       JOIN medicos m ON m.usuario_id = t.medico_id
       JOIN especialidades e ON e.id = m.especialidad_id
       WHERE t.paciente_id = ? AND t.estado IN ('pendiente', 'confirmado')
         AND (t.fecha > ? OR (t.fecha = ? AND t.hora > ?))
       ORDER BY t.fecha, t.hora LIMIT 5`,
      [req.usuario.id, fecha, fecha, hora]
    );
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM turnos
       WHERE paciente_id = ? AND estado IN ('pendiente', 'confirmado')
         AND (fecha > ? OR (fecha = ? AND hora > ?))`,
      [req.usuario.id, fecha, fecha, hora]
    );
    const [[{ n }]] = await pool.query(
      "SELECT COUNT(*) AS n FROM turnos WHERE paciente_id = ? AND estado <> 'cancelado' AND fecha BETWEEN ? AND ?",
      [req.usuario.id, primero, ultimo]
    );

    res.json({
      proximo: proximos[0] ? aTurno(proximos[0]) : null,
      siguientes: proximos.slice(1).map(aTurno),
      total_proximos: Number(total),
      turnos_mes: Number(n),
      sin_email: !req.usuario.email,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;