const cron = require('node-cron');
const pool = require('./db');
const { enviarMail } = require('./mailer');
const { ahora, diasEntre } = require('./fechas');
const { crearToken } = require('./confirmaciones');
const { aMin } = require('./reservas');

// Cuántas horas antes del turno se avisa (se puede cambiar en .env con RECORDATORIO_HORAS)
const HORAS = Number(process.env.RECORDATORIO_HORAS) > 0 ? Number(process.env.RECORDATORIO_HORAS) : 24;
const FRONT = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
function fechaLarga(f) {
  const [a, m, d] = f.split('-').map(Number);
  return `${DIAS[new Date(Date.UTC(a, m - 1, d)).getUTCDay()]} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${a}`;
}

// Busca turnos pendientes que empiezan dentro de la ventana y todavía no recibieron aviso
async function enviarRecordatorios() {
  const a = ahora();
  const [candidatos] = await pool.query(
    `SELECT t.id, t.fecha, t.hora, up.nombre, up.email, um.apellido AS medico_apellido, e.nombre AS especialidad
     FROM turnos t
     JOIN usuarios up ON up.id = t.paciente_id AND up.activo = 1
     JOIN usuarios um ON um.id = t.medico_id
     JOIN medicos m ON m.usuario_id = t.medico_id
     JOIN especialidades e ON e.id = m.especialidad_id
     WHERE t.estado = 'pendiente' AND t.recordatorio_enviado_en IS NULL
       AND up.email IS NOT NULL AND t.fecha BETWEEN ? AND DATE_ADD(?, INTERVAL ? DAY)`,
    [a.fecha, a.fecha, Math.ceil(HORAS / 24) + 1]
  );

  let enviados = 0;
  for (const t of candidatos) {
    const faltan = diasEntre(a.fecha, t.fecha) * 1440 + aMin(t.hora) - a.minutos; // minutos hasta el turno
    if (faltan <= 0 || faltan > HORAS * 60) continue;

    // Se "reserva" el aviso antes de mandarlo, así dos ejecuciones a la vez no mandan dos mails
    const [u] = await pool.query(
      "UPDATE turnos SET recordatorio_enviado_en = NOW() WHERE id = ? AND recordatorio_enviado_en IS NULL AND estado = 'pendiente'",
      [t.id]
    );
    if (u.affectedRows === 0) continue;

    try {
      const token = await crearToken(pool, t.id);
      await enviarMail({
        para: t.email,
        asunto: 'Confirmá tu turno en el CAPS',
        texto:
          `Hola ${t.nombre},\n\n` +
          `Te recordamos tu turno con ${t.medico_apellido} (${t.especialidad}) el ${fechaLarga(t.fecha)} a las ${t.hora.slice(0, 5)}.\n\n` +
          `Para confirmarlo entrá a este enlace y tocá "Confirmar":\n${FRONT}/confirmar/${token}\n\n` +
          `Si no podés asistir, cancelalo desde "Mis turnos" o avisá en la secretaría para que otra persona use el horario.`,
      });
      enviados += 1;
    } catch (error) {
      // Si el mail falla, se libera para reintentar en la próxima pasada
      console.error('No se pudo enviar el recordatorio del turno', t.id, error.message);
      await pool.query('UPDATE turnos SET recordatorio_enviado_en = NULL WHERE id = ?', [t.id]);
    }
  }
  return enviados;
}

function iniciarRecordatorios() {
  if (process.env.RECORDATORIOS === 'off') return;
  const tarea = () => enviarRecordatorios().catch((e) => console.error('Error en recordatorios:', e.message));
  cron.schedule('*/5 * * * *', tarea, { timezone: 'America/Argentina/Buenos_Aires' });
  tarea();
  console.log(`Recordatorios activos: se avisa ${HORAS} h antes del turno (revisa cada 5 minutos)`);
}

module.exports = { enviarRecordatorios, iniciarRecordatorios };
