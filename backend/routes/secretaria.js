const express = require('express');
const pool = require('../db');
const { verificarToken, permitir } = require('../middleware/auth');
const { ahora, fechaValida, sumarDias, diaSemanaISO, horaSQL } = require('../fechas');
const { disponibilidadDeRango } = require('../disponibilidad');

const router = express.Router();

// Inicio y calendario de la secretaría. Solo números y médicos: ningún dato de pacientes.
router.use(verificarToken, permitir('secretaria'));

const idValido = (v) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

// Médicos activos (opcionalmente de una especialidad)
async function medicosActivos(especialidadId) {
  const [filas] = await pool.query(
    `SELECT u.id, u.apellido, u.nombre, e.nombre AS especialidad,
            EXISTS (SELECT 1 FROM horarios h WHERE h.medico_id = u.id AND h.activo = 1 AND h.eliminado = 0) AS tiene_horarios
     FROM usuarios u JOIN medicos m ON m.usuario_id = u.id JOIN especialidades e ON e.id = m.especialidad_id
     WHERE u.activo = 1 ${especialidadId ? 'AND m.especialidad_id = ?' : ''}
     ORDER BY u.apellido, u.nombre`,
    especialidadId ? [especialidadId] : []
  );
  return filas.map((f) => ({ ...f, tiene_horarios: Boolean(f.tiene_horarios) }));
}

// Conteo de turnos por médico y día en un rango: { 'medicoId|fecha': { turnos, atendidos, ... } }
async function conteos(desde, hasta) {
  const [filas] = await pool.query(
    `SELECT medico_id, fecha,
            COUNT(*) AS turnos,
            SUM(estado = 'pendiente') AS sin_confirmar,
            SUM(estado = 'confirmado') AS confirmados,
            SUM(estado = 'en_atencion') AS en_atencion,
            SUM(estado = 'atendido') AS atendidos,
            SUM(estado = 'ausente') AS ausentes
     FROM turnos WHERE fecha BETWEEN ? AND ? AND estado <> 'cancelado'
     GROUP BY medico_id, fecha`,
    [desde, hasta]
  );
  const mapa = {};
  for (const f of filas) {
    mapa[`${f.medico_id}|${f.fecha}`] = {
      turnos: Number(f.turnos),
      sin_confirmar: Number(f.sin_confirmar),
      confirmados: Number(f.confirmados),
      en_atencion: Number(f.en_atencion),
      atendidos: Number(f.atendidos),
      ausentes: Number(f.ausentes),
    };
  }
  return mapa;
}
const VACIO = { turnos: 0, sin_confirmar: 0, confirmados: 0, en_atencion: 0, atendidos: 0, ausentes: 0 };

