require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../db');

const CLAVE = 'demo1234';
const USUARIOS = [
  { dni: '11111111', nombre: 'María', apellido: 'Gómez', rol: 'secretaria', email: 'secretaria@demo.local' },
  { dni: '22222222', nombre: 'Lucía', apellido: 'Rossi', rol: 'medico', email: 'medico@demo.local', matricula: '12345', especialidad: 'Clínica médica' },
  { dni: '33333333', nombre: 'María', apellido: 'López', rol: 'paciente', email: 'paciente@demo.local' },
];

async function main() {
  const hash = await bcrypt.hash(CLAVE, 10);

  for (const u of USUARIOS) {
    const [existe] = await pool.query('SELECT id FROM usuarios WHERE dni = ?', [u.dni]);
    if (existe.length > 0) {
      console.log(`Ya existe: ${u.dni} (${u.rol})`);
      continue;
    }

    const [r] = await pool.query(
      'INSERT INTO usuarios (dni, nombre, apellido, email, password_hash, rol) VALUES (?, ?, ?, ?, ?, ?)',
      [u.dni, u.nombre, u.apellido, u.email, hash, u.rol]
    );

    if (u.rol === 'medico') {
      const [esp] = await pool.query('SELECT id FROM especialidades WHERE nombre = ?', [u.especialidad]);
      await pool.query('INSERT INTO medicos (usuario_id, matricula, especialidad_id) VALUES (?, ?, ?)', [
        r.insertId, u.matricula, esp[0].id,
      ]);
    }
    if (u.rol === 'paciente') {
      await pool.query('INSERT INTO pacientes (usuario_id) VALUES (?)', [r.insertId]);
    }
    console.log(`Creado: ${u.dni} (${u.rol})`);
  }

  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});