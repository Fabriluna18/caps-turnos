const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { verificarToken } = require('../middleware/auth');
const { bloqueado, registrarFallo, limpiar } = require('../limite');

const router = express.Router();

router.use(verificarToken);

const texto = (v) => (typeof v === 'string' ? v.trim() : '');

async function cargarPerfil(id) {
  const [filas] = await pool.query(
    `SELECT u.id, u.dni, u.nombre, u.apellido, u.email, u.telefono, u.rol,
            p.fecha_nacimiento, p.direccion, p.localidad, p.cobertura,
            m.matricula, e.nombre AS especialidad
     FROM usuarios u
     LEFT JOIN pacientes p ON p.usuario_id = u.id
     LEFT JOIN medicos m ON m.usuario_id = u.id
     LEFT JOIN especialidades e ON e.id = m.especialidad_id
     WHERE u.id = ?`,
    [id]
  );
  return filas[0];
}

router.get('/', async (req, res) => {
  try {
    res.json(await cargarPerfil(req.usuario.id));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Cada persona actualiza solo su contacto. Nombre, apellido y DNI los corrige la secretaría.
router.put('/', async (req, res) => {
  const esPaciente = req.usuario.rol === 'paciente';
  const telefono = texto(req.body.telefono) || null;
  const email = texto(req.body.email).toLowerCase() || null;
  const direccion = esPaciente ? texto(req.body.direccion) || null : null;
  const localidad = esPaciente ? texto(req.body.localidad) || null : null;

  if (telefono && !/^[0-9+()\-\s]{6,30}$/.test(telefono)) return res.status(400).json({ error: 'El teléfono no es válido' });
  if (email && (email.length > 150 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))) {
    return res.status(400).json({ error: 'El email no es válido' });
  }
  if (direccion && direccion.length > 150) return res.status(400).json({ error: 'La dirección es demasiado larga' });
  if (localidad && localidad.length > 80) return res.status(400).json({ error: 'La localidad es demasiado larga' });

  const conexion = await pool.getConnection();
  try {
    const actual = await cargarPerfil(req.usuario.id);

    // El email es el canal para recuperar la clave: cambiarlo exige la contraseña actual
    if ((email || '') !== (actual.email || '')) {
      const password = typeof req.body.password_actual === 'string' ? req.body.password_actual : '';
      if (!password || password.length > 72) {
        return res.status(400).json({ error: 'Para cambiar el email ingresá tu contraseña actual' });
      }
      const clave = `perfil|${req.usuario.id}`;
      if (bloqueado(clave) > 0) {
        return res.status(429).json({ error: 'Demasiados intentos. Probá de nuevo en un rato.' });
      }
      const [filas] = await conexion.query('SELECT password_hash FROM usuarios WHERE id = ?', [req.usuario.id]);
      if (!(await bcrypt.compare(password, filas[0].password_hash))) {
        registrarFallo(clave);
        // 400 y no 401, para que la app no cierre la sesión por un error de tipeo
        return res.status(400).json({ error: 'La contraseña actual no es correcta' });
      }
      limpiar(clave);
    }

    await conexion.beginTransaction();
    await conexion.query('UPDATE usuarios SET telefono = ?, email = ? WHERE id = ?', [telefono, email, req.usuario.id]);
    if (esPaciente) {
      await conexion.query('UPDATE pacientes SET direccion = ?, localidad = ? WHERE usuario_id = ?', [
        direccion,
        localidad,
        req.usuario.id,
      ]);
    }
    await conexion.commit();

    res.json({ perfil: await cargarPerfil(req.usuario.id) });
  } catch (error) {
    await conexion.rollback();
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'No se pudo usar ese email. Probá con otro.' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  } finally {
    conexion.release();
  }
});

module.exports = router;