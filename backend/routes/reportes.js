const express = require('express');
const pool = require('../db');
const { verificarToken, permitir } = require('../middleware/auth');
const { fechaValida, diasEntre } = require('../fechas');

const router = express.Router();

// Solo la secretaría. Son números agregados: no incluyen datos clínicos.
router.use(verificarToken, permitir('secretaria'));

const MAX_DIAS = 731; // hasta 2 años por consulta
const idValido = (v) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

// Lista de meses 'AAAA-MM' entre dos fechas (inclusive)
function mesesEntre(desde, hasta) {
  const meses = [];
  let [a, m] = desde.split('-').map(Number);
  const [ah, mh] = hasta.split('-').map(Number);
  while (a < ah || (a === ah && m <= mh)) {
    meses.push(`${a}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) {
      m = 1;
      a += 1;
    }
  }
  return meses;
}

const redondear = (n) => Math.round(n * 10) / 10;

router.get('/', async (req, res) => {
  const { desde, hasta } = req.query;
  if (!fechaValida(desde) || !fechaValida(hasta) || hasta < desde) {
    return res.status(400).json({ error: 'Elegí un rango de fechas válido' });
  }
  if (diasEntre(desde, hasta) > MAX_DIAS) return res.status(400).json({ error: 'El rango puede ser de hasta 2 años' });
  const especialidadId = idValido(req.query.especialidad_id);
  const medicoId = idValido(req.query.medico_id);

  // Filtros comunes sobre los turnos (t) y el médico (m)
  const cond = ['t.fecha BETWEEN ? AND ?'];
  const vals = [desde, hasta];
  if (especialidadId) {
    cond.push('m.especialidad_id = ?');
    vals.push(especialidadId);
  }
  if (medicoId) {
    cond.push('t.medico_id = ?');
    vals.push(medicoId);
  }
  const donde = cond.join(' AND ');
  const DESDE_TURNOS = 'FROM turnos t JOIN medicos m ON m.usuario_id = t.medico_id';

  try {
    const [[tot]] = await pool.query(
      `SELECT COUNT(*) AS total,
              SUM(t.estado = 'atendido') AS atendidos,
              SUM(t.estado = 'ausente') AS ausentes,
              SUM(t.estado = 'cancelado') AS cancelados,
              SUM(t.estado IN ('pendiente','confirmado','en_atencion')) AS sin_cerrar,
              COUNT(DISTINCT CASE WHEN t.estado = 'atendido' THEN t.paciente_id END) AS pacientes
       ${DESDE_TURNOS} WHERE ${donde}`,
      vals
    );

    const [porMesFilas] = await pool.query(
      `SELECT DATE_FORMAT(t.fecha, '%Y-%m') AS mes,
              SUM(t.estado = 'atendido') AS atendidos, SUM(t.estado = 'ausente') AS ausentes, SUM(t.estado = 'cancelado') AS cancelados
       ${DESDE_TURNOS} WHERE ${donde} GROUP BY mes`,
      vals
    );
    const meses = mesesEntre(desde, hasta);
    const porMesMapa = Object.fromEntries(porMesFilas.map((f) => [f.mes, f]));
    const porMes = meses.map((mes) => ({
      mes,
      atendidos: Number(porMesMapa[mes]?.atendidos || 0),
      ausentes: Number(porMesMapa[mes]?.ausentes || 0),
      cancelados: Number(porMesMapa[mes]?.cancelados || 0),
    }));

    // Por médico: todos los que cumplen el filtro, aunque no hayan atendido a nadie en el período
    // (los dados de baja aparecen solo si tuvieron turnos en el período)
    const condMed = [];
    const valsMed = [desde, hasta];
    if (especialidadId) {
      condMed.push('m.especialidad_id = ?');
      valsMed.push(especialidadId);
    }
    if (medicoId) {
      condMed.push('m.usuario_id = ?');
      valsMed.push(medicoId);
    }
    const [porMedicoFilas] = await pool.query(
      `SELECT m.usuario_id AS id, u.apellido, u.nombre, u.activo, e.nombre AS especialidad,
              COUNT(t.id) AS turnos,
              COALESCE(SUM(t.estado = 'atendido'), 0) AS atendidos,
              COALESCE(SUM(t.estado = 'ausente'), 0) AS ausentes,
              COALESCE(SUM(t.estado = 'cancelado'), 0) AS cancelados,
              COUNT(DISTINCT CASE WHEN t.estado = 'atendido' THEN t.paciente_id END) AS pacientes
       FROM medicos m
       JOIN usuarios u ON u.id = m.usuario_id
       JOIN especialidades e ON e.id = m.especialidad_id
       LEFT JOIN turnos t ON t.medico_id = m.usuario_id AND t.fecha BETWEEN ? AND ?
       ${condMed.length ? `WHERE ${condMed.join(' AND ')}` : ''}
       GROUP BY m.usuario_id, u.apellido, u.nombre, u.activo, e.nombre
       ORDER BY atendidos DESC, u.apellido, u.nombre`,
      valsMed
    );

    const [porEspFilas] = await pool.query(
      `SELECT e.id, e.nombre, SUM(t.estado = 'atendido') AS atendidos
       ${DESDE_TURNOS} JOIN especialidades e ON e.id = m.especialidad_id
       WHERE ${donde} GROUP BY e.id, e.nombre HAVING atendidos > 0 ORDER BY atendidos DESC`,
      vals
    );

    const atendidos = Number(tot.atendidos || 0);
    const ausentes = Number(tot.ausentes || 0);
    res.json({
      desde,
      hasta,
      meses: meses.length,
      totales: {
        turnos: Number(tot.total),
        atendidos,
        ausentes,
        cancelados: Number(tot.cancelados || 0),
        sin_cerrar: Number(tot.sin_cerrar || 0),
        pacientes: Number(tot.pacientes),
        // Promedio mensual = atendidos / cantidad de meses del rango (un mes incompleto cuenta como uno)
        promedio_mensual: redondear(atendidos / meses.length),
        // Ausentismo = ausentes sobre los turnos que llegaron a la hora (atendidos + ausentes)
        ausentismo: atendidos + ausentes ? redondear((ausentes * 100) / (atendidos + ausentes)) : null,
      },
      por_mes: porMes,
      por_medico: porMedicoFilas
        .filter((f) => f.activo || Number(f.turnos) > 0)
        .map((f) => ({
          id: f.id,
          apellido: f.apellido,
          nombre: f.nombre,
          especialidad: f.especialidad,
          activo: Boolean(f.activo),
          atendidos: Number(f.atendidos),
          ausentes: Number(f.ausentes),
          cancelados: Number(f.cancelados),
          pacientes: Number(f.pacientes),
          promedio_mensual: redondear(Number(f.atendidos) / meses.length),
        })),
      por_especialidad: porEspFilas.map((f) => ({ id: f.id, nombre: f.nombre, atendidos: Number(f.atendidos) })),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;
