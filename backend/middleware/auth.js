const jwt = require('jsonwebtoken');
const pool = require('../db');

function crearVerificador(permitirCambioPendiente) {
  return async function verificar(req, res, next) {
    const cabecera = req.headers.authorization;
    if (!cabecera || !cabecera.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Falta iniciar sesión' });
    }

    let datos;
    try {
      datos = jwt.verify(cabecera.slice(7), process.env.JWT_SECRET, { algorithms: ['HS256'] });
    } catch {
      return res.status(401).json({ error: 'La sesión venció. Volvé a ingresar.' });
    }

    try {
      const [filas] = await pool.query(
        `SELECT id, dni, nombre, apellido, email, rol, activo, debe_cambiar_clave
         FROM usuarios WHERE id = ?`,
        [datos.id]
      );
      const usuario = filas[0];

      if (!usuario || !usuario.activo) {
        return res.status(401).json({ codigo: 'SESION_INVALIDA', error: 'Tu cuenta no está activa. Consultá en la secretaría.' });
      }
      if (usuario.debe_cambiar_clave && !permitirCambioPendiente) {
        return res.status(403).json({ codigo: 'CAMBIAR_CLAVE', error: 'Tenés que cambiar tu contraseña antes de continuar' });
      }

      req.usuario = usuario;
      next();
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error del servidor' });
    }
  };
}

// Para casi todas las rutas
const verificarToken = crearVerificador(false);
// Solo para /me y /cambiar-clave, que deben funcionar con clave temporal
const verificarTokenSinBloqueo = crearVerificador(true);

// Deja pasar solo a los roles indicados: permitir('secretaria', 'medico')
function permitir(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.usuario.rol)) {
      return res.status(403).json({ error: 'No tenés permiso para hacer esto' });
    }
    next();
  };
}

module.exports = { verificarToken, verificarTokenSinBloqueo, permitir };