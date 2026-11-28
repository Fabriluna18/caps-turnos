// Datos de ejemplo para mostrar el sistema: médicos con horarios, pacientes con ficha,
// seis meses de turnos (atendidos, ausentes y cancelados) con su atención y recetas,
// y turnos para las próximas dos semanas. TODO ES FICTICIO.
// Solo agrega datos (no borra nada) y se puede correr una sola vez.
// Uso: npm run demo:completo
require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { ahora, sumarDias, diaSemanaISO, horaSQL } = require('../fechas');

const CLAVE = 'demo1234';
const MESES_ATRAS = 6;
const DIAS_ADELANTE = 14;
const CANT_PACIENTES = 300;

// Números al azar, pero siempre los mismos (así dos instalaciones quedan iguales)
let semilla = 20261119;
function azar() {
  semilla = (semilla * 1664525 + 1013904223) % 4294967296;
  return semilla / 4294967296;
}
const entre = (min, max) => min + Math.floor(azar() * (max - min + 1));
const uno = (lista) => lista[Math.floor(azar() * lista.length)];
const decimal = (min, max) => Math.round((min + azar() * (max - min)) * 10) / 10;

// [dni, nombre, apellido, matrícula, especialidad, horarios: [días, desde, hasta, minutos]]
const MEDICOS = [
  ['20100001', 'Laura', 'Benítez', 'MP-21345', 'Clínica médica', [[[1, 3, 5], '08:00', '12:00', 20], [[2], '14:00', '18:00', 20]]],
  ['20100002', 'Martín', 'Quiroga', 'MP-18872', 'Clínica médica', [[[2, 4], '08:00', '12:00', 20]]],
  ['20100003', 'Carolina', 'Paz', 'MP-30219', 'Pediatría', [[[1, 2, 3, 4], '08:00', '11:00', 20]]],
  ['20100004', 'Diego', 'Ferreyra', 'MP-27751', 'Pediatría', [[[5], '08:00', '12:00', 20], [[3], '14:00', '17:00', 20]]],
  ['20100005', 'Silvina', 'Ortiz', 'MP-25540', 'Ginecología', [[[2, 4], '09:00', '13:00', 30]]],
  ['20100006', 'Javier', 'Molina', 'MP-31027', 'Odontología', [[[1, 3], '13:00', '17:00', 30], [[5], '13:00', '16:00', 30]]],
];

const NOMBRES_F = ['Ana', 'Sofía', 'Valentina', 'Camila', 'Lucía', 'Martina', 'Julieta', 'Florencia', 'Agustina', 'Micaela', 'Rocío', 'Paula', 'Natalia', 'Gabriela', 'Romina', 'Mariela', 'Silvia', 'Rosa', 'Norma', 'Graciela'];
const NOMBRES_M = ['Juan', 'Mateo', 'Santiago', 'Lucas', 'Tomás', 'Benjamín', 'Nicolás', 'Facundo', 'Matías', 'Gonzalo', 'Ezequiel', 'Leandro', 'Ramiro', 'Hernán', 'Carlos', 'Jorge', 'Raúl', 'Miguel', 'Oscar', 'Alberto'];
const APELLIDOS = ['González', 'Rodríguez', 'Gómez', 'Fernández', 'López', 'Díaz', 'Martínez', 'Pérez', 'García', 'Sánchez', 'Romero', 'Sosa', 'Álvarez', 'Torres', 'Ruiz', 'Ramírez', 'Flores', 'Acosta', 'Medina', 'Herrera', 'Aguirre', 'Giménez', 'Gutiérrez', 'Pereyra', 'Rojas', 'Castro', 'Vega', 'Ríos', 'Luna', 'Cabrera'];
const COBERTURAS = [null, null, null, 'PAMI', 'IOMA', 'OSDE', 'Incluir Salud', 'OSECAC'];
const GRUPOS = ['0+', '0+', '0+', 'A+', 'A+', 'B+', 'AB+', '0-', 'A-'];

// Lo clínico, por especialidad: [motivo, diagnóstico, medicamentos posibles]
const { CLINICA } = require('./datos-clinicos');

