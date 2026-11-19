// Marca de tiempo (en segundos) para invalidar las sesiones anteriores de un usuario
const ahoraSeg = () => Math.floor(Date.now() / 1000);

async function cerrarSesiones(conexion, usuarioId) {
  await conexion.query('UPDATE usuarios SET sesiones_desde = ? WHERE id = ?', [ahoraSeg(), usuarioId]);
}

module.exports = { cerrarSesiones };
