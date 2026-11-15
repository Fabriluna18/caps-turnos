const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { verificarToken, permitir } = require('../middleware/auth');
const { claveTemporal } = require('../clave');

const router = express.Router();

// Todo lo de acá es solo para la secretaría
router.use(verificarToken, permitir('secretaria'));


function idValido(valor) {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : null;
}

const LISTA = `
  SELECT u.id, u.dni, u.nombre, u.apellido, u.email, u.telefono, u.activo,
         m.matricula, m.especialidad_id, e.nombre AS especialidad
  FROM usuarios u
  JOIN medicos m ON m.usuario_id = u.id
  JOIN especialidades e ON e.id = m.especialidad_id`;

const conActivo = (fila) => ({ ...fila, activo: Boolean(fila.activo) });

// Valida y limpia lo que viene del formulario
function leerDatos(body, conDni) {
  const texto = (v) => (typeof v === 'string' ? v.trim() : '');
  const datos = {
    dni: String(body.dni ?? '').replace(/\D/g, ''),
    nombre: texto(body.nombre),
    apellido: texto(body.apellido),
    email: texto(body.email).toLowerCase() || null,
    telefono: texto(body.telefono) || null,
    matricula: texto(body.matricula),
    especialidad_id: Number.parseInt(body.especialidad_id, 10),
  };

  if (conDni && !/^\d{7,8}$/.test(datos.dni)) return { error: 'El DNI debe tener 7 u 8 números' };
  if (datos.nombre.length < 2 || datos.nombre.length > 80) return { error: 'Ingresá el nombre (hasta 80 letras)' };
  if (datos.apellido.length < 2 || datos.apellido.length > 80) return { error: 'Ingresá el apellido (hasta 80 letras)' };
  if (datos.email && (datos.email.length > 150 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(datos.email))) {
    return { error: 'El email no es válido' };
  }
  if (datos.telefono && !/^[0-9+()\-\s]{6,30}$/.test(datos.telefono)) return { error: 'El teléfono no es válido' };
  if (!/^[A-Za-z0-9.\-/]{2,20}$/.test(datos.matricula)) {
    return { error: 'La matrícula no es válida (2 a 20 letras o números)' };
  }
  if (!Number.isInteger(datos.especialidad_id)) return { error: 'Elegí una especialidad' };
  return { datos };
}

function mensajeDuplicado(error) {
  if (error.code !== 'ER_DUP_ENTRY') return null;
  const detalle = error.sqlMessage || '';
  if (detalle.includes('uq_usuarios_dni')) return 'Ya existe una persona con ese DNI';
  if (detalle.includes('uq_usuarios_email')) return 'Ya existe una persona con ese email';
  if (detalle.includes('uq_medicos_matricula')) return 'Ya existe un médico con esa matrícula';
  return 'Ya existe un registro con esos datos';
}

