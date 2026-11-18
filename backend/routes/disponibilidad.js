const express = require('express');
const pool = require('../db');
const { verificarToken, permitir } = require('../middleware/auth');
const { fechaValida } = require('../fechas');
const {
  medicoActivo, disponibilidadDelDia, disponibilidadDelMes, proximoTurnoLibre,
} = require('../disponibilidad');

const router = express.Router();

router.use(verificarToken, permitir('secretaria', 'paciente'));

function idValido(valor) {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// Médicos activos, con los días de la semana en que atienden.
// Con ?proximo=1 suma el próximo turno libre de cada uno.
// Por privacidad solo salen datos públicos: nunca DNI, email, teléfono ni matrícula.
router.get('/medicos', async (req, res) => {
  const especialidad = Number.parseInt(req.query.especialidad_id, 10);
  const filtrar = Number.isInteger(especialidad);
  const conProximo = req.query.proximo === '1';

  try {
    const [medicos] = await pool.query(
      `SELECT u.id, u.nombre, u.apellido, e.id AS especialidad_id, e.nombre AS especialidad
       FROM usuarios u
       JOIN medicos m ON m.usuario_id = u.id
       JOIN especialidades e ON e.id = m.especialidad_id
       WHERE u.activo = 1 ${filtrar ? 'AND m.especialidad_id = ?' : ''}
       ORDER BY u.apellido, u.nombre`,
      filtrar ? [especialidad] : []
    );
    const [dias] = await pool.query(
      `SELECT DISTINCT h.medico_id, h.dia_semana
       FROM horarios h JOIN usuarios u ON u.id = h.medico_id
       WHERE u.activo = 1 AND h.activo = 1 AND h.eliminado = 0 ORDER BY h.medico_id, h.dia_semana`
    );

    const lista = [];
    for (const m of medicos) {
      const fila = { ...m, dias: dias.filter((d) => d.medico_id === m.id).map((d) => d.dia_semana) };
      if (conProximo) fila.proximo = await proximoTurnoLibre(pool, m.id);
      lista.push(fila);
    }
    res.json(lista);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Los horarios semanales vigentes de un médico (solo días, horas y duración del turno)
router.get('/horarios', async (req, res) => {
  const medicoId = idValido(req.query.medico_id);
  if (!medicoId) return res.status(400).json({ error: 'Médico inválido' });

  try {
    if (!(await medicoActivo(pool, medicoId))) return res.status(404).json({ error: 'Médico no encontrado' });

    const [filas] = await pool.query(
      `SELECT dia_semana, hora_inicio, hora_fin, duracion_min
       FROM horarios WHERE medico_id = ? AND activo = 1 AND eliminado = 0
       ORDER BY dia_semana, hora_inicio`,
      [medicoId]
    );
    res.json(
      filas.map((f) => ({
        dia_semana: f.dia_semana,
        hora_inicio: f.hora_inicio.slice(0, 5),
        hora_fin: f.hora_fin.slice(0, 5),
        duracion_min: f.duracion_min,
      }))
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Los turnos de un día, libres y ocupados
router.get('/dia', async (req, res) => {
  const medicoId = idValido(req.query.medico_id);
  const { fecha } = req.query;
  if (!medicoId || !fechaValida(fecha)) return res.status(400).json({ error: 'Médico o fecha inválidos' });

  try {
    if (!(await medicoActivo(pool, medicoId))) return res.status(404).json({ error: 'Médico no encontrado' });

    const r = await disponibilidadDelDia(pool, medicoId, fecha);
    res.json({
      fecha,
      motivo: r.motivo,
      mensaje: r.mensaje,
      turnos: r.turnos,
      libres: r.turnos.filter((t) => t.libre).length,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Cuántos turnos libres hay cada día de un mes (mes=AAAA-MM)
router.get('/mes', async (req, res) => {
  const medicoId = idValido(req.query.medico_id);
  const m = /^(\d{4})-(\d{2})$/.exec(String(req.query.mes || ''));
  const anio = m ? Number(m[1]) : 0;
  const mes = m ? Number(m[2]) : 0;
  if (!medicoId || mes < 1 || mes > 12 || anio < 2000 || anio > 2100) {
    return res.status(400).json({ error: 'Médico o mes inválidos' });
  }

  try {
    if (!(await medicoActivo(pool, medicoId))) return res.status(404).json({ error: 'Médico no encontrado' });

    res.json({ mes: req.query.mes, dias: await disponibilidadDelMes(pool, medicoId, anio, mes) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;