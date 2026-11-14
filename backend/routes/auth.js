const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { verificarToken, verificarTokenSinBloqueo, permitir } = require('../middleware/auth');
const { bloqueado, registrarFallo, limpiar } = require('../limite');
const { enviarMail } = require('../mailer');

const router = express.Router();

// Se compara contra este hash cuando el DNI no existe, para que tarde lo mismo
const HASH_FALSO = bcrypt.hashSync('una-clave-que-nadie-usa', 10);
const VIGENCIA_ENLACE_MIN = 60;
const MENSAJE_CLAVE = 'La contraseña nueva debe tener entre 8 y 72 caracteres';
const MENSAJE_ENLACE = 'El enlace no es válido o ya venció. Pedí uno nuevo.';

const sha256 = (texto) => crypto.createHash('sha256').update(texto).digest('hex');

// 8 caracteres como mínimo; bcrypt solo mira los primeros 72 bytes
function claveValida(clave) {
  return typeof clave === 'string' && clave.length >= 8 && Buffer.byteLength(clave) <= 72;
}

function datosPublicos(u) {
  return {
    id: u.id,
    dni: u.dni,
    nombre: u.nombre,
    apellido: u.apellido,
    email: u.email,
    rol: u.rol,
    debe_cambiar_clave: Boolean(u.debe_cambiar_clave),
  };
}

