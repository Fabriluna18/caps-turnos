const express = require('express');
const pool = require('../db');
const { verificarToken, permitir } = require('../middleware/auth');
const { ahora } = require('../fechas');
const { reservarTurno, esFuturo } = require('../reservas');

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

const POR_PAGINA = 10;
const SELECT = `
  SELECT t.id, t.fecha, t.hora, t.estado, t.motivo, um.nombre, um.apellido, e.nombre AS especialidad
  FROM turnos t
  JOIN usuarios um ON um.id = t.medico_id
  JOIN medicos m ON m.usuario_id = t.medico_id
  JOIN especialidades e ON e.id = m.especialidad_id`;

const aTurno = (t) => ({
  id: t.id,
  fecha: t.fecha,
  hora: t.hora.slice(0, 5),
  estado: t.estado,
  motivo: t.motivo,
  medico: { nombre: t.nombre, apellido: t.apellido, especialidad: t.especialidad },
  // se puede confirmar o cancelar solo si está vigente y todavía no empezó
  modificable: ['pendiente', 'confirmado'].includes(t.estado) && esFuturo(t.fecha, t.hora),
});

// Mis turnos: ?tab=proximos | historial | cancelados
router.get('/', async (req, res) => {
  const tab = ['proximos', 'historial', 'cancelados'].includes(req.query.tab) ? req.query.tab : 'proximos';
  const pagina = Math.max(1, Number.parseInt(req.query.pagina, 10) || 1);
  const a = ahora();
  const horaAhora = `${String(Math.floor(a.minutos / 60)).padStart(2, '0')}:${String(a.minutos % 60).padStart(2, '0')}:00`;

  // "próximo" = vigente (pendiente, confirmado o en atención) y que no empezó antes de ahora
  const proximo = "t.estado IN ('pendiente','confirmado','en_atencion') AND (t.fecha > ? OR (t.fecha = ? AND t.hora > ?))";
  const filtros = {
    proximos: { donde: proximo, valores: [a.fecha, a.fecha, horaAhora], orden: 't.fecha, t.hora' },
    // todo lo que no es cancelado ni próximo (atendidos, ausentes y reservas viejas que quedaron sin cerrar)
    historial: { donde: `t.estado <> 'cancelado' AND NOT (${proximo})`, valores: [a.fecha, a.fecha, horaAhora], orden: 't.fecha DESC, t.hora DESC' },
    cancelados: { donde: "t.estado = 'cancelado'", valores: [], orden: 't.fecha DESC, t.hora DESC' },
  };
  const f = filtros[tab];

  // Filtros opcionales: especialidad y estado (dentro de la pestaña elegida)
  let donde = f.donde;
  const valores = [...f.valores];
  const especialidadId = idValido(req.query.especialidad_id);
  if (especialidadId) {
    donde += ' AND m.especialidad_id = ?';
    valores.push(especialidadId);
  }
  if (['pendiente', 'confirmado', 'en_atencion', 'atendido', 'ausente'].includes(req.query.estado)) {
    donde += ' AND t.estado = ?';
    valores.push(req.query.estado);
  }

  try {
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM turnos t JOIN medicos m ON m.usuario_id = t.medico_id
       WHERE t.paciente_id = ? AND ${donde}`,
      [req.usuario.id, ...valores]
    );
    const [filas] = await pool.query(
      `${SELECT} WHERE t.paciente_id = ? AND ${donde} ORDER BY ${f.orden} LIMIT ? OFFSET ?`,
      [req.usuario.id, ...valores, POR_PAGINA, (pagina - 1) * POR_PAGINA]
    );
    res.json({ tab, total: Number(total), pagina, por_pagina: POR_PAGINA, items: filas.map(aTurno) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Cambia el estado de un turno PROPIO. Si es de otra persona responde "no encontrado".
async function cambiarEstado(req, res, { desde, hacia, accion, extra = '' }) {
  const id = idValido(req.params.id);
  if (!id) return res.status(400).json({ error: 'Turno inválido' });
  try {
    const [filas] = await pool.query('SELECT id, fecha, hora, estado FROM turnos WHERE id = ? AND paciente_id = ?', [id, req.usuario.id]);
    const t = filas[0];
    if (!t) return res.status(404).json({ error: 'Turno no encontrado' });
    if (!desde.includes(t.estado)) {
      return res.status(409).json({ error: `Este turno está ${t.estado.replace('_', ' ')}, así que no se puede ${accion}.` });
    }
    if (!esFuturo(t.fecha, t.hora)) return res.status(409).json({ error: `Ese turno ya empezó o pasó, así que no se puede ${accion}.` });

    const [u] = await pool.query(
      `UPDATE turnos SET estado = ?${extra} WHERE id = ? AND paciente_id = ? AND estado IN (${desde.map(() => '?').join(',')})`,
      [hacia, id, req.usuario.id, ...desde]
    );
    if (u.affectedRows === 0) return res.status(409).json({ error: 'El turno cambió de estado. Recargá la lista.' });
    res.json({ estado: hacia });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
}

router.put('/:id/confirmar', (req, res) => cambiarEstado(req, res, { desde: ['pendiente'], hacia: 'confirmado', accion: 'confirmar' }));

// Cancelar: el turno queda guardado como cancelado y el horario vuelve a estar libre
router.put('/:id/cancelar', (req, res) =>
  cambiarEstado(req, res, { desde: ['pendiente', 'confirmado'], hacia: 'cancelado', accion: 'cancelar', extra: ', cancelado_en = NOW()' })
);

module.exports = router;
