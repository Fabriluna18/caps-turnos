require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../db');

const hora = (t) => `${t}:00`;

// dias: 1 = lunes ... 7 = domingo
const MEDICOS = [
  {
    dni: '88000001', nombre: 'Martín', apellido: 'Silva', matricula: 'DEMO-001',
    especialidad: 'Pediatría', email: 'martin.silva@demo.local',
    horarios: [
      { dias: [2, 4], inicio: '09:00', fin: '13:00', cada: 20 },
      { dias: [2], inicio: '15:00', fin: '18:00', cada: 20 },
    ],
  },
  {
    dni: '88000002', nombre: 'Valeria', apellido: 'Gómez', matricula: 'DEMO-002',
    especialidad: 'Ginecología', email: 'valeria.gomez@demo.local',
    horarios: [{ dias: [1, 2, 3, 4, 5], inicio: '14:00', fin: '18:00', cada: 30 }],
  },
];

async function agregarHorarios(medicoId, bloques) {
  for (const b of bloques) {
    for (const dia of b.dias) {
      await pool.query(
        'INSERT INTO horarios (medico_id, dia_semana, hora_inicio, hora_fin, duracion_min) VALUES (?, ?, ?, ?, ?)',
        [medicoId, dia, hora(b.inicio), hora(b.fin), b.cada]
      );
    }
  }
}

async function main() {
  await pool.query("INSERT IGNORE INTO especialidades (nombre) VALUES ('Pediatría'), ('Ginecología')");
  const hash = await bcrypt.hash('demo1234', 10);

  for (const m of MEDICOS) {
    const [existe] = await pool.query('SELECT id FROM usuarios WHERE dni = ?', [m.dni]);
    if (existe.length > 0) {
      console.log(`Ya existe: ${m.apellido}`);
      continue;
    }
    const [esp] = await pool.query('SELECT id FROM especialidades WHERE nombre = ?', [m.especialidad]);
    const [r] = await pool.query(
      `INSERT INTO usuarios (dni, nombre, apellido, email, password_hash, rol, debe_cambiar_clave)
       VALUES (?, ?, ?, ?, ?, 'medico', 0)`,
      [m.dni, m.nombre, m.apellido, m.email, hash]
    );
    await pool.query('INSERT INTO medicos (usuario_id, matricula, especialidad_id) VALUES (?, ?, ?)', [
      r.insertId,
      m.matricula,
      esp[0].id,
    ]);
    await agregarHorarios(r.insertId, m.horarios);
    console.log(`Creado: ${m.apellido}`);
  }

  // La doctora Rossi de los primeros días: lunes, miércoles y viernes por la mañana
  const [rossi] = await pool.query("SELECT id FROM usuarios WHERE dni = '22222222' AND rol = 'medico'");
  if (rossi.length > 0) {
    const [tiene] = await pool.query('SELECT id FROM horarios WHERE medico_id = ? LIMIT 1', [rossi[0].id]);
    if (tiene.length === 0) {
      await agregarHorarios(rossi[0].id, [{ dias: [1, 3, 5], inicio: '08:00', fin: '12:00', cada: 30 }]);
      console.log('Horarios cargados para Rossi');
    }
  }

  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});