router.get('/resumen', async (req, res) => {
  const a = ahora();
  const hoy = a.fecha;
  const manana = sumarDias(hoy, 1);
  try {
    const medicos = await medicosActivos(null);
    const mapa = await conteos(hoy, manana);

    const porMedico = [];
    for (const m of medicos) {
      const c = mapa[`${m.id}|${hoy}`] || VACIO;
      const disp = m.tiene_horarios ? (await disponibilidadDeRango(pool, m.id, hoy, hoy))[hoy] : null;
      if (c.turnos === 0 && (!disp || disp.total === 0)) continue; // hoy no atiende ni tiene turnos
      porMedico.push({ id: m.id, apellido: m.apellido, nombre: m.nombre, especialidad: m.especialidad, ...c, libres: disp ? disp.libres : 0, motivo: disp?.motivo ?? null });
    }
    const suma = (campo, fecha) => Object.entries(mapa).filter(([k]) => k.endsWith(`|${fecha}`)).reduce((t, [, v]) => t + v[campo], 0);

    // Ya pasó la hora y siguen sin cerrar (para recordarle al médico)
    const [[{ atrasados }]] = await pool.query(
      `SELECT COUNT(*) AS atrasados FROM turnos
       WHERE fecha = ? AND hora < ? AND estado IN ('pendiente','confirmado')`,
      [hoy, horaSQL(a.minutos)]
    );
    const [[{ atendidos_mes }]] = await pool.query(
      "SELECT COUNT(*) AS atendidos_mes FROM turnos WHERE estado = 'atendido' AND fecha BETWEEN ? AND ?",
      [`${hoy.slice(0, 7)}-01`, hoy]
    );
    const [licencias] = await pool.query(
      `SELECT l.desde, l.hasta, u.apellido, u.nombre FROM licencias l JOIN usuarios u ON u.id = l.medico_id
       WHERE l.activa = 1 AND u.activo = 1 AND l.hasta >= ? AND l.desde <= ? ORDER BY l.desde`,
      [hoy, sumarDias(hoy, 14)]
    );
    const [feriados] = await pool.query(
      'SELECT fecha, descripcion FROM feriados WHERE activo = 1 AND fecha BETWEEN ? AND ? ORDER BY fecha',
      [hoy, sumarDias(hoy, 30)]
    );

    res.json({
      fecha: hoy,
      hoy: {
        turnos: suma('turnos', hoy),
        sin_confirmar: suma('sin_confirmar', hoy),
        confirmados: suma('confirmados', hoy),
        en_atencion: suma('en_atencion', hoy),
        atendidos: suma('atendidos', hoy),
        ausentes: suma('ausentes', hoy),
        atrasados: Number(atrasados),
      },
      manana: { fecha: manana, turnos: suma('turnos', manana), sin_confirmar: suma('sin_confirmar', manana) },
      atendidos_mes: Number(atendidos_mes),
      por_medico: porMedico,
      avisos: {
        licencias: licencias.map((l) => ({ medico: `${l.apellido}, ${l.nombre}`, desde: l.desde, hasta: l.hasta })),
        feriados,
        sin_horarios: medicos.filter((m) => !m.tiene_horarios).map((m) => `${m.apellido}, ${m.nombre}`),
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Calendario de una semana (de lunes a domingo) para todos los médicos
router.get('/semana', async (req, res) => {
  let desde = req.query.desde ?? ahora().fecha;
  if (!fechaValida(desde)) return res.status(400).json({ error: 'La fecha no es válida' });
  desde = sumarDias(desde, 1 - diaSemanaISO(desde)); // se lleva al lunes
  const hasta = sumarDias(desde, 6);
  const especialidadId = idValido(req.query.especialidad_id);

  try {
    const medicos = await medicosActivos(especialidadId);
    const mapa = await conteos(desde, hasta);
    const [feriados] = await pool.query('SELECT fecha, descripcion FROM feriados WHERE activo = 1 AND fecha BETWEEN ? AND ?', [desde, hasta]);
    const [licencias] = await pool.query(
      'SELECT medico_id, desde, hasta FROM licencias WHERE activa = 1 AND hasta >= ? AND desde <= ?',
      [desde, hasta]
    );
    const [horarios] = await pool.query('SELECT DISTINCT medico_id, dia_semana FROM horarios WHERE activo = 1 AND eliminado = 0');
    const atiende = new Set(horarios.map((h) => `${h.medico_id}|${h.dia_semana}`));
    const hoy = ahora().fecha;
    const dias = Array.from({ length: 7 }, (_, i) => sumarDias(desde, i));
    const feriadoDe = Object.fromEntries(feriados.map((f) => [f.fecha, f.descripcion]));

    const filas = [];
    for (const m of medicos) {
      // Los turnos libres solo se calculan desde hoy en adelante
      const disp = m.tiene_horarios && hasta >= hoy ? await disponibilidadDeRango(pool, m.id, desde < hoy ? hoy : desde, hasta) : {};
      const celdas = dias.map((f) => {
        const c = mapa[`${m.id}|${f}`] || VACIO;
        let estado = 'atiende';
        if (feriadoDe[f]) estado = 'feriado';
        else if (licencias.some((l) => l.medico_id === m.id && l.desde <= f && l.hasta >= f)) estado = 'licencia';
        else if (!atiende.has(`${m.id}|${diaSemanaISO(f)}`)) estado = 'no_atiende';
        // Si el día ya no tiene horarios por delante (terminó), no se muestran libres
        return { fecha: f, estado, ...c, libres: disp[f]?.total ? disp[f].libres : null };
      });
      filas.push({ id: m.id, apellido: m.apellido, nombre: m.nombre, especialidad: m.especialidad, dias: celdas });
    }

    res.json({
      desde,
      hasta,
      dias: dias.map((f) => ({ fecha: f, feriado: feriadoDe[f] || null, es_hoy: f === hoy })),
      medicos: filas,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;
