const crypto = require('crypto');

const hashear = (token) => crypto.createHash('sha256').update(token).digest('hex');

// Crea un enlace nuevo para el turno. En la base queda solo el hash.
async function crearToken(conexion, turnoId) {
  const token = crypto.randomBytes(32).toString('hex');
  await conexion.query('INSERT INTO confirmaciones (turno_id, token_hash) VALUES (?, ?)', [turnoId, hashear(token)]);
  return token;
}

async function buscarPorToken(conexion, token) {
  if (typeof token !== 'string' || !/^[0-9a-f]{64}$/.test(token)) return null;
  const [filas] = await conexion.query(
    `SELECT c.id AS confirmacion_id, c.usado_en, t.id, t.fecha, t.hora, t.estado, um.apellido AS medico_apellido, e.nombre AS especialidad
     FROM confirmaciones c
     JOIN turnos t ON t.id = c.turno_id
     JOIN usuarios um ON um.id = t.medico_id
     JOIN medicos m ON m.usuario_id = t.medico_id
     JOIN especialidades e ON e.id = m.especialidad_id
     WHERE c.token_hash = ?`,
    [hashear(token)]
  );
  return filas[0] || null;
}

module.exports = { crearToken, buscarPorToken };