router.get('/', async (req, res) => {
  try {
    const [filas] = await pool.query(`${LISTA} WHERE u.rol = 'medico' ORDER BY u.apellido, u.nombre`);
    res.json(filas.map(conActivo));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Alta: crea la cuenta con una clave temporal que se muestra una sola vez
router.post('/', async (req, res) => {
  const { datos, error } = leerDatos(req.body, true);
  if (error) return res.status(400).json({ error });

  const conexion = await pool.getConnection();
  try {
    const [esp] = await conexion.query('SELECT id FROM especialidades WHERE id = ?', [datos.especialidad_id]);
    if (esp.length === 0) return res.status(400).json({ error: 'La especialidad no existe' });

    const clave = claveTemporal();
    const hash = await bcrypt.hash(clave, 10);

    await conexion.beginTransaction();
    const [r] = await conexion.query(
      `INSERT INTO usuarios (dni, nombre, apellido, email, telefono, password_hash, rol, debe_cambiar_clave)
       VALUES (?, ?, ?, ?, ?, ?, 'medico', 1)`,
      [datos.dni, datos.nombre, datos.apellido, datos.email, datos.telefono, hash]
    );
    await conexion.query('INSERT INTO medicos (usuario_id, matricula, especialidad_id) VALUES (?, ?, ?)', [
      r.insertId,
      datos.matricula,
      datos.especialidad_id,
    ]);
    await conexion.commit();

    const [filas] = await pool.query(`${LISTA} WHERE u.id = ?`, [r.insertId]);
    res.status(201).json({ medico: conActivo(filas[0]), clave_temporal: clave });
  } catch (err) {
    await conexion.rollback();
    const duplicado = mensajeDuplicado(err);
    if (duplicado) return res.status(409).json({ error: duplicado });
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  } finally {
    conexion.release();
  }
});

// Edición (el DNI no se cambia)
router.put('/:id', async (req, res) => {
  const id = idValido(req.params.id);
  if (!id) return res.status(400).json({ error: 'Médico inválido' });

  const { datos, error } = leerDatos(req.body, false);
  if (error) return res.status(400).json({ error });

  const conexion = await pool.getConnection();
  try {
    const [existe] = await conexion.query(
      'SELECT u.id FROM usuarios u JOIN medicos m ON m.usuario_id = u.id WHERE u.id = ?',
      [id]
    );
    if (existe.length === 0) return res.status(404).json({ error: 'Médico no encontrado' });

    const [esp] = await conexion.query('SELECT id FROM especialidades WHERE id = ?', [datos.especialidad_id]);
    if (esp.length === 0) return res.status(400).json({ error: 'La especialidad no existe' });

    await conexion.beginTransaction();
    await conexion.query('UPDATE usuarios SET nombre = ?, apellido = ?, email = ?, telefono = ? WHERE id = ?', [
      datos.nombre,
      datos.apellido,
      datos.email,
      datos.telefono,
      id,
    ]);
    await conexion.query('UPDATE medicos SET matricula = ?, especialidad_id = ? WHERE usuario_id = ?', [
      datos.matricula,
      datos.especialidad_id,
      id,
    ]);
    await conexion.commit();

    const [filas] = await pool.query(`${LISTA} WHERE u.id = ?`, [id]);
    res.json({ medico: conActivo(filas[0]) });
  } catch (err) {
    await conexion.rollback();
    const duplicado = mensajeDuplicado(err);
    if (duplicado) return res.status(409).json({ error: duplicado });
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  } finally {
    conexion.release();
  }
});

// Baja y reactivación: la cuenta queda guardada, pero sin acceso
router.put('/:id/estado', async (req, res) => {
  const id = idValido(req.params.id);
  if (!id) return res.status(400).json({ error: 'Médico inválido' });
  if (typeof req.body.activo !== 'boolean') return res.status(400).json({ error: 'Falta indicar el estado' });

  try {
    const [existe] = await pool.query("SELECT id FROM usuarios WHERE id = ? AND rol = 'medico'", [id]);
    if (existe.length === 0) return res.status(404).json({ error: 'Médico no encontrado' });

    await pool.query('UPDATE usuarios SET activo = ? WHERE id = ?', [req.body.activo ? 1 : 0, id]);
    res.json({ activo: req.body.activo });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Clave temporal nueva (por ejemplo, si se olvidó la suya y no tiene email)
router.post('/:id/reset-clave', async (req, res) => {
  const id = idValido(req.params.id);
  if (!id) return res.status(400).json({ error: 'Médico inválido' });

  try {
    const [existe] = await pool.query("SELECT id FROM usuarios WHERE id = ? AND rol = 'medico'", [id]);
    if (existe.length === 0) return res.status(404).json({ error: 'Médico no encontrado' });

    const clave = claveTemporal();
    const hash = await bcrypt.hash(clave, 10);
    await pool.query('UPDATE usuarios SET password_hash = ?, debe_cambiar_clave = 1 WHERE id = ?', [hash, id]);
    // Los enlaces de recuperación que tuviera pendientes dejan de valer
    await pool.query('UPDATE recuperaciones SET usado_en = NOW() WHERE usuario_id = ? AND usado_en IS NULL', [id]);

    res.json({ clave_temporal: clave });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Eliminación definitiva: no se puede si tiene turnos o recetas registrados
router.delete('/:id', async (req, res) => {
  const id = idValido(req.params.id);
  if (!id) return res.status(400).json({ error: 'Médico inválido' });

  try {
    const [existe] = await pool.query("SELECT id FROM usuarios WHERE id = ? AND rol = 'medico'", [id]);
    if (existe.length === 0) return res.status(404).json({ error: 'Médico no encontrado' });

    await pool.query("DELETE FROM usuarios WHERE id = ? AND rol = 'medico'", [id]);
    res.json({ mensaje: 'Médico eliminado' });
  } catch (error) {
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({
        error: 'Este médico tiene turnos o recetas registrados, así que no se puede eliminar. Dalo de baja.',
      });
    }
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;