// Divide una lista en tandas (para no mandar inserts gigantes)
async function insertarEnTandas(conexion, sql, filas) {
  for (let i = 0; i < filas.length; i += 400) {
    await conexion.query(sql, [filas.slice(i, i + 400)]);
  }
}

const aMin = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

async function main() {
  const [ya] = await pool.query('SELECT id FROM usuarios WHERE dni = ?', [MEDICOS[0][0]]);
  if (ya.length > 0) {
    console.log('Los datos de ejemplo ya están cargados. No se agregó nada.');
    return;
  }
  const [sec] = await pool.query("SELECT id FROM usuarios WHERE rol = 'secretaria' AND activo = 1 ORDER BY id LIMIT 1");
  if (sec.length === 0) throw new Error('Primero creá la secretaria demo con "npm run demo".');
  const secretariaId = sec[0].id;

  const hash = await bcrypt.hash(CLAVE, 10);
  const a = ahora();
  const hoy = a.fecha;
  const desde = sumarDias(hoy, -MESES_ATRAS * 30);
  const hasta = sumarDias(hoy, DIAS_ADELANTE);

  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();

    // Especialidades (se reutilizan las que existen)
    const espId = {};
    for (const nombre of new Set(MEDICOS.map((m) => m[4]))) {
      const [f] = await conexion.query('SELECT id FROM especialidades WHERE nombre = ?', [nombre]);
      if (f.length) espId[nombre] = f[0].id;
      else espId[nombre] = (await conexion.query('INSERT INTO especialidades (nombre) VALUES (?)', [nombre]))[0].insertId;
    }

    // Médicos con sus horarios
    const medicos = [];
    for (const [dni, nombre, apellido, matricula, esp, horarios] of MEDICOS) {
      const [u] = await conexion.query(
        "INSERT INTO usuarios (dni, nombre, apellido, password_hash, rol) VALUES (?, ?, ?, ?, 'medico')",
        [dni, nombre, apellido, hash]
      );
      await conexion.query('INSERT INTO medicos (usuario_id, matricula, especialidad_id) VALUES (?, ?, ?)', [u.insertId, matricula, espId[esp]]);
      for (const [dias, ini, fin, min] of horarios) {
        for (const d of dias) {
          await conexion.query(
            'INSERT INTO horarios (medico_id, dia_semana, hora_inicio, hora_fin, duracion_min) VALUES (?, ?, ?, ?, ?)',
            [u.insertId, d, `${ini}:00`, `${fin}:00`, min]
          );
        }
      }
      medicos.push({ id: u.insertId, esp, horarios });
    }

    // Pacientes (sin email, para que nunca les llegue un mail de verdad)
    const pacientes = [];
    for (let i = 0; i < CANT_PACIENTES; i += 1) {
      const mujer = azar() < 0.55;
      const nombre = uno(mujer ? NOMBRES_F : NOMBRES_M);
      const apellido = uno(APELLIDOS);
      const chico = azar() < 0.25;
      const anio = chico ? entre(2012, 2024) : entre(1945, 2006);
      const nacimiento = `${anio}-${String(entre(1, 12)).padStart(2, '0')}-${String(entre(1, 28)).padStart(2, '0')}`;
      const dni = String(30200001 + i);
      const [u] = await conexion.query(
        "INSERT INTO usuarios (dni, nombre, apellido, telefono, password_hash, rol) VALUES (?, ?, ?, ?, ?, 'paciente')",
        [dni, nombre, apellido, `11 5${entre(100, 999)}-${entre(1000, 9999)}`, hash]
      );
      await conexion.query(
        'INSERT INTO pacientes (usuario_id, fecha_nacimiento, direccion, localidad, cobertura) VALUES (?, ?, ?, ?, ?)',
        [u.insertId, nacimiento, `Calle ${entre(1, 200)} N° ${entre(100, 3999)}`, 'Localidad de ejemplo', uno(COBERTURAS)]
      );
      pacientes.push({ id: u.insertId, chico, mujer });
    }

    // Feriados activos del rango: esos días no se dan turnos
    const [fer] = await conexion.query('SELECT fecha FROM feriados WHERE activo = 1 AND fecha BETWEEN ? AND ?', [desde, hasta]);
    const feriados = new Set(fer.map((f) => f.fecha));

    // Turnos: se recorre cada día y cada horario de cada médico
    const turnos = [];
    const ocupadoPaciente = new Set(); // paciente|fecha (un turno por día por paciente)
    for (let f = desde; f <= hasta; f = sumarDias(f, 1)) {
      if (feriados.has(f)) continue;
      const futuro = f > hoy;
      for (const m of medicos) {
        for (const [dias, ini, fin, min] of m.horarios) {
          if (!dias.includes(diaSemanaISO(f))) continue;
          for (let t = aMin(ini); t + min <= aMin(fin); t += min) {
            const yaPaso = f < hoy || (f === hoy && t <= a.minutos);
            if (azar() > (futuro || !yaPaso ? 0.4 : 0.5)) continue; // ocupación aproximada
            // Pediatría atiende a los chicos; Ginecología, a mujeres adultas
            const candidatos = pacientes.filter(
              (p) => (m.esp === 'Pediatría' ? p.chico : m.esp === 'Ginecología' ? p.mujer && !p.chico : !p.chico || azar() < 0.2)
            );
            const p = uno(candidatos);
            if (ocupadoPaciente.has(`${p.id}|${f}`)) continue;
            ocupadoPaciente.add(`${p.id}|${f}`);

            let estado;
            if (yaPaso) {
              const r = azar();
              estado = r < 0.8 ? 'atendido' : r < 0.9 ? 'ausente' : 'cancelado';
            } else {
              estado = azar() < 0.12 ? 'cancelado' : azar() < 0.55 ? 'confirmado' : 'pendiente';
            }
            const caso = uno(CLINICA[m.esp]);
            turnos.push({ medico: m, paciente: p, fecha: f, hora: horaSQL(t), min, estado, caso });
          }
        }
      }
    }
    await insertarEnTandas(
      conexion,
      'INSERT INTO turnos (medico_id, paciente_id, fecha, hora, duracion_min, estado, motivo, creado_por, cancelado_en) VALUES ?',
      turnos.map((t) => [t.medico.id, t.paciente.id, t.fecha, t.hora, t.min, t.estado, t.caso[0], secretariaId, t.estado === 'cancelado' ? `${t.fecha} 07:00:00` : null])
    );

    // Se recuperan los ids de los turnos recién creados
    const [ids] = await conexion.query(
      `SELECT id, medico_id, fecha, hora FROM turnos WHERE medico_id IN (?) AND fecha BETWEEN ? AND ? AND estado <> 'cancelado'`,
      [medicos.map((m) => m.id), desde, hasta]
    );
    const idDe = Object.fromEntries(ids.map((t) => [`${t.medico_id}|${t.fecha}|${t.hora}`, t.id]));

    // Atenciones y recetas de los atendidos
    const atenciones = [];
    const recetas = [];
    const atendidosPor = new Map(); // paciente -> primer médico que lo atendió (para su ficha)
    for (const t of turnos.filter((x) => x.estado === 'atendido')) {
      const turnoId = idDe[`${t.medico.id}|${t.fecha}|${t.hora}`];
      const chico = t.paciente.chico;
      const conVitales = t.medico.esp !== 'Odontología';
      const sis = entre(105, 150);
      const fin = `${t.fecha} ${horaSQL(aMin(t.hora.slice(0, 5)) + t.min - 2)}`;
      atenciones.push([
        turnoId, t.medico.id, t.paciente.id, t.caso[0],
        conVitales && !chico ? sis : null, conVitales && !chico ? sis - entre(35, 50) : null,
        conVitales ? entre(chico ? 80 : 60, chico ? 120 : 95) : null,
        conVitales ? decimal(36, t.caso[0].includes('Fiebre') || t.caso[0].includes('fiebre') ? 38.6 : 37.2) : null,
        conVitales ? entre(95, 99) : null,
        conVitales ? (chico ? decimal(12, 45) : decimal(52, 98)) : null,
        conVitales ? (chico ? entre(90, 160) : entre(150, 188)) : null,
        conVitales ? 'Buen estado general. Sin particularidades al examen.' : 'Examen bucal realizado.',
        t.caso[1], 'Pautas de alarma explicadas. Control según evolución.', 1, fin, fin,
      ]);
      if (!atendidosPor.has(t.paciente.id)) atendidosPor.set(t.paciente.id, t.medico.id);
      if (t.caso[2].length && azar() < 0.8) recetas.push({ turnoId, t });
    }
    await insertarEnTandas(
      conexion,
      `INSERT INTO atenciones (turno_id, medico_id, paciente_id, motivo_consulta, presion_sistolica, presion_diastolica,
        frecuencia_cardiaca, temperatura, saturacion, peso_kg, talla_cm, examen_fisico, diagnostico, indicaciones,
        finalizada, finalizada_en, actualizado_en) VALUES ?`,
      atenciones
    );

    for (const { turnoId, t } of recetas) {
      const [r] = await conexion.query(
        'INSERT INTO recetas (turno_id, medico_id, paciente_id, fecha, diagnostico, indicaciones) VALUES (?, ?, ?, ?, ?, ?)',
        [turnoId, t.medico.id, t.paciente.id, t.fecha, t.caso[1], 'Ante cualquier duda, consultar.']
      );
      await insertarEnTandas(
        conexion,
        'INSERT INTO receta_items (receta_id, orden, medicamento, presentacion, dosis, cantidad) VALUES ?',
        t.caso[2].map((it, n) => [r.insertId, n + 1, ...it])
      );
    }

    // Fichas clínicas para la mayoría de los pacientes atendidos
    const ALERGIAS = [null, null, null, null, 'Penicilina', 'AINES', 'Látex', 'Mariscos'];
    const fichas = [];
    for (const [pacienteId, medicoId] of atendidosPor) {
      if (azar() > 0.75) continue;
      const p = pacientes.find((x) => x.id === pacienteId);
      fichas.push([
        pacienteId, uno(GRUPOS), uno(ALERGIAS),
        p.chico ? null : uno([null, null, 'Hipertensión arterial', 'Diabetes tipo 2', 'Asma']),
        p.chico ? null : uno([null, null, 'Enalapril 10 mg', 'Metformina 850 mg']),
        uno([null, 'Apendicectomía', 'Fractura de muñeca']), uno([null, 'Padre con diabetes', 'Madre hipertensa']), medicoId,
      ]);
    }
    await insertarEnTandas(
      conexion,
      `INSERT INTO fichas (paciente_id, grupo_sanguineo, alergias, enfermedades, medicacion,
        antecedentes_personales, antecedentes_familiares, creado_por) VALUES ?`,
      fichas
    );

    await conexion.commit();

    const cuenta = (e) => turnos.filter((t) => t.estado === e).length;
    console.log('Datos de ejemplo cargados (todo ficticio):');
    console.log(`  ${medicos.length} médicos con horarios · ${pacientes.length} pacientes · ${fichas.length} fichas`);
    console.log(`  ${turnos.length} turnos: ${cuenta('atendido')} atendidos, ${cuenta('ausente')} ausentes, ${cuenta('cancelado')} cancelados, ${cuenta('confirmado') + cuenta('pendiente')} próximos`);
    console.log(`  ${atenciones.length} atenciones y ${recetas.length} recetas`);
    console.log(`\nTodos entran con la clave "${CLAVE}". Médicos: DNI ${MEDICOS[0][0]} a ${MEDICOS[MEDICOS.length - 1][0]}. Pacientes: DNI 30200001 a ${30200000 + CANT_PACIENTES}.`);
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    conexion.release();
  }
}

main()
  .catch((e) => {
    if (e.code === 'ER_DUP_ENTRY') {
      console.error('Algún DNI o matrícula de ejemplo ya existe en tu base (por ejemplo, un paciente que cargaste a mano con el mismo DNI).');
      console.error('No se agregó nada. Detalle:', e.sqlMessage);
    } else {
      console.error('No se pudieron cargar los datos (no quedó nada a medias):', e.message);
    }
    process.exitCode = 1;
  })
  .finally(() => pool.end());