router.post('/login', async (req, res) => {
  // Acepta "27.456.987" o "27456987"
  const dni = String(req.body.dni ?? '').replace(/\D/g, '');
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  if (!/^\d{7,8}$/.test(dni) || !password || password.length > 72) {
    return res.status(400).json({ error: 'Ingresá tu DNI (7 u 8 números) y tu contraseña' });
  }

  const clave = `${dni}|${req.ip}`;
  const espera = bloqueado(clave);
  if (espera > 0) {
    return res.status(429).json({ error: `Demasiados intentos. Probá de nuevo en ${Math.ceil(espera / 60)} minutos.` });
  }

  try {
    const [filas] = await pool.query(
      `SELECT id, dni, nombre, apellido, email, rol, password_hash, activo, debe_cambiar_clave
       FROM usuarios WHERE dni = ?`,
      [dni]
    );
    const usuario = filas[0];

    const coincide = await bcrypt.compare(password, usuario ? usuario.password_hash : HASH_FALSO);
    if (!usuario || !coincide) {
      registrarFallo(clave);
      return res.status(401).json({ error: 'DNI o contraseña incorrectos' });
    }
    if (!usuario.activo) {
      return res.status(403).json({ error: 'Tu cuenta está desactivada. Consultá en la secretaría.' });
    }

    limpiar(clave);
    const token = jwt.sign({ id: usuario.id }, process.env.JWT_SECRET, { expiresIn: '8h' });
    res.json({ token, usuario: datosPublicos(usuario) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.get('/me', verificarTokenSinBloqueo, (req, res) => {
  res.json(datosPublicos(req.usuario));
});

// Pedir un enlace para recuperar la contraseña, por DNI o por email
router.post('/olvide', async (req, res) => {
  const usarEmail = typeof req.body.email === 'string' && req.body.email.trim() !== '';
  const email = usarEmail ? req.body.email.trim().toLowerCase() : '';
  const dni = String(req.body.dni ?? '').replace(/\D/g, '');

  const emailOk = email.length <= 150 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
  const dniOk = /^\d{7,8}$/.test(dni);
  if (usarEmail ? !emailOk : !dniOk) {
    return res.status(400).json({ error: usarEmail ? 'Ingresá un email válido' : 'Ingresá tu DNI (7 u 8 números)' });
  }

  const clave = `olvide|${req.ip}`;
  if (bloqueado(clave) > 0) {
    return res.status(429).json({ error: 'Hiciste muchos pedidos seguidos. Probá de nuevo en un rato.' });
  }
  registrarFallo(clave); // cada pedido cuenta, para frenar el abuso

  // Se responde ya, igual para cualquier caso: así nadie averigua qué cuentas existen
  res.json({
    mensaje: 'Si los datos coinciden con una cuenta, te enviamos un enlace al email registrado. Revisá también la carpeta de spam.',
  });

  try {
    const [filas] = await pool.query(
      `SELECT id, nombre, email FROM usuarios WHERE ${usarEmail ? 'email' : 'dni'} = ? AND activo = 1`,
      [usarEmail ? email : dni]
    );
    const u = filas[0];
    if (!u || !u.email) return;

    const token = crypto.randomBytes(32).toString('hex');
    // Los enlaces anteriores sin usar dejan de valer
    await pool.query('UPDATE recuperaciones SET usado_en = NOW() WHERE usuario_id = ? AND usado_en IS NULL', [u.id]);
    await pool.query(
      'INSERT INTO recuperaciones (usuario_id, token_hash, expira_en) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))',
      [u.id, sha256(token), VIGENCIA_ENLACE_MIN]
    );

    const enlace = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/restablecer?token=${token}`;
    await enviarMail({
      para: u.email,
      asunto: 'Restablecer tu contraseña - CAPS Turnos',
      texto:
        `Hola ${u.nombre},\n\n` +
        `Recibimos un pedido para restablecer tu contraseña. Ingresá a este enlace ` +
        `(vale ${VIGENCIA_ENLACE_MIN} minutos y se puede usar una sola vez):\n\n${enlace}\n\n` +
        `Si no fuiste vos, ignorá este mensaje: tu contraseña no cambia.`,
    });
  } catch (error) {
    console.error(error);
  }
});

// Poner una contraseña nueva con el enlace recibido por mail
router.post('/restablecer', async (req, res) => {
  const token = typeof req.body.token === 'string' ? req.body.token : '';

  if (!claveValida(req.body.password)) {
    return res.status(400).json({ error: MENSAJE_CLAVE });
  }

  const clave = `restablecer|${req.ip}`;
  if (bloqueado(clave) > 0) {
    return res.status(429).json({ error: 'Demasiados intentos. Probá de nuevo en un rato.' });
  }
  if (!/^[a-f0-9]{64}$/.test(token)) {
    registrarFallo(clave);
    return res.status(400).json({ error: MENSAJE_ENLACE });
  }

  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();

    const [filas] = await conexion.query(
      `SELECT r.id, r.usuario_id
       FROM recuperaciones r
       JOIN usuarios u ON u.id = r.usuario_id
       WHERE r.token_hash = ? AND r.usado_en IS NULL AND r.expira_en > NOW() AND u.activo = 1
       FOR UPDATE`,
      [sha256(token)]
    );
    if (filas.length === 0) {
      await conexion.rollback();
      registrarFallo(clave);
      return res.status(400).json({ error: MENSAJE_ENLACE });
    }

    const hash = await bcrypt.hash(req.body.password, 10);
    await conexion.query('UPDATE usuarios SET password_hash = ?, debe_cambiar_clave = 0 WHERE id = ?', [
      hash,
      filas[0].usuario_id,
    ]);
    await conexion.query('UPDATE recuperaciones SET usado_en = NOW() WHERE usuario_id = ? AND usado_en IS NULL', [
      filas[0].usuario_id,
    ]);
    await conexion.commit();

    res.json({ mensaje: 'Listo, ya podés ingresar con tu contraseña nueva.' });
  } catch (error) {
    await conexion.rollback();
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  } finally {
    conexion.release();
  }
});

// Cambiar la contraseña estando adentro (también sirve para el primer ingreso)
router.post('/cambiar-clave', verificarTokenSinBloqueo, async (req, res) => {
  const { actual, nueva } = req.body;

  if (typeof actual !== 'string' || !actual || actual.length > 72) {
    return res.status(400).json({ error: 'Ingresá tu contraseña actual' });
  }
  if (!claveValida(nueva)) {
    return res.status(400).json({ error: MENSAJE_CLAVE });
  }
  if (nueva === actual) {
    return res.status(400).json({ error: 'La contraseña nueva tiene que ser distinta de la actual' });
  }

  const clave = `cambiar|${req.usuario.id}`;
  if (bloqueado(clave) > 0) {
    return res.status(429).json({ error: 'Demasiados intentos. Probá de nuevo en un rato.' });
  }

  try {
    const [filas] = await pool.query('SELECT password_hash FROM usuarios WHERE id = ?', [req.usuario.id]);
    const coincide = await bcrypt.compare(actual, filas[0].password_hash);
    if (!coincide) {
      registrarFallo(clave);
      // 400 y no 401, para que la app no cierre la sesión por un error de tipeo
      return res.status(400).json({ error: 'La contraseña actual no es correcta' });
    }

    limpiar(clave);
    const hash = await bcrypt.hash(nueva, 10);
    await pool.query('UPDATE usuarios SET password_hash = ?, debe_cambiar_clave = 0 WHERE id = ?', [
      hash,
      req.usuario.id,
    ]);
    await pool.query('UPDATE recuperaciones SET usado_en = NOW() WHERE usuario_id = ? AND usado_en IS NULL', [
      req.usuario.id,
    ]);

    res.json({
      mensaje: 'Contraseña actualizada',
      usuario: datosPublicos({ ...req.usuario, debe_cambiar_clave: 0 }),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Ruta de prueba de permisos (la sacamos más adelante)
router.get('/prueba-secretaria', verificarToken, permitir('secretaria'), (req, res) => {
  res.json({ mensaje: 'Tenés permiso de secretaría ✅' });
});

module.exports = router;