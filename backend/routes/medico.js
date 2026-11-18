const express = require('express');
const pool = require('../db');
const { verificarToken, permitir } = require('../middleware/auth');
const { ahora, fechaValida, diasEntre, sumarDias, horaSQL } = require('../fechas');

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
              (SELECT COUNT(*) FROM recetas r WHERE r.turno_id = t.id AND r.anulada = 0) AS recetas,
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
        recetas: Number(t.recetas),
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

// Inicio del médico: cómo viene el día y el mes
router.get('/resumen', async (req, res) => {
  const a = ahora();
  const id = req.usuario.id;
  const primeroMes = `${a.fecha.slice(0, 7)}-01`;
  try {
    const [hoy] = await pool.query(
      "SELECT estado, COUNT(*) AS n FROM turnos WHERE medico_id = ? AND fecha = ? AND estado <> 'cancelado' GROUP BY estado",
      [id, a.fecha]
    );
    const conteo = Object.fromEntries(hoy.map((f) => [f.estado, Number(f.n)]));

    const SELECT = `SELECT t.id, t.hora, t.estado, t.motivo, u.nombre, u.apellido
                    FROM turnos t JOIN usuarios u ON u.id = t.paciente_id`;
    const [enAtencion] = await pool.query(`${SELECT} WHERE t.medico_id = ? AND t.estado = 'en_atencion' ORDER BY t.fecha, t.hora LIMIT 1`, [id]);
    // El siguiente de hoy: el primero que sigue esperando (aunque esté atrasado)
    const [siguiente] = await pool.query(
      `${SELECT} WHERE t.medico_id = ? AND t.fecha = ? AND t.estado IN ('pendiente','confirmado') ORDER BY t.hora LIMIT 1`,
      [id, a.fecha]
    );
    const [[{ semana }]] = await pool.query(
      `SELECT COUNT(*) AS semana FROM turnos WHERE medico_id = ? AND estado IN ('pendiente','confirmado')
       AND ((fecha = ? AND hora > ?) OR (fecha > ? AND fecha <= ?))`,
      [id, a.fecha, horaSQL(a.minutos), a.fecha, sumarDias(a.fecha, 7)]
    );
    const [[{ atendidos }]] = await pool.query(
      "SELECT COUNT(*) AS atendidos FROM turnos WHERE medico_id = ? AND estado = 'atendido' AND fecha BETWEEN ? AND ?",
      [id, primeroMes, a.fecha]
    );
    const [[{ recetas }]] = await pool.query(
      'SELECT COUNT(*) AS recetas FROM recetas WHERE medico_id = ? AND anulada = 0 AND fecha BETWEEN ? AND ?',
      [id, primeroMes, a.fecha]
    );

    const corto = (t) => t && { id: t.id, hora: t.hora.slice(0, 5), estado: t.estado, motivo: t.motivo, paciente: { nombre: t.nombre, apellido: t.apellido } };
    res.json({
      fecha: a.fecha,
      hoy: { total: Object.values(conteo).reduce((x, y) => x + y, 0), conteo },
      en_atencion: corto(enAtencion[0]) || null,
      siguiente: corto(siguiente[0]) || null,
      proximos_7_dias: Number(semana),
      mes: { atendidos: Number(atendidos), recetas: Number(recetas) },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Historial del paciente de un turno, pero SOLO lo que pasó con este médico
// (la ficha clínica completa es tema de los días 15 y 16)
router.get('/turnos/:id/historial', async (req, res) => {
  const id = idValido(req.params.id);
  if (!id) return res.status(400).json({ error: 'Turno inválido' });
  try {
    const [turno] = await pool.query(
      `SELECT t.paciente_id, u.nombre, u.apellido, u.dni, p.fecha_nacimiento, p.cobertura
       FROM turnos t JOIN usuarios u ON u.id = t.paciente_id LEFT JOIN pacientes p ON p.usuario_id = t.paciente_id
       WHERE t.id = ? AND t.medico_id = ?`,
      [id, req.usuario.id]
    );
    const t = turno[0];
    if (!t) return res.status(404).json({ error: 'Turno no encontrado' });

    const [consultas] = await pool.query(
      `SELECT t.id, t.fecha, t.hora, t.estado, t.motivo,
              (SELECT COUNT(*) FROM recetas r WHERE r.turno_id = t.id AND r.anulada = 0) AS recetas
       FROM turnos t
       WHERE t.paciente_id = ? AND t.medico_id = ? AND t.id <> ? AND t.estado IN ('atendido','ausente')
       ORDER BY t.fecha DESC, t.hora DESC LIMIT 20`,
      [t.paciente_id, req.usuario.id, id]
    );
    const [recetas] = await pool.query(
      `SELECT r.id, r.fecha, r.diagnostico, r.anulada,
              (SELECT GROUP_CONCAT(i.medicamento ORDER BY i.orden SEPARATOR ', ') FROM receta_items i WHERE i.receta_id = r.id) AS medicamentos
       FROM recetas r WHERE r.paciente_id = ? AND r.medico_id = ?
       ORDER BY r.fecha DESC, r.id DESC LIMIT 10`,
      [t.paciente_id, req.usuario.id]
    );
    const atendidas = consultas.filter((c) => c.estado === 'atendido').length;

    res.json({
      paciente: { nombre: t.nombre, apellido: t.apellido, dni: t.dni, fecha_nacimiento: t.fecha_nacimiento, cobertura: t.cobertura },
      resumen: { atendidas, ausencias: consultas.length - atendidas },
      consultas: consultas.map((c) => ({ id: c.id, fecha: c.fecha, hora: c.hora.slice(0, 5), estado: c.estado, motivo: c.motivo, recetas: Number(c.recetas) })),
      recetas: recetas.map((r) => ({ ...r, anulada: Boolean(r.anulada) })),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;
