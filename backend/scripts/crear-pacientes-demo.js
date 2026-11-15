require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../db');

const NOMBRES = ['Juan', 'Ana', 'Pedro', 'Laura', 'Luis', 'Sofía', 'Matías', 'Carla', 'Diego', 'Valeria', 'Martín', 'Camila', 'Nicolás', 'Julieta', 'Facundo', 'Florencia'];
const APELLIDOS = ['Pérez', 'Torres', 'Martínez', 'Díaz', 'Gutiérrez', 'Romero', 'Sánchez', 'Fernández', 'Morales', 'Ramírez', 'Acosta', 'Benítez'];
const COBERTURAS = ['Sin cobertura', 'PAMI', 'Obra social', 'Prepaga', null];
const CANTIDAD = 24;

const dos = (n) => String(n).padStart(2, '0');

async function main() {
  const hash = await bcrypt.hash('demo1234', 10);
  let creados = 0;

  for (let i = 1; i <= CANTIDAD; i++) {
    const dni = String(77000000 + i);
    const [existe] = await pool.query('SELECT id FROM usuarios WHERE dni = ?', [dni]);
    if (existe.length > 0) continue;

    const nacimiento = `${1950 + ((i * 3) % 60)}-${dos(1 + (i % 12))}-${dos(1 + ((i * 7) % 28))}`;
    const [r] = await pool.query(
      `INSERT INTO usuarios (dni, nombre, apellido, email, telefono, password_hash, rol, debe_cambiar_clave)
       VALUES (?, ?, ?, ?, ?, ?, 'paciente', 0)`,
      [
        dni,
        NOMBRES[i % NOMBRES.length],
        APELLIDOS[(i * 5) % APELLIDOS.length],
        i % 3 === 0 ? null : `paciente${dos(i)}@demo.local`,
        `223-55${String(1000 + i).slice(1)}`,
        hash,
      ]
    );
    await pool.query(
      'INSERT INTO pacientes (usuario_id, fecha_nacimiento, direccion, localidad, cobertura) VALUES (?, ?, ?, ?, ?)',
      [r.insertId, nacimiento, `Calle ${100 + i}`, 'Localidad de ejemplo', COBERTURAS[i % COBERTURAS.length]]
    );
    creados++;
  }

  console.log(`Pacientes creados: ${creados} (los que ya existían se saltearon)`);
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});