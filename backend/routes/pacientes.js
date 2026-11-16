const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { verificarToken, permitir } = require('../middleware/auth');
const { claveTemporal } = require('../clave');
const { contarTurnosFuturos, textoTurnos } = require('../turnos-futuros');

const router = express.Router();

// Todo lo de acá es solo para la secretaría
router.use(verificarToken, permitir('secretaria'));

const POR_PAGINA = 15;

function idValido(valor) {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// Para buscar texto literal con LIKE (que % y _ no actúen como comodines)
const escaparLike = (texto) => texto.replace(/[\\%_]/g, '\\$&');

const hoy = () => new Date().toLocaleDateString('en-CA');

function fechaValida(f) {
  if (typeof f !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(f)) return false;
  const d = new Date(`${f}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === f;
}

const LISTA = `
  SELECT u.id, u.dni, u.nombre, u.apellido, u.email, u.telefono, u.activo,
         p.fecha_nacimiento, p.direccion, p.localidad, p.cobertura
  FROM usuarios u
  JOIN pacientes p ON p.usuario_id = u.id`;

const conActivo = (fila) => ({ ...fila, activo: Boolean(fila.activo) });

// Valida y limpia lo que viene del formulario
function leerDatos(body, conDni) {
  const texto = (v) => (typeof v === 'string' ? v.trim() : '');
  const datos = {
    dni: String(body.dni ?? '').replace(/\D/g, ''),
    nombre: texto(body.nombre),
    apellido: texto(body.apellido),
    fecha_nacimiento: texto(body.fecha_nacimiento),
    email: texto(body.email).toLowerCase() || null,
    telefono: texto(body.telefono) || null,
    direccion: texto(body.direccion) || null,
    localidad: texto(body.localidad) || null,
    cobertura: texto(body.cobertura) || null,
  };

  if (conDni && !/^\d{7,8}$/.test(datos.dni)) return { error: 'El DNI debe tener 7 u 8 números' };
  if (datos.nombre.length < 2 || datos.nombre.length > 80) return { error: 'Ingresá el nombre (hasta 80 letras)' };
  if (datos.apellido.length < 2 || datos.apellido.length > 80) return { error: 'Ingresá el apellido (hasta 80 letras)' };
  if (!fechaValida(datos.fecha_nacimiento)) return { error: 'Ingresá una fecha de nacimiento válida' };
  if (datos.fecha_nacimiento > hoy()) return { error: 'La fecha de nacimiento no puede ser futura' };
  if (datos.fecha_nacimiento < '1900-01-01') return { error: 'La fecha de nacimiento no es válida' };
  if (datos.email && (datos.email.length > 150 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(datos.email))) {
    return { error: 'El email no es válido' };
  }
  if (datos.telefono && !/^[0-9+()\-\s]{6,30}$/.test(datos.telefono)) return { error: 'El teléfono no es válido' };
  if (datos.direccion && datos.direccion.length > 150) return { error: 'La dirección es demasiado larga' };
  if (datos.localidad && datos.localidad.length > 80) return { error: 'La localidad es demasiado larga' };
  if (datos.cobertura && datos.cobertura.length > 80) return { error: 'La cobertura es demasiado larga' };
  return { datos };
}

function mensajeDuplicado(error) {
  if (error.code !== 'ER_DUP_ENTRY') return null;
  const detalle = error.sqlMessage || '';
  if (detalle.includes('uq_usuarios_dni')) return 'Ya existe una persona con ese DNI';
  if (detalle.includes('uq_usuarios_email')) return 'Ya existe una persona con ese email';
  return 'Ya existe un registro con esos datos';
}

// Lista con búsqueda, filtro por estado y páginas
router.get('/', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 60) : '';
  const estado = ['activos', 'baja'].includes(req.query.estado) ? req.query.estado : 'todos';
  const pagina = Math.max(1, Number.parseInt(req.query.pagina, 10) || 1);

  const condiciones = ["u.rol = 'paciente'"];
  const valores = [];

  if (q) {
    const patron = `%${escaparLike(q)}%`;
    const digitos = q.replace(/\D/g, '');
    const partes = ['u.apellido LIKE ?', 'u.nombre LIKE ?', "CONCAT(u.apellido, ' ', u.nombre) LIKE ?"];
    valores.push(patron, patron, patron);
    if (digitos) {
      partes.push('u.dni LIKE ?');
      valores.push(`%${digitos}%`);
    }
    condiciones.push(`(${partes.join(' OR ')})`);
  }
  if (estado === 'activos') condiciones.push('u.activo = 1');
  if (estado === 'baja') condiciones.push('u.activo = 0');

  const donde = condiciones.join(' AND ');

  try {
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM usuarios u JOIN pacientes p ON p.usuario_id = u.id WHERE ${donde}`,
      valores
    );
    const [filas] = await pool.query(
      `${LISTA} WHERE ${donde} ORDER BY u.apellido, u.nombre LIMIT ? OFFSET ?`,
      [...valores, POR_PAGINA, (pagina - 1) * POR_PAGINA]
    );
    res.json({ total: Number(total), pagina, por_pagina: POR_PAGINA, items: filas.map(conActivo) });
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
    const clave = claveTemporal();
    const hash = await bcrypt.hash(clave, 10);

    await conexion.beginTransaction();
    const [r] = await conexion.query(
      `INSERT INTO usuarios (dni, nombre, apellido, email, telefono, password_hash, rol, debe_cambiar_clave)
       VALUES (?, ?, ?, ?, ?, ?, 'paciente', 1)`,
      [datos.dni, datos.nombre, datos.apellido, datos.email, datos.telefono, hash]
    );
    await conexion.query(
      'INSERT INTO pacientes (usuario_id, fecha_nacimiento, direccion, localidad, cobertura) VALUES (?, ?, ?, ?, ?)',
      [r.insertId, datos.fecha_nacimiento, datos.direccion, datos.localidad, datos.cobertura]
    );
    await conexion.commit();

    const [filas] = await pool.query(`${LISTA} WHERE u.id = ?`, [r.insertId]);
    res.status(201).json({ paciente: conActivo(filas[0]), clave_temporal: clave });
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
  if (!id) return res.status(400).json({ error: 'Paciente inválido' });

  const { datos, error } = leerDatos(req.body, false);
  if (error) return res.status(400).json({ error });

  const conexion = await pool.getConnection();
  try {
    const [existe] = await conexion.query(
      'SELECT u.id FROM usuarios u JOIN pacientes p ON p.usuario_id = u.id WHERE u.id = ?',
      [id]
    );
    if (existe.length === 0) return res.status(404).json({ error: 'Paciente no encontrado' });

    await conexion.beginTransaction();
    await conexion.query('UPDATE usuarios SET nombre = ?, apellido = ?, email = ?, telefono = ? WHERE id = ?', [
      datos.nombre,
      datos.apellido,
      datos.email,
      datos.telefono,
      id,
    ]);
    await conexion.query(
      'UPDATE pacientes SET fecha_nacimiento = ?, direccion = ?, localidad = ?, cobertura = ? WHERE usuario_id = ?',
      [datos.fecha_nacimiento, datos.direccion, datos.localidad, datos.cobertura, id]
    );
    await conexion.commit();

    const [filas] = await pool.query(`${LISTA} WHERE u.id = ?`, [id]);
    res.json({ paciente: conActivo(filas[0]) });
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
  if (!id) return res.status(400).json({ error: 'Paciente inválido' });
  if (typeof req.body.activo !== 'boolean') return res.status(400).json({ error: 'Falta indicar el estado' });

  try {
    const [existe] = await pool.query("SELECT id FROM usuarios WHERE id = ? AND rol = 'paciente'", [id]);
    if (existe.length === 0) return res.status(404).json({ error: 'Paciente no encontrado' });

    if (!req.body.activo) {
      const n = await contarTurnosFuturos(pool, { pacienteId: id });
      if (n > 0) {
        return res.status(409).json({
          error: `Este paciente tiene ${textoTurnos(n)} reservados a partir de ahora. Cancelalos antes de darlo de baja.`,
        });
      }
    }

    await pool.query('UPDATE usuarios SET activo = ? WHERE id = ?', [req.body.activo ? 1 : 0, id]);
    res.json({ activo: req.body.activo });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Clave temporal nueva (por ejemplo, si olvidó la suya y no tiene email)
router.post('/:id/reset-clave', async (req, res) => {
  const id = idValido(req.params.id);
  if (!id) return res.status(400).json({ error: 'Paciente inválido' });

  try {
    const [existe] = await pool.query("SELECT id FROM usuarios WHERE id = ? AND rol = 'paciente'", [id]);
    if (existe.length === 0) return res.status(404).json({ error: 'Paciente no encontrado' });

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


module.exports = router;