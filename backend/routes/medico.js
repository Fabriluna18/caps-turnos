const express = require('express');
const pool = require('../db');
const { verificarToken, permitir } = require('../middleware/auth');
const { ahora, fechaValida, diasEntre } = require('../fechas');

const router = express.Router();

// Solo médicos, y siempre sobre sus propios turnos
router.use(verificarToken, permitir('medico'));

const idValido = (v) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

// Qué cambios de estado puede hacer el médico (atendido es final)
const TRANSICIONES = {
  en_atencion: ['pendiente', 'confirmado', 'ausente'],
  atendido: ['pendiente', 'confirmado', 'en_atencion', 'ausente'],
  ausente: ['pendiente', 'confirmado', 'en_atencion'],
};

function edadDe(nacimiento, hoy) {
  if (!nacimiento) return null;
  const [a, m, d] = nacimiento.split('-').map(Number);
  const [ha, hm, hd] = hoy.split('-').map(Number);
  return ha - a - (hm < m || (hm === m && hd < d) ? 1 : 0);
}

// Agenda de un día (por defecto hoy)
router.get('/agenda', async (req, res) => {
  const hoy = ahora().fecha;
  const fecha = req.query.fecha ?? hoy;
  if (!fechaValida(fecha) || Math.abs(diasEntre(hoy, fecha)) > 400) {
    return res.status(400).json({ error: 'La fecha no es válida' });
  }
  try {
    const [filas] = await pool.query(
      `SELECT t.id, t.hora, t.duracion_min, t.estado, t.motivo,
              u.nombre, u.apellido, u.dni, p.fecha_nacimiento, p.cobertura
       FROM turnos t
       JOIN usuarios u ON u.id = t.paciente_id
       LEFT JOIN pacientes p ON p.usuario_id = t.paciente_id
       WHERE t.medico_id = ? AND t.fecha = ? AND t.estado <> 'cancelado'
       ORDER BY t.hora`,
      [req.usuario.id, fecha]
    );
    const [[{ cancelados }]] = await pool.query(
      "SELECT COUNT(*) AS cancelados FROM turnos WHERE medico_id = ? AND fecha = ? AND estado = 'cancelado'",
      [req.usuario.id, fecha]
    );
    const conteo = {};
    for (const t of filas) conteo[t.estado] = (conteo[t.estado] || 0) + 1;

    res.json({
      fecha,
      es_hoy: fecha === hoy,
      puede_marcar: fecha <= hoy, // los turnos futuros todavía no se pueden atender
      cancelados: Number(cancelados),
      conteo,
      turnos: filas.map((t) => ({
        id: t.id,
        hora: t.hora.slice(0, 5),
        duracion_min: t.duracion_min,
        estado: t.estado,
        motivo: t.motivo,
        paciente: {
          nombre: t.nombre,
          apellido: t.apellido,
          dni: t.dni,
          edad: edadDe(t.fecha_nacimiento, hoy),
          cobertura: t.cobertura,
        },
      })),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Cambiar el estado de un turno propio: en_atencion | atendido | ausente
router.put('/turnos/:id/estado', async (req, res) => {
  const id = idValido(req.params.id);
  const nuevo = req.body.estado;
  if (!id) return res.status(400).json({ error: 'Turno inválido' });
  if (!TRANSICIONES[nuevo]) return res.status(400).json({ error: 'Estado no válido' });

  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    // Se bloquea al médico: así dos clics seguidos no dejan a dos pacientes "en atención"
    await conexion.query('SELECT usuario_id FROM medicos WHERE usuario_id = ? FOR UPDATE', [req.usuario.id]);
    const [filas] = await conexion.query(
      'SELECT id, fecha, estado FROM turnos WHERE id = ? AND medico_id = ? FOR UPDATE',
      [id, req.usuario.id]
    );
    const t = filas[0];
    if (!t) {
      await conexion.rollback();
      return res.status(404).json({ error: 'Turno no encontrado' });
    }
    if (t.fecha > ahora().fecha) {
      await conexion.rollback();
      return res.status(409).json({ error: 'Ese turno es de un día futuro, todavía no se puede atender.' });
    }
    if (t.estado === nuevo) {
      await conexion.rollback();
      return res.json({ estado: nuevo });
    }
    if (!TRANSICIONES[nuevo].includes(t.estado)) {
      await conexion.rollback();
      const motivo = t.estado === 'cancelado' ? 'está cancelado' : t.estado === 'atendido' ? 'ya fue atendido' : `está ${t.estado.replace('_', ' ')}`;
      return res.status(409).json({ error: `Este turno ${motivo}, no se puede cambiar.` });
    }
    if (nuevo === 'en_atencion') {
      const [otro] = await conexion.query(
        `SELECT u.apellido FROM turnos t JOIN usuarios u ON u.id = t.paciente_id
         WHERE t.medico_id = ? AND t.estado = 'en_atencion' AND t.id <> ? LIMIT 1`,
        [req.usuario.id, id]
      );
      if (otro.length > 0) {
        await conexion.rollback();
        return res.status(409).json({ error: `Ya estás atendiendo a ${otro[0].apellido}. Terminá esa consulta primero.` });
      }
    }
    await conexion.query('UPDATE turnos SET estado = ? WHERE id = ?', [nuevo, id]);
    await conexion.commit();
    res.json({ estado: nuevo });
  } catch (error) {
    await conexion.rollback();
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  } finally {
    conexion.release();
  }
});

module.exports = router